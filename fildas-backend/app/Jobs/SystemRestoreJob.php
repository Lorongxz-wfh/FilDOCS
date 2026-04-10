<?php

namespace App\Jobs;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Cache;
use App\Models\User;
use App\Models\Notification;
use ZipArchive;

class SystemRestoreJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $timeout = 1800; // 30 minutes
    private $filename;
    private $path;
    private $actorId;
    private $officeId;

    public function __construct($filename, $path, $actorId, $officeId)
    {
        $this->filename = $filename;
        $this->path = $path;
        $this->actorId = $actorId;
        $this->officeId = $officeId;
    }

    public function handle()
    {
        ini_set('memory_limit', '2048M');
        set_time_limit(1800);

        $statusKey = "restore_status_{$this->actorId}";
        Cache::put($statusKey, ['status' => 'running', 'message' => "Starting restoration of {$this->filename}...", 'progress' => 10], 1800);

        $disk = Storage::disk(config('filesystems.default') === 's3' ? 's3' : 'local');
        $tempZip = tempnam(sys_get_temp_dir(), 'rest_final_');
        
        Log::info("Async Restore Started: " . $this->filename);

        try {
            // 1. Download safely
            $readStream = $disk->readStream($this->path);
            if (!$readStream) throw new \Exception("Could not open read stream for backup file.");
            
            $writeStream = fopen($tempZip, 'w+');
            stream_copy_to_stream($readStream, $writeStream);
            fclose($readStream);
            fclose($writeStream);

            Cache::put($statusKey, ['status' => 'running', 'message' => "Download complete. Extracting archive...", 'progress' => 30], 1800);

            $tempExtractDir = storage_path('app/temp/restore_f_' . time());
            if (!is_dir($tempExtractDir)) mkdir($tempExtractDir, 0755, true);

            $zip = new ZipArchive();
            if ($zip->open($tempZip) === true) {
                
                // Flexible File Detection (Case Insensitive)
                $sqlFileInZip = null;
                $docZipInZip = null;

                for ($i = 0; $i < $zip->numFiles; $i++) {
                    $stat = $zip->statIndex($i);
                    $name = strtolower($stat['name']);
                    if (str_ends_with($name, '.sql')) $sqlFileInZip = $stat['name'];
                    if (str_ends_with($name, 'document_collection.zip')) $docZipInZip = $stat['name'];
                }

                if ($sqlFileInZip) {
                    Cache::put($statusKey, ['status' => 'running', 'message' => "Wiping old data and restoring database...", 'progress' => 50], 1800);
                    
                    $tempSql = $tempExtractDir . '/restore.sql';
                    $zip->extractTo($tempExtractDir, [$sqlFileInZip]);
                    rename($tempExtractDir . '/' . $sqlFileInZip, $tempSql);
                    
                    $this->runSqlRestore($tempSql);
                    @unlink($tempSql);
                }

                if ($docZipInZip) {
                    Cache::put($statusKey, ['status' => 'running', 'message' => "Synchronizing documents to Cloud Storage...", 'progress' => 80], 1800);
                    
                    $tempDocZip = $tempExtractDir . '/docs.zip';
                    $zip->extractTo($tempExtractDir, [$docZipInZip]);
                    rename($tempExtractDir . '/' . $docZipInZip, $tempDocZip);
                    
                    $this->internalRestoreDocuments($tempDocZip);
                    @unlink($tempDocZip);
                }
                
                $zip->close();
            }

            // Final Cleanup
            @unlink($tempZip);
            File::deleteDirectory($tempExtractDir);

            Cache::put($statusKey, ['status' => 'completed', 'message' => "Restoration finished successfully.", 'progress' => 100], 1800);

            $actor = User::find($this->actorId);
            $this->notifyAdminsOfCompletion($actor, $this->filename);

        } catch (\Throwable $e) {
            Log::error("Async Restore Failed", ['file' => $this->filename, 'error' => $e->getMessage()]);
            Cache::put($statusKey, ['status' => 'failed', 'message' => $e->getMessage(), 'progress' => 0], 1800);
            @unlink($tempZip);
        }
    }

    private function runSqlRestore($sqlPath)
    {
        $dbConnection = config('database.default');
        $this->wipeApplicationTables();

        if ($dbConnection === 'sqlite') {
            // SQLite is handled differently by binary copy if it's a raw DB file, 
            // but we usually dump SQL.
            if (str_ends_with($sqlPath, '.sqlite')) {
                copy($sqlPath, config('database.connections.sqlite.database'));
                return;
            }
        }

        if ($dbConnection === 'mysql') {
            DB::statement('SET FOREIGN_KEY_CHECKS=0');
        }

        $handle = fopen($sqlPath, "r");
        $query = "";
        $isPgsql = config('database.default') === 'pgsql';

        Log::info("Executing SQL restoration buffer (Translation Mode: " . ($isPgsql ? 'ON' : 'OFF') . ")");

        if ($handle) {
            while (($line = fgets($handle)) !== false) {
                $trimmedLine = trim($line);
                if (empty($trimmedLine) || str_starts_with($trimmedLine, '--') || str_starts_with($trimmedLine, '/*')) continue;
                
                // ── Forbidden Command Filtering (Managed Postgres Resilience) ──
                $lowerLine = strtolower($trimmedLine);
                $isForbidden = str_contains($lowerLine, 'session_replication_role') || 
                               str_contains($lowerLine, 'owner to') || 
                               str_contains($lowerLine, 'pg_catalog.set_config') ||
                               str_contains($lowerLine, 'create extension');

                if ($isForbidden) {
                    if (str_ends_with(trim($trimmedLine), ';')) {
                        $query = ""; // Clear buffer if the forbidden command was a single line
                    }
                    continue; 
                }

                // ── MySQL to Postgres Translation (Still useful for mixed envs) ──
                if ($isPgsql) {
                    $line = str_replace('`', '"', $line);
                    $line = preg_replace('/ENGINE=[^; ]+/', '', $line);
                }

                $query .= $line;
                
                // Check for statement end with flexibility
                if (str_ends_with(trim($trimmedLine), ';')) {
                    try {
                        // Strip whitespace and check if we have anything to run
                        $execQuery = trim($query);
                        if (!empty($execQuery)) {
                            DB::unprepared($execQuery);
                        }
                    } catch (\Throwable $e) {
                        $msg = $e->getMessage();
                        // Ignore standard 'already exists' or 'permission' errors that aren't fatal
                        $isIgnorable = str_contains($msg, 'already exists') || 
                                       str_contains($msg, 'permission denied') ||
                                       str_contains($msg, 'must be owner');
                                       
                        if (!$isIgnorable) {
                           Log::warning("SQL Error: " . $msg, ['query' => substr($query, 0, 100)]);
                        }
                    }
                    $query = "";
                }
            }
            fclose($handle);
        }

        if ($dbConnection === 'mysql') {
            DB::statement('SET FOREIGN_KEY_CHECKS=1');
        }
    }

    private function wipeApplicationTables()
    {
        $dbConnection = config('database.default');
        $isMysql = in_array($dbConnection, ['mysql', 'mariadb'], true);
        $isPgsql = $dbConnection === 'pgsql';

        $skipTables = ['migrations', 'jobs', 'failed_jobs', 'cache', 'cache_locks', 'telescope_entries', 'telescope_entries_tags', 'telescope_monitoring'];

        if ($isMysql) {
            $tables = DB::select('SHOW TABLES');
            $tableNames = array_map(fn($t) => array_values((array)$t)[0], $tables);
            DB::statement('SET FOREIGN_KEY_CHECKS=0');
        } elseif ($isPgsql) {
            $tables = DB::select("SELECT tablename FROM pg_tables WHERE schemaname = 'public'");
            $tableNames = array_column($tables, 'tablename');
        } else {
            $tables = DB::select("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
            $tableNames = array_column($tables, 'name');
        }

        foreach ($tableNames as $table) {
            if (in_array($table, $skipTables)) continue;
            try {
                if ($isMysql) DB::statement("DROP TABLE IF EXISTS `{$table}` CASCADE"); // MySQL doesn't use CASCADE but just in case
                elseif ($isPgsql) DB::statement("DROP TABLE IF EXISTS \"{$table}\" CASCADE");
                else DB::statement("DROP TABLE IF EXISTS `{$table}`");
            } catch (\Throwable $e) {}
        }

        if ($isMysql) DB::statement('SET FOREIGN_KEY_CHECKS=1');
    }

    private function internalRestoreDocuments($zipPath)
    {
        $zip = new ZipArchive();
        if ($zip->open($zipPath) !== true) return;

        $extractDir = storage_path('app/temp/restore_docs_' . time());
        mkdir($extractDir, 0755, true);
        $zip->extractTo($extractDir);
        $zip->close();

        $manifestPath = $extractDir . '/manifest.json';
        if (file_exists($manifestPath)) {
            $manifest = json_decode(file_get_contents($manifestPath), true);
            foreach ($manifest as $entryName => $originalPath) {
                $localSource = $extractDir . '/' . $entryName;
                if (file_exists($localSource)) {
                    $stream = fopen($localSource, 'r');
                    // Ensure the target disk is used correctly
                    Storage::disk(config('filesystems.default'))->put($originalPath, $stream);
                    if (is_resource($stream)) fclose($stream);
                }
            }
        }
        File::deleteDirectory($extractDir);
    }

    private function notifyAdminsOfCompletion($actor, $filename)
    {
        $admins = User::whereHas('role', function ($q) {
            $q->whereIn('name', ['Admin', 'SysAdmin']);
        })->get();

        foreach ($admins as $admin) {
            Notification::create([
                'user_id' => $admin->id,
                'event'   => 'admin.system_restored',
                'title'   => 'SUCCESS: System Identity Restored',
                'body'    => "The restoration of {$filename} has completed successfully. All data and documents are now live.",
                'meta'    => ['actor' => $actor ? $actor->full_name : 'System', 'file' => $filename]
            ]);
        }
    }
}
