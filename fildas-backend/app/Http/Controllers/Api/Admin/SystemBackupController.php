<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Notification;
use App\Models\User;
use App\Traits\LogsActivityTrait;
use App\Traits\RoleNameTrait;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Mail;
use ZipArchive;

class SystemBackupController extends Controller
{
    use RoleNameTrait, LogsActivityTrait;

    protected $backupDir = 'backups';

    private function disk()
    {
        // Allow a dedicated disk for backups (e.g., 's3' or 'r2') 
        // fallback to system default FILESYSTEM_DISK
        $diskName = env('FILESYSTEM_BACKUP_DISK', config('filesystems.default'));
        return Storage::disk($diskName);
    }

    private function checkAccess(Request $request): void
    {
        $user = $request->user();
        $role = $this->roleNameOf($user);
        if (!in_array($role, ['qa', 'admin', 'sysadmin', 'office_head'], true)) {
            abort(403, 'Unauthorized.');
        }
    }

    public function index(Request $request)
    {
        $this->checkAccess($request);
        $disk = $this->disk();

        if (!$disk->exists($this->backupDir)) {
            $disk->makeDirectory($this->backupDir);
        }

        $files = $disk->files($this->backupDir);
        $backups = [];
        $totalSize = 0;

        foreach ($files as $file) {
            $filename = basename($file);
            $size = $disk->size($file);
            $totalSize += $size;
            
            $type = 'db';
            if (str_starts_with($filename, 'doc_snap_') || str_starts_with($filename, 'fildas-documents-')) {
                $type = 'doc';
            } elseif (str_starts_with($filename, 'fildas-full-snapshot-')) {
                $type = 'full';
            }

            $backups[] = [
                'filename'   => $filename,
                'type'       => $type,
                'size'       => $size,
                'created_at' => date('c', $disk->lastModified($file)),
            ];
        }

        usort($backups, fn($a, $b) => $b['created_at'] <=> $a['created_at']);

        return response()->json([
            'backups'    => $backups,
            'total_size' => $totalSize,
        ]);
    }

    public function store(Request $request, \App\Services\SystemBackupService $service)
    {
        $this->checkAccess($request);

        $type = $request->input('type', 'db'); // 'db', 'doc', 'full'
        set_time_limit(600); 

        $timestamp = now()->format('Y-m-d_His');
        $backupPath = null;
        $finalFilename = null;

        try {
            if ($type === 'db') {
                $tempSql = $service->generateSqlDump();
                if (!file_exists($tempSql)) {
                    throw new \Exception("SQL dump generation failed: file not found.");
                }

                $finalFilename = "snapshot_{$timestamp}.zip";
                $zipTempPath = tempnam(sys_get_temp_dir(), 'zip_');
                
                $zip = new \ZipArchive();
                if ($zip->open($zipTempPath, \ZipArchive::CREATE) !== true) {
                    throw new \Exception("Could not create temp ZIP file.");
                }

                if (!$zip->addFile($tempSql, "snapshot_{$timestamp}.sql")) {
                    $zip->close();
                    throw new \Exception("Failed to add SQL dump to ZIP.");
                }
                $zip->close();
                
                $backupPath = "{$this->backupDir}/{$finalFilename}";
                $this->disk()->put($backupPath, file_get_contents($zipTempPath));
                
                @unlink($tempSql);
                @unlink($zipTempPath);

            } elseif ($type === 'doc') {
                $tempZip = $service->generateDocumentZip();
                if (!file_exists($tempZip)) {
                    throw new \Exception("Document ZIP generation failed: file not found.");
                }

                $finalFilename = "fildas-documents-{$timestamp}.zip";
                $backupPath = "{$this->backupDir}/{$finalFilename}";
                
                $this->disk()->put($backupPath, file_get_contents($tempZip));
                @unlink($tempZip);

            } elseif ($type === 'full') {
                $tempSql = $service->generateSqlDump();
                $tempDocZip = $service->generateDocumentZip();
                
                if (!file_exists($tempSql) || !file_exists($tempDocZip)) {
                    throw new \Exception("Full snapshot components missing.");
                }

                $finalFilename = "fildas-full-snapshot-{$timestamp}.zip";
                $zipTempPath = tempnam(sys_get_temp_dir(), 'full_zip_');
                
                $zip = new \ZipArchive();
                if ($zip->open($zipTempPath, \ZipArchive::CREATE) !== true) {
                    throw new \Exception("Could not create temp FULL ZIP file.");
                }

                // Add the SQL dump
                $zip->addFile($tempSql, "database_snapshot.sql");
                // Add the Documents
                $zip->addFile($tempDocZip, "document_collection.zip");
                
                $zip->addFromString('readme.txt', "FilDAS Full Institutional Backup\nGenerated: " . now()->toDateTimeString() . "\nContains Database Image and Documents Archive.");
                $zip->close();
                
                $backupPath = "{$this->backupDir}/{$finalFilename}";
                $this->disk()->put($backupPath, file_get_contents($zipTempPath));
                
                @unlink($tempSql);
                @unlink($tempDocZip);
                @unlink($zipTempPath);
            }

            $finalSize = $this->disk()->size($backupPath);

            $this->logActivity('admin.backup_created', "Created system {$type} snapshot: {$finalFilename}", $request->user()->id, $request->user()->office_id, [
                'filename' => $finalFilename,
                'type'     => $type,
                'size'     => $finalSize,
            ]);

            return response()->json([
                'message' => 'System snapshot created successfully.',
                'backup'  => [
                    'filename'   => $finalFilename,
                    'type'       => $type === 'db' ? 'db' : ($type === 'doc' ? 'doc' : 'full'),
                    'size'       => $finalSize,
                    'created_at' => now()->toIso8601String(),
                ],
            ], 201);

        } catch (\Throwable $e) {
            \Log::error('Snapshot failed', [
                'type' => $type,
                'message' => $e->getMessage(),
            ]);
            return response()->json(['message' => 'Snapshot failed: ' . $e->getMessage()], 500);
        }
    }

