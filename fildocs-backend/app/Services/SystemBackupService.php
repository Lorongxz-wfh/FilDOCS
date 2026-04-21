<?php

namespace App\Services;

use App\Models\DocumentVersion;
use App\Models\DocumentTemplate;
use App\Models\DocumentRequestSubmissionFile;
use App\Models\User;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;
use ZipArchive;
use Illuminate\Support\Facades\DB;

class SystemBackupService
{
    /**
     * Generate a Document ZIP and optionally save it to a specific path.
     */
    public function generateDocumentZip(?string $from = null, ?string $to = null): string
    {
        if (!class_exists('ZipArchive')) {
            throw new \Exception('PHP Zip extension is not installed.');
        }

        $tempZipPath = tempnam(sys_get_temp_dir(), 'fildocs_zip_') . '.zip';
        $zip = new ZipArchive();
        
        if ($zip->open($tempZipPath, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
            throw new \Exception("Failed to create ZIP at {$tempZipPath}");
        }

        $filesAdded = 0;
        $manifest   = [];
        // Track temp files to clean up after closing ZIP
        $localTempFiles = [];

        $addSafely = function($zipPath, $entryName) use ($zip, &$filesAdded, &$manifest, &$localTempFiles) {
            $found = $this->findFileAcrossDisks($zipPath);
            if (!$found) return false;

            try {
                $disk = Storage::disk($found['disk']);
                
                // If it's a local disk, we can use the path directly
                if (in_array($found['disk'], ['local', 'public'])) {
                    $zip->addFile($found['abs_path'], $entryName);
                } else {
                    // It's remote (S3/R2). Stream it to a local temp file first.
                    $tempFile = tempnam(sys_get_temp_dir(), 'fildocs_stream_');
                    $srcStream = $disk->readStream($zipPath);
                    $destStream = fopen($tempFile, 'w');
                    
                    if ($srcStream && $destStream) {
                        stream_copy_to_stream($srcStream, $destStream);
                        fclose($srcStream);
                        fclose($destStream);
                        
                        $zip->addFile($tempFile, $entryName);
                        $localTempFiles[] = $tempFile;
                    } else {
                        if (is_resource($srcStream)) fclose($srcStream);
                        if (is_resource($destStream)) fclose($destStream);
                        return false;
                    }
                }
                
                $manifest[$entryName] = $zipPath;
                $filesAdded++;
                return true;
            } catch (\Throwable $e) {
                \Log::warning("Failed to add file to backup ZIP", ['path' => $zipPath, 'error' => $e->getMessage()]);
                return false;
            }
        };

        // 1. Regular Documents
        DocumentVersion::query()
            ->whereNotNull('file_path')
            ->where('file_path', '!=', '')
            ->with(['document:id,title,code,owner_office_id', 'document.ownerOffice:id,code'])
            ->when($from, fn($q) => $q->where('created_at', '>=', "{$from} 00:00:00"))
            ->when($to, fn($q) => $q->where('created_at', '<=', "{$to} 23:59:59"))
            ->chunk(100, function ($versions) use ($addSafely) {
                foreach ($versions as $v) {
                    $officeCode = $v->document?->ownerOffice?->code ?? 'Unknown';
                    $docCode    = $v->document?->code ?? "doc-{$v->document_id}";
                    $date       = $v->created_at?->format('Y-m-d') ?? 'Unknown Date';
                    $ext        = pathinfo($v->original_filename ?? $v->file_path, PATHINFO_EXTENSION) ?: 'pdf';
                    
                    $entryName = "{$officeCode}/Created Documents/{$date}/{$docCode}_v{$v->version_number}.{$ext}";
                    $addSafely($v->file_path, $entryName);

                    if ($v->preview_path) {
                        $pExt = pathinfo($v->preview_path, PATHINFO_EXTENSION) ?: 'png';
                        $pName = "{$officeCode}/Created Documents/{$date}/previews/{$docCode}_v{$v->version_number}_preview.{$pExt}";
                        $addSafely($v->preview_path, $pName);
                    }
                }
            });

        // 2. Templates
        DocumentTemplate::query()
            ->whereNotNull('file_path')
            ->where('file_path', '!=', '')
            ->with('office:id,code')
            ->chunk(100, function ($templates) use ($addSafely) {
                foreach ($templates as $t) {
                    $officeCode = $t->office?->code ?? 'General';
                    $filename   = basename($t->file_path);
                    
                    $addSafely($t->file_path, "{$officeCode}/Templates/{$filename}");

                    if ($t->thumbnail_path) {
                        $thExt = pathinfo($t->thumbnail_path, PATHINFO_EXTENSION) ?: 'png';
                        $addSafely($t->thumbnail_path, "{$officeCode}/Templates/Thumbnails/{$filename}_thumb.{$thExt}");
                    }
                }
            });

        // 3. Document Request Files
        DocumentRequestSubmissionFile::query()
            ->whereNotNull('file_path')
            ->where('file_path', '!=', '')
            ->with(['submission.recipient.office:id,code', 'submission.recipient.request:id,title', 'submission.item:id,title'])
            ->chunk(100, function ($files) use ($addSafely) {
                foreach ($files as $f) {
                    $officeCode = $f->submission?->recipient?->office?->code ?? 'Unknown';
                    $date       = $f->created_at?->format('Y-m-d') ?? 'Unknown Date';
                    $safeReqTitle  = substr(preg_replace('/[^A-Za-z0-9_\- ]/', '', $f->submission?->recipient?->request?->title ?? "Req"), 0, 50);
                    $safeItemTitle = substr(preg_replace('/[^A-Za-z0-9_\- ]/', '', $f->submission?->item?->title ?? "Item"), 0, 50);
                    
                    // Main File
                    $ext = pathinfo($f->original_filename ?? $f->file_path, PATHINFO_EXTENSION) ?: 'pdf';
                    $entryName = "{$officeCode}/Document Requests/{$date}/{$safeReqTitle} - {$safeItemTitle}.{$ext}";
                    $addSafely($f->file_path, $entryName);

                    // Preview
                    if ($f->preview_path) {
                        $pExt = pathinfo($f->preview_path, PATHINFO_EXTENSION) ?: 'png';
                        $pName = "{$officeCode}/Document Requests/{$date}/previews/{$safeReqTitle} - {$safeItemTitle}_preview.{$pExt}";
                        $addSafely($f->preview_path, $pName);
                    }
                }
            });

        // 4. Request Examples (Global and Item-level)
        \App\Models\DocumentRequest::query()
            ->whereNotNull('example_file_path')
            ->chunk(100, function ($reqs) use ($addSafely) {
                foreach ($reqs as $r) {
                    $safeTitle = substr(preg_replace('/[^A-Za-z0-9_\- ]/', '', $r->title), 0, 50);
                    $ext = pathinfo($r->example_file_path, PATHINFO_EXTENSION) ?: 'pdf';
                    $addSafely($r->example_file_path, "Identity/Request-Examples/Global/{$safeTitle}.{$ext}");
                    if ($r->example_preview_path) {
                        $pExt = pathinfo($r->example_preview_path, PATHINFO_EXTENSION) ?: 'png';
                        $addSafely($r->example_preview_path, "Identity/Request-Examples/Global/Previews/{$safeTitle}_preview.{$pExt}");
                    }
                }
            });

        \App\Models\DocumentRequestItem::query()
            ->whereNotNull('example_file_path')
            ->with('request:id,title')
            ->chunk(100, function ($items) use ($addSafely) {
                foreach ($items as $i) {
                    $safeReqTitle = substr(preg_replace('/[^A-Za-z0-9_\- ]/', '', $i->request?->title ?? 'Req'), 0, 50);
                    $safeItemTitle = substr(preg_replace('/[^A-Za-z0-9_\- ]/', '', $i->title), 0, 50);
                    $ext = pathinfo($i->example_file_path, PATHINFO_EXTENSION) ?: 'pdf';
                    $addSafely($i->example_file_path, "Identity/Request-Examples/Items/{$safeReqTitle}/{$safeItemTitle}.{$ext}");
                    if ($i->example_preview_path) {
                        $pExt = pathinfo($i->example_preview_path, PATHINFO_EXTENSION) ?: 'png';
                        $addSafely($i->example_preview_path, "Identity/Request-Examples/Items/{$safeReqTitle}/Previews/{$safeItemTitle}_preview.{$pExt}");
                    }
                }
            });

        // 5. Identity
        User::query()
            ->where(fn($q) => $q->whereNotNull('profile_photo_path')->orWhereNotNull('signature_path'))
            ->chunk(100, function ($users) use ($addSafely) {
                foreach ($users as $u) {
                    if ($u->profile_photo_path && !Str::startsWith($u->profile_photo_path, 'data:')) {
                        $ext = pathinfo($u->profile_photo_path, PATHINFO_EXTENSION);
                        $addSafely($u->profile_photo_path, "Identity/Avatars/user_{$u->id}.{$ext}");
                    }
                    if ($u->signature_path && !Str::startsWith($u->signature_path, 'data:')) {
                        $ext = pathinfo($u->signature_path, PATHINFO_EXTENSION);
                        $addSafely($u->signature_path, "Identity/Signatures/user_{$u->id}.{$ext}");
                    }
                }
            });

        if ($filesAdded === 0) {
            $zip->addFromString('readme.txt', 'No document files found.');
        } else {
            $zip->addFromString('manifest.json', json_encode($manifest, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
        }

        $zip->close();
        
        // Cleanup local temp files used for ZIP
        foreach ($localTempFiles as $f) {
            @unlink($f);
        }

        return $tempZipPath;
    }

    /**
     * Generate an SQL dump file and return its temporary path.
     */
    public function generateSqlDump(): string
    {
        $tempPath = tempnam(sys_get_temp_dir(), 'fildocs_db_') . '.sql';
        $dbConnection = config('database.default');
        
        if ($dbConnection === 'sqlite') {
            $dbPath = config('database.connections.sqlite.database');
            File::copy($dbPath, $tempPath);
            return $tempPath;
        }

        // Standard MySQL/Postgres dump logic (simplified from SystemBackupController)
        $fh = fopen($tempPath, 'w');
        fwrite($fh, "-- FilDOCS Database Snapshot\n-- Generated: " . now()->toDateTimeString() . "\n");
        fwrite($fh, "-- BackupDriver: {$dbConnection}\n\n");

        $isMysql = in_array($dbConnection, ['mysql', 'mariadb'], true);
        $skipTables = ['migrations', 'jobs', 'failed_jobs', 'cache', 'cache_locks', 'telescope_entries', 'telescope_entries_tags', 'telescope_monitoring'];

        if ($isMysql) {
            $tables = DB::select('SHOW TABLES');
            $tableNames = array_map(fn($t) => array_values((array)$t)[0], $tables);
            fwrite($fh, "SET FOREIGN_KEY_CHECKS=0;\nSET NAMES utf8mb4;\n\n");
        } else {
            $tables = DB::select("SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename");
            $tableNames = array_column($tables, 'tablename');
        }

        foreach ($tableNames as $table) {
            if (in_array($table, $skipTables)) continue;
            fwrite($fh, "-- Table: {$table}\n");

            // Detect best column for chunking (prefer 'id', fallback to first column, or none)
            $cols = \Illuminate\Support\Facades\Schema::getColumnListing($table);
            $orderCol = in_array('id', $cols) ? 'id' : ($cols[0] ?? null);

            $query = DB::table($table);
            if ($orderCol) {
                $query->orderBy($orderCol);
            }

            $query->chunk(500, function ($rows) use ($fh, $table, $isMysql) {
                foreach ($rows as $row) {
                    $arr = (array)$row;
                    $values = array_map(function ($val) use ($isMysql) {
                        if ($val === null) return 'NULL';
                        if (is_numeric($val) && !is_string($val)) return $val;
                        if ($isMysql) return "'" . addslashes((string) $val) . "'";
                        return "'" . str_replace("'", "''", (string) $val) . "'";
                    }, $arr);

                    if ($isMysql) {
                        $cols = '`' . implode('`, `', array_keys($arr)) . '`';
                        fwrite($fh, "INSERT INTO `{$table}` ({$cols}) VALUES (" . implode(', ', $values) . ");\n");
                    } else {
                        $cols = '"' . implode('", "', array_keys($arr)) . '"';
                        fwrite($fh, "INSERT INTO \"{$table}\" ({$cols}) VALUES (" . implode(', ', $values) . ");\n");
                    }
                }
            });
            fwrite($fh, "\n");
        }

        if ($isMysql) fwrite($fh, "SET FOREIGN_KEY_CHECKS=1;\n");
        fclose($fh);

        return $tempPath;
    }

    private function findFileAcrossDisks(?string $path): ?array
    {
        if (!$path) return null;
        $disks = ['local', 'public', 's3'];
        foreach ($disks as $diskName) {
            try {
                $disk = Storage::disk($diskName);
                if ($disk->exists($path)) {
                    return ['disk' => $diskName, 'abs_path' => $disk->path($path)];
                }
            } catch (\Throwable $e) { continue; }
        }
        return null;
    }
}
