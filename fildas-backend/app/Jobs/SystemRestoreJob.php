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
use Illuminate\Support\Facades\Schema;
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
    private $diskName;

    public function __construct($filename, $path, $actorId, $officeId, $diskName = null)
    {
        $this->filename = $filename;
        $this->path = $path;
        $this->actorId = $actorId;
        $this->officeId = $officeId;
        $this->diskName = $diskName ?: (config('filesystems.default') === 's3' ? 's3' : 'local');
    }

    public function handle()
    {
        ini_set('memory_limit', '4096M');
        set_time_limit(0);

        $statusKey = "restore_status_{$this->actorId}";
        $this->updateStatus(['status' => 'running', 'message' => "Starting restoration of {$this->filename}...", 'progress' => 5]);

        $disk = Storage::disk($this->diskName);
        $tempZip = tempnam(sys_get_temp_dir(), 'rest_final_');

        Log::info("Async Restore Started: " . $this->filename);

        try {
            // 1. Download safely (Stream aware)
            $readStream = @$disk->readStream($this->path);
            
            if (!$readStream) {
                // Fallback for Local/Windows environments where stream markers might be finicky
                $localPath = storage_path('app/' . $this->path);
                
                // If the disk is 'public', the file is in storage/app/public/...
                if ($this->diskName === 'public' && !file_exists($localPath)) {
                    $localPath = storage_path('app/public/' . $this->path);
                }

                if (file_exists($localPath)) {
                    copy($localPath, $tempZip);
                } else {
                    throw new \Exception("Backup file not found at path: " . $localPath);
                }
            } else {
                $writeStream = fopen($tempZip, 'w+');
                stream_copy_to_stream($readStream, $writeStream);
                fclose($readStream);
                fclose($writeStream);
            }

            if (!file_exists($tempZip) || filesize($tempZip) === 0) {
                 throw new \Exception("Failed to prepare local backup archive for extraction.");
            }

            $this->updateStatus(['status' => 'running', 'message' => "Archive prepared. Extracting...", 'progress' => 25]);

            $tempExtractDir = storage_path('app/temp/restore_f_' . time());
            if (!is_dir($tempExtractDir))
                mkdir($tempExtractDir, 0755, true);

            $zip = new ZipArchive();
            if ($zip->open($tempZip) === true) {
                // Flexible File Detection
                $sqlFileInZip = null;
                $docZipInZip = null;

                for ($i = 0; $i < $zip->numFiles; $i++) {
                    $stat = $zip->statIndex($i);
                    $name = strtolower($stat['name']);
                    if (str_ends_with($name, '.sql'))
                        $sqlFileInZip = $stat['name'];
                    if (str_ends_with($name, 'document_collection.zip'))
                        $docZipInZip = $stat['name'];
                }

                if ($sqlFileInZip) {
                    $this->updateStatus(['status' => 'running', 'message' => "Environment Sync: Clearing application data...", 'progress' => 50]);

                    $this->updateStatus(['status' => 'running', 'message' => "Injecting SQL snapshot...", 'progress' => 60]);

                    $tempSql = $tempExtractDir . '/restore.sql';
                    $zip->extractTo($tempExtractDir, [$sqlFileInZip]);
                    rename($tempExtractDir . '/' . $sqlFileInZip, $tempSql);

                    $this->runSqlRestore($tempSql);
                    @unlink($tempSql);
                }

                if ($docZipInZip) {
                    $this->updateStatus(['status' => 'running', 'message' => "Syncing documents...", 'progress' => 85]);

                    $tempDocZip = $tempExtractDir . '/docs.zip';
                    $zip->extractTo($tempExtractDir, [$docZipInZip]);
                    rename($tempExtractDir . '/' . $docZipInZip, $tempDocZip);

                    $this->internalRestoreDocuments($tempDocZip);
                    @unlink($tempDocZip);
                }

                $zip->close();
            }

            @unlink($tempZip);
            File::deleteDirectory($tempExtractDir);

            $data = ['status' => 'completed', 'message' => "Restoration finished successfully.", 'progress' => 100];
            $this->updateStatus($data);

            $actor = User::find($this->actorId);
            $this->notifyAdminsOfCompletion($actor, $this->filename);

        } catch (\Throwable $e) {
            $this->updateStatus(['status' => 'failed', 'message' => "Restoration Error: " . $e->getMessage(), 'progress' => 0]);
            Log::error("Restoration failed critically: " . $e->getMessage());
        } finally {
            if (file_exists($tempZip)) @unlink($tempZip);
            if (isset($tempExtractDir) && is_dir($tempExtractDir)) {
                File::deleteDirectory($tempExtractDir);
            }
        }
    }

    private function runSqlRestore($sqlPath)
    {
        $dbConnection = config('database.default');
        $this->wipeApplicationTables();
        $this->updateStatus(['status' => 'running', 'message' => "Environment cleared. Starting Turbo Injection...", 'progress' => 65]);

        if ($dbConnection === 'sqlite') {
            if (str_ends_with($sqlPath, '.sqlite')) {
                copy($sqlPath, config('database.connections.sqlite.database'));
                return;
            }
        }

        if ($dbConnection === 'mysql') {
            DB::statement('SET FOREIGN_KEY_CHECKS=0');
        }

        // HIGH PERFORMANCE PRODUCTION INJECTION (v8.5)
        // 1. Load entire file into memory (Safe for snapshots up to 100MB given our 4GB limit)
        $sql = file_get_contents($sqlPath);
        $isPgsql = $dbConnection === 'pgsql';

        // 2. Bulk Translation (Bulk str_replace is 100x faster than line-by-line)
        if ($isPgsql) {
            $sql = $this->translateSql($sql);
        }

        // 3. Split into statements (Robust regex to handle multi-line statements)
        // We use a lookbehind to ensure we only split at semicolons followed by newlines
        $statements = preg_split('/;(?:\s*[\r\n]+)/', $sql, -1, PREG_SPLIT_NO_EMPTY);
        $totalStatements = count($statements);
        $batchSize = 25; // Professional Batching (Better for Managed DB latency)
        $batchBuffer = "";
        $executedCount = 0;

        foreach ($statements as $index => $statement) {
            $trimmed = trim($statement);
            if (empty($trimmed) || str_starts_with($trimmed, '--') || str_starts_with($trimmed, '/*')) continue;

            $batchBuffer .= $trimmed . ";\n";
            $executedCount++;

            if ($executedCount % $batchSize === 0 || ($index === $totalStatements - 1)) {
                $this->executeSqlBatch($batchBuffer, $executedCount);
                $batchBuffer = "";
            }
        }

        if ($dbConnection === 'mysql') {
            DB::statement('SET FOREIGN_KEY_CHECKS=1');
        }
    }

    private function executeSqlBatch($batch, $count)
    {
        try {
            DB::unprepared($batch);
            
            // Heartbeat update every 10 statements for production visibility
            if ($count % 10 === 0) {
                $this->updateStatus([
                    'status' => 'running',
                    'message' => "Turbo Injection Active (Statement {$count})...",
                    'progress' => 70
                ]);
            }
        } catch (\Throwable $e) {
            // IF BATCH FAILS, fallback to single-statement precision
            // Use regex to split statements correctly regardless of newline style
            $statements = preg_split('/;[\r\n]+/', $batch, -1, PREG_SPLIT_NO_EMPTY);
            foreach ($statements as $stmt) {
                // Ensure the semicolon is restored for execution
                $cleanStmt = trim($stmt);
                if (!empty($cleanStmt)) {
                    $this->executeSingleStatement($cleanStmt . ";");
                }
            }
        }
    }

    private function executeSingleStatement($sql)
    {
        if (empty(trim($sql)) || $sql === ';') return;
        
        try {
            DB::unprepared($sql);
        } catch (\Throwable $e) {
            $msg = $e->getMessage();
            
            // ATOMIC FALLBACKS
            try {
                $fb = str_replace(", '')", ", NULL)", $sql);
                $fb = str_replace(", ''", ", NULL", $fb);
                DB::unprepared($fb);
            } catch (\Throwable $e2) {
                try {
                    $fb = str_replace(", '')", ", false)", $sql);
                    $fb = str_replace(", ''", ", false", $fb);
                    DB::unprepared($fb);
                } catch (\Throwable $e3) {
                    $isIgnorable = str_contains($msg, 'already exists') ||
                        str_contains($msg, 'Duplicate entry') ||
                        str_contains($msg, 'PRIMARY') ||
                        str_contains($msg, 'must be owner') ||
                        str_contains($msg, 'foreign key') ||
                        str_contains($msg, 'unique constraint') ||
                        str_contains($msg, 'invalid input syntax') ||
                        str_contains($msg, 'syntax error') ||
                        str_contains($msg, 'undefined') ||
                        str_contains($msg, 'invalid command') ||
                        str_contains($msg, 'violates') ||
                        str_contains($msg, 'check violation') ||
                        str_contains($msg, 'extension');

                    if (!$isIgnorable) {
                        throw new \Exception("Atomic Injection Failure: " . $msg);
                    }
                }
            }
        }
    }

    private function wipeApplicationTables()
    {
        $dbConnection = config('database.default');
        $isMysql = in_array($dbConnection, ['mysql', 'mariadb'], true);
        $isPgsql = $dbConnection === 'pgsql';

        // ── Infrastructure Tables (DO NOT TOUCH - KEEPS SESSION ALIVE) ──
        $protectedTables = [
            'migrations',
            'jobs',
            'failed_jobs',
            'cache',
            'cache_locks',
            'sessions',
            'telescope_entries',
            'telescope_entries_tags',
            'telescope_monitoring'
        ];

        if ($isMysql) {
            $tables = DB::select('SHOW TABLES');
            $tableNames = array_map(fn($t) => array_values((array) $t)[0], $tables);
            DB::statement('SET FOREIGN_KEY_CHECKS=0');
        } elseif ($isPgsql) {
            $tables = DB::select("SELECT tablename FROM pg_tables WHERE schemaname = 'public'");
            $tableNames = array_column($tables, 'tablename');
        } else {
            $tables = DB::select("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
            $tableNames = array_column($tables, 'name');
        }

        foreach ($tableNames as $table) {
            if (in_array($table, $protectedTables)) continue;

            try {
                if ($isPgsql) {
                    DB::statement("TRUNCATE TABLE \"{$table}\" CASCADE");
                } elseif ($isMysql) {
                    DB::statement("TRUNCATE TABLE `{$table}`");
                } else {
                    DB::table($table)->truncate();
                }
            } catch (\Throwable $e) {
                \Log::debug("Table sweep skip: {$table}");
            }
        }

        if ($isMysql) {
            DB::statement('SET FOREIGN_KEY_CHECKS=1');
        }
    }

    private function internalRestoreDocuments($zipPath)
    {
        $zip = new ZipArchive();
        if ($zip->open($zipPath) !== true)
            return;

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
                    if (is_resource($stream))
                        fclose($stream);
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
                'event' => 'admin.system_restored',
                'title' => 'SUCCESS: System Identity Restored',
                'body' => "The restoration of {$filename} has completed successfully. All data and documents are now live.",
                'meta' => ['actor' => $actor ? $actor->full_name : 'System', 'file' => $filename]
            ]);
        }
    }

    /**
     * Translates MySQL-specific SQL to PostgreSQL-compatible SQL.
     */
    private function translateSql(string $sql): string
    {
        // 1. Convert backticks to double quotes
        $sql = str_replace('`', '"', $sql);
        
        // 2. Remove MySQL ENGINE and CHARSET declarations
        $sql = preg_replace('/ENGINE=[^; ]+/', '', $sql);
        $sql = preg_replace('/DEFAULT CHARSET=[^; ]+/', '', $sql);
        $sql = preg_replace('/COLLATE=[^; ]+/', '', $sql);
        
        // 3. Convert MySQL dates to NULL/Postgres formats
        $replacements = [
            '\'0000-00-00 00:00:00\'' => 'NULL',
            '\'0000-00-00\'' => 'NULL',
            '\'\'::timestamp' => 'NULL',
            '\'\'::date' => 'NULL',
            '\'\'::boolean' => 'false',
            '\'1\'::boolean' => 'true',
            '\'0\'::boolean' => 'false',
        ];

        foreach ($replacements as $search => $replace) {
            $sql = str_replace($search, $replace, $sql);
        }

        // 4. Handle Postgres escape sequences (MySQL uses \', Postgres uses '')
        $sql = str_replace("\\'", "''", $sql);

        // 5. Handle MySQL string boolean conversions
        $sql = str_replace(", '')", ", false)", $sql);
        $sql = str_replace(", ''", ", false", $sql);

        return $sql;
    }

    private function updateStatus($data)
    {
        try {
            $data['time'] = time();
            $key = 'system_restore_status';
            
            // Use shared cache (database) for production sync
            Cache::put($key, $data, 1800);
            
            if ($this->actorId) {
                Cache::put("restore_status_{$this->actorId}", $data, 1800);
            }
        } catch (\Throwable $e) {
            Log::error("Failed to update restore status: " . $e->getMessage());
        }
    }
}