    public function download(Request $request, $filename)
    {
        $this->checkAccess($request);

        $filename = basename($filename);
        $path = "{$this->backupDir}/{$filename}";

        if (!$this->disk()->exists($path)) {
            \Log::error("System Backup download failed: 404", ['filename' => $filename, 'expected_path' => $path]);
            abort(404, 'Backup file not found.');
        }

        \Log::info("System Backup download started", ['filename' => $filename]);

        $this->logActivity('admin.backup_downloaded', "Downloaded system backup: {$filename}", $request->user()->id, $request->user()->office_id, [
            'filename' => $filename
        ]);

        return $this->disk()->download($path);
    }

    public function destroy(Request $request, $filename)
    {
        $this->checkAccess($request);

        $filename = basename($filename);
        $path = "{$this->backupDir}/{$filename}";

        if (!$this->disk()->exists($path)) {
            return response()->json(['message' => 'Backup file not found.'], 404);
        }

        $this->disk()->delete($path);

        $this->logActivity('admin.backup_deleted', "Deleted system backup: {$filename}", $request->user()->id, $request->user()->office_id, [
            'filename' => $filename
        ]);

        return response()->json(['message' => 'Backup deleted successfully.']);
    }

    /**
     * Resilient file lookup across potential disks.
     */
    private function findFileAcrossDisks(?string $path): ?array
    {
        if (!$path) return null;

        $disks = ['local', 'public', 's3'];

        foreach ($disks as $diskName) {
            try {
                $disk = Storage::disk($diskName);
                if ($disk->exists($path)) {
                    return [
                        'disk'     => $diskName,
                        'abs_path' => $disk->path($path),
                    ];
                }
            } catch (\Throwable $e) {
                continue;
            }
        }

        return null;
    }

    /**
     * Clear all application tables before restoration.
     */
    private function wipeApplicationTables(): void
    {
        $dbConnection = config('database.default');
        $isMysql = in_array($dbConnection, ['mysql', 'mariadb'], true);
        $isPgsql = $dbConnection === 'pgsql';

        // Same skip list as store() to avoid breaking framework
        $skipTables = ['migrations', 'jobs', 'failed_jobs', 'cache', 'cache_locks',
                       'telescope_entries', 'telescope_entries_tags', 'telescope_monitoring'];

        if ($isMysql) {
            $tables = DB::select('SHOW TABLES');
            $tableNames = array_map(fn($t) => array_values((array)$t)[0], $tables);
            DB::statement('SET FOREIGN_KEY_CHECKS=0');
        } elseif ($isPgsql) {
            $tables = DB::select("SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename");
            $tableNames = array_column($tables, 'tablename');
            DB::statement('SET session_replication_role = \'replica\'');
        } else {
            $tables = DB::select("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
            $tableNames = array_column($tables, 'name');
        }

        foreach ($tableNames as $table) {
            if (in_array($table, $skipTables)) continue;
            
            \Log::info("Wiping table for restore: {$table}");
            
            if ($isMysql) {
                DB::statement("TRUNCATE TABLE `{$table}`");
            } elseif ($isPgsql) {
                DB::statement("TRUNCATE TABLE \"{$table}\" RESTART IDENTITY CASCADE");
            } else {
                DB::statement("DELETE FROM `{$table}`");
                DB::statement("DELETE FROM sqlite_sequence WHERE name='{$table}'");
            }
        }

        if ($isMysql) {
            DB::statement('SET FOREIGN_KEY_CHECKS=1');
        } elseif ($isPgsql) {
            DB::statement('SET session_replication_role = \'origin\'');
        }
    }

    public function restore(Request $request, $filename)
    {
        $this->checkAccess($request);

        set_time_limit(900); // 15 minutes for large/full restores

        $filename = basename($filename);
        $path = "{$this->backupDir}/{$filename}";

        if (!$this->disk()->exists($path)) {
            abort(404, 'Backup file not found.');
        }

        // Fetch to local disk
        $tempZip = tempnam(sys_get_temp_dir(), 'rest_');
        file_put_contents($tempZip, $this->disk()->get($path));

        $tempExtractDir = storage_path('app/temp/restore_' . time());
        if (!is_dir($tempExtractDir)) {
            mkdir($tempExtractDir, 0755, true);
        }

        try {
            $sqlFile = null;

            if (str_ends_with($filename, '.zip')) {
                $zip = new ZipArchive();
                if ($zip->open($tempZip) === true) {
                    
                    // ── Check if this is a "Full" backup ──────────────────────
                    $isFull = $zip->statName('database_snapshot.sql') !== false && 
                             $zip->statName('document_collection.zip') !== false;

                    if ($isFull) {
                        \Log::info("Restoring FULL Institutional Backup", ['file' => $filename]);
                        
                        // 1. Extract and Restore Database
                        $sqlContent = $zip->getFromName('database_snapshot.sql');
                        $tempSql = $tempExtractDir . '/db_full.sql';
                        file_put_contents($tempSql, $sqlContent);
                        $this->runSqlRestore($tempSql);
                        @unlink($tempSql);

                        // 2. Extract and Restore Documents
                        $docZipContent = $zip->getFromName('document_collection.zip');
                        $tempDocZip = $tempExtractDir . '/docs_full.zip';
                        file_put_contents($tempDocZip, $docZipContent);
                        
                        $this->internalRestoreDocuments($tempDocZip);
                        @unlink($tempDocZip);

                        $zip->close();
                        @unlink($tempZip);
                        File::deleteDirectory($tempExtractDir);

                        $this->logActivity('admin.system_restored', "Performed FULL institutional restore from: {$filename}", $request->user()->id, $request->user()->office_id, [
                            'filename' => $filename,
                            'type'     => 'full'
                        ]);

                        $this->notifyAdminsOfRestore($request->user(), 'Full System (DB + Documents)', $filename);

                        return response()->json(['message' => 'Full institutional backup restored successfully. Database and documents synchronized.']);
                    }

                    // ── Normal ZIP fallback ───────────────────────────────────
                    $zip->extractTo($tempExtractDir);
                    $zip->close();

                    $extractedFiles = scandir($tempExtractDir);
                    foreach ($extractedFiles as $f) {
                        if (str_ends_with($f, '.sql') || str_ends_with($f, '.sqlite')) {
                            $sqlFile = $tempExtractDir . '/' . $f;
                            break;
                        }
                    }
                }
            } else {
                $sqlFile = $tempZip;
            }

            if (!$sqlFile || !file_exists($sqlFile)) {
                throw new \Exception('No valid SQL or SQLite file found in backup.');
            }

            $this->runSqlRestore($sqlFile);

            // Cleanup
            @unlink($tempZip);
            File::deleteDirectory($tempExtractDir);

            $this->logActivity('admin.system_restored', "Performed database restore from: {$filename}", $request->user()->id, $request->user()->office_id, [
                'filename' => $filename,
                'type'     => 'db'
            ]);

            $this->notifyAdminsOfRestore($request->user(), 'Database Only', $filename);

            return response()->json([
                'message' => 'System restored successfully. You may need to refresh the page.',
            ]);

        } catch (\Throwable $e) {
            @unlink($tempZip);
            if (is_dir($tempExtractDir)) {
                File::deleteDirectory($tempExtractDir);
            }
            \Log::error('Restore failed', ['filename' => $filename, 'message' => $e->getMessage()]);
            return response()->json(['message' => 'Restore failed: ' . $e->getMessage()], 500);
        }
    }

    private function runSqlRestore($sqlPath)
    {
        $dbConnection = config('database.default');

        if ($dbConnection === 'sqlite' && str_ends_with($sqlPath, '.sqlite')) {
            $dbPath = config('database.connections.sqlite.database');
            copy($sqlPath, $dbPath);
        } else {
            $this->wipeApplicationTables();
            $sql = file_get_contents($sqlPath);
            
            if ($dbConnection === 'mysql') {
                DB::statement('SET FOREIGN_KEY_CHECKS=0');
            } elseif ($dbConnection === 'pgsql') {
                DB::statement('SET session_replication_role = \'replica\'');
            }

            DB::unprepared($sql);

            if ($dbConnection === 'mysql') {
                DB::statement('SET FOREIGN_KEY_CHECKS=1');
            } elseif ($dbConnection === 'pgsql') {
                DB::statement('SET session_replication_role = \'origin\'');
            }
        }
    }

    private function internalRestoreDocuments($zipPath)
    {
        // This logic is mostly copied from restoreDocuments but uses a direct path
        $zip = new ZipArchive();
        if ($zip->open($zipPath) !== true) {
            throw new \Exception('Failed to open document collection ZIP.');
        }

        $extractDir = storage_path('app/temp/internal_restore_' . time());
        mkdir($extractDir, 0755, true);
        $zip->extractTo($extractDir);
        $zip->close();

        $manifestPath = $extractDir . '/manifest.json';
        if (!file_exists($manifestPath)) {
            File::deleteDirectory($extractDir);
            throw new \Exception('Document collection missing manifest.json');
        }

        $manifest = json_decode(file_get_contents($manifestPath), true);
        foreach ($manifest as $entryName => $originalPath) {
            $localSource = $extractDir . '/' . $entryName;
            if (file_exists($localSource)) {
                // Restore to default disk
                Storage::disk()->put($originalPath, file_get_contents($localSource));
            }
        }

        File::deleteDirectory($extractDir);
    }

    public function upload(Request $request)
    {
        $this->checkAccess($request);

        $request->validate([
            'file' => 'required|file|max:51200', // 50MB max for now
        ]);

        $file = $request->file('file');
        $filename = $file->getClientOriginalName();

        // Security: ensure it's a backup file and not a malicious script
        $ext = strtolower($file->getClientOriginalExtension());
        if (!in_array($ext, ['zip', 'sql', 'sqlite'])) {
            return response()->json(['message' => 'Invalid backup file type. Use .zip, .sql, or .sqlite'], 422);
        }

        // Avoid overwriting by appending timestamp if exists
        if ($this->disk()->exists("{$this->backupDir}/{$filename}")) {
            $nameOnly = pathinfo($filename, PATHINFO_FILENAME);
            $filename = $nameOnly . '_' . time() . '.' . $ext;
        }

        $this->disk()->putFileAs($this->backupDir, $file, $filename);

        $this->logActivity('admin.backup_uploaded', "Uploaded external backup file: {$filename}", $request->user()->id, $request->user()->office_id, [
            'filename' => $filename
        ]);

        return response()->json([
            'message' => 'Backup uploaded successfully.',
            'filename' => $filename,
        ]);
    }

    public function restoreDocuments(Request $request, $filename)
    {
        $this->checkAccess($request);

        set_time_limit(600); // 10 minutes for restoration

        $filename = basename($filename);
        $path = "{$this->backupDir}/{$filename}";

        if (!$this->disk()->exists($path)) {
            abort(404, 'Backup file not found.');
        }

        // Fetch to a real local temp file
        $tempZip = tempnam(sys_get_temp_dir(), 'rest_docs_');
        file_put_contents($tempZip, $this->disk()->get($path));

        if (!str_ends_with($filename, '.zip')) {
            @unlink($tempZip);
            return response()->json(['message' => 'Only .zip document backups can be auto-restored.'], 422);
        }

        $zip = new ZipArchive();
        if ($zip->open($tempZip) !== true) {
            @unlink($tempZip);
            return response()->json(['message' => 'Failed to open ZIP file.'], 500);
        }

        $tempExtractDir = storage_path('app/temp/restore_docs_' . time());
        if (!is_dir($tempExtractDir)) {
            mkdir($tempExtractDir, 0755, true);
        }

        try {
            $zip->extractTo($tempExtractDir);
            $zip->close();

            $manifestPath = $tempExtractDir . '/manifest.json';
            if (!file_exists($manifestPath)) {
                throw new \Exception('This backup does not contain a manifest.json. It cannot be auto-restored.');
            }

            $manifest = json_decode(file_get_contents($manifestPath), true);
            if (!is_array($manifest)) {
                throw new \Exception('Invalid manifest.json format.');
            }

            $restoredCount = 0;
            $failedCount = 0;

            \Log::info("Starting Document Restoration", [
                'filename' => $filename,
                'target_disk' => config('filesystems.default'),
                'total_entries' => count($manifest)
            ]);

            foreach ($manifest as $zipPath => $systemPath) {
                $sourceFile = $tempExtractDir . '/' . ltrim($zipPath, '/');
                
                if (file_exists($sourceFile)) {
                    // Push to standard storage (could be R2 or local)
                    $this->disk()->put($systemPath, file_get_contents($sourceFile));
                    $restoredCount++;
                } else {
                    \Log::warning("Restore: File missing in ZIP despite manifest", ['path' => $zipPath]);
                    $failedCount++;
                }
            }

            @unlink($tempZip);
            File::deleteDirectory($tempExtractDir);

            $this->logActivity('admin.documents_restored', "Performed document restore from: {$filename}", $request->user()->id, $request->user()->office_id, [
                'filename' => $filename,
                'restored_count' => $restoredCount,
                'failed_count' => $failedCount
            ]);

            $this->notifyAdminsOfRestore($request->user(), 'Documents Only', $filename);

            return response()->json([
                'message' => 'Document restoration completed.',
                'restored' => $restoredCount,
                'failed' => $failedCount,
            ]);

        } catch (\Throwable $e) {
            @unlink($tempZip);
            if (is_dir($tempExtractDir)) {
                File::deleteDirectory($tempExtractDir);
            }

            \Log::error('Document Restore failed', [
                'filename' => $filename,
                'message' => $e->getMessage(),
            ]);

            return response()->json([
                'message' => 'Restoration failed: ' . $e->getMessage(),
            ], 500);
        }
    }

    private function notifyAdminsOfRestore($actor, $type, $filename)
    {
        $admins = User::whereHas('role', function ($q) {
            $q->whereIn('name', ['Admin', 'SysAdmin']);
        })->get();

        $now = now()->format('F j, Y g:i A');
        $notifTitle = "CRITICAL: System Restore Performed";
        $notifBody = "A {$type} restore was performed by {$actor->full_name} using backup file: {$filename}. System state has been reverted.";

        foreach ($admins as $admin) {
            // 1. In-App Notification
            Notification::create([
                'user_id' => $admin->id,
                'event'   => 'admin.system_restored',
                'title'   => $notifTitle,
                'body'    => $notifBody,
                'meta'    => [
                    'actor_id' => $actor->id,
                    'filename' => $filename,
                    'type'     => $type,
                    'timestamp' => $now
                ]
            ]);

            // 2. Email (Critical)
            try {
                Mail::to($admin->email)->queue(new \App\Mail\WorkflowNotificationMail(
                    recipientName: $admin->full_name,
                    notifTitle: $notifTitle,
                    notifBody: $notifBody,
                    documentTitle: 'System Integrity',
                    documentStatus: 'RESTORED',
                    isReject: true, // Red styling
                    actorName: $actor->full_name,
                    documentId: null,
                    appUrl: rtrim(env('FRONTEND_URL', config('app.url')), '/'),
                    appName: config('app.name', 'FilDAS'),
                    cardLabel: 'Critical'
                ));
            } catch (\Throwable $e) {}
        }
    }
}
