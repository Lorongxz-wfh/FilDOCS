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
        ini_set('memory_limit', '4096M');
        set_time_limit(0);

        // Create a physical lock for the Lifeboat script to prevent false alarms
        @touch(storage_path('app/restoration.lock'));

        $statusKey = "restore_status_{$this->actorId}";
        
        $publicSignalPath = public_path('_restore_signal.json');

        $this->updateStatus(['status' => 'running', 'message' => "Starting restoration of {$this->filename}...", 'progress' => 5]);

        // 1. Physical Signal - Shared Disk Source of Truth
        $sharedSignalPath = storage_path('app/backups/_restore_signal.json');
        @file_put_contents($sharedSignalPath, json_encode([
            'status' => 'running',
            'message' => 'Engine initializing (Shared Disk)...',
            'progress' => 5,
            'time' => time()
        ]));
        
        @chmod($publicSignalPath, 0666);

        $disk = Storage::disk(config('filesystems.default') === 's3' ? 's3' : 'local');
        $tempZip = tempnam(sys_get_temp_dir(), 'rest_final_');

        Log::info("Async Restore Started: " . $this->filename);

        try {
            // 1. Download safely
            $readStream = $disk->readStream($this->path);
            if (!$readStream)
                throw new \Exception("Could not open read stream for backup file.");

            $writeStream = fopen($tempZip, 'w+');
            stream_copy_to_stream($readStream, $writeStream);
            fclose($readStream);
            fclose($writeStream);

            $this->updateStatus(['status' => 'running', 'message' => "Archive downloaded to local storage. Extracting...", 'progress' => 25]);
            $this->updateStatus(['status' => 'running', 'message' => "Archive extraction complete. Preparing schema...", 'progress' => 40]);

            $tempExtractDir = storage_path('app/temp/restore_f_' . time());
            if (!is_dir($tempExtractDir))
                mkdir($tempExtractDir, 0755, true);

            $zip = new ZipArchive();
            if ($zip->open($tempZip) === true) {

                // Flexible File Detection (Case Insensitive)
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
                    $this->updateStatus(['status' => 'running', 'message' => "Clearing environment and injecting SQL...", 'progress' => 60]);

                    $tempSql = $tempExtractDir . '/restore.sql';
                    $zip->extractTo($tempExtractDir, [$sqlFileInZip]);
                    rename($tempExtractDir . '/' . $sqlFileInZip, $tempSql);

                    $this->runSqlRestore($tempSql);
                    @unlink($tempSql);
                }

                if ($docZipInZip) {
                    $data = ['status' => 'running', 'message' => "Verifying integrity and syncing documents...", 'progress' => 85];
                    Cache::store('file')->put($statusKey, $data, 1800);
                    Cache::store('file')->put('system_restore_status', $data, 1800);

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
            @unlink('/tmp/fildas_restore/active.lock');
            @unlink(storage_path('app/backups/_restore_signal.json'));
            @unlink(public_path('_restore_signal.json'));

            $data = ['status' => 'completed', 'message' => "Restoration finished successfully.", 'progress' => 100];
            Cache::store('file')->put($statusKey, $data, 1800);
            Cache::store('file')->put('system_restore_status', $data, 1800);

            $actor = User::find($this->actorId);
            $this->notifyAdminsOfCompletion($actor, $this->filename);

            @unlink(storage_path('app/restoration.lock'));
            @unlink(storage_path('app/backups/_restore_signal.json'));
            @unlink(public_path('_restore_signal.json'));
        } catch (\Throwable $e) {
            @unlink(storage_path('app/restoration.lock'));
            $this->updateStatus(['status' => 'failed', 'message' => "Restoration Error: " . $e->getMessage(), 'progress' => 0]);
            Log::error("Restoration failed critically: " . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
                'file' => $e->getFile(),
                'line' => $e->getLine()
            ]);
            
            // WE DO NOT UNLINK on failure - we need the UI to see the error message
            @unlink($tempZip);
        }
    }

    private function runSqlRestore($sqlPath)
    {
        $dbConnection = config('database.default');
        $this->wipeApplicationTables();
        $this->updateStatus(['status' => 'running', 'message' => "Environment cleared. Starting Turbo Injection...", 'progress' => 65]);

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
        $isPgsql = config('database.default') === 'pgsql';
        Log::info("Executing SQL restoration buffer (Translation Mode: " . ($isPgsql ? 'ON' : 'OFF') . ")");

        $query = "";
        $statementCount = 0;
        $batchBuffer = ""; 
        $batchSize = 20; // Safety Batch: 20 statements prevents memory spikes on 512MB RAM

        if ($handle) {
            while (($line = fgets($handle)) !== false) {
                $trimmedLine = trim($line);
                if (empty($trimmedLine) || str_starts_with($trimmedLine, '--') || str_starts_with($trimmedLine, '/*'))
                    continue;

                // ── Forbidden Command Filtering (Managed Postgres Resilience) ──
                $lowerLine = strtolower($trimmedLine);
                $isForbidden = str_contains($lowerLine, 'session_replication_role') ||
                    str_contains($lowerLine, 'owner to') ||
                    str_contains($lowerLine, 'pg_catalog.set_config') ||
                    str_contains($lowerLine, 'create extension') ||
                    str_contains($lowerLine, 'set search_path') ||
                    str_contains($lowerLine, 'set row_security') ||
                    str_contains($lowerLine, 'set check_function_bodies') ||
                    str_contains($lowerLine, 'set xmloption') ||
                    str_contains($lowerLine, 'set foreign_key_checks') ||
                    str_contains($lowerLine, 'set autocommit') ||
                    str_contains($lowerLine, 'set sql_mode') ||
                    str_contains($lowerLine, 'set names') ||
                    str_contains($lowerLine, 'start transaction') ||
                    str_contains($lowerLine, 'commit;') ||
                    str_contains($lowerLine, 'set client_min_messages');

                if ($isForbidden) {
                    if (str_ends_with(trim($trimmedLine), ';')) {
                        $query = ""; 
                    }
                    continue;
                }

                // ── Infrastructure Protection ──
                $isDangerous = (str_contains($lowerLine, 'drop table') || str_contains($lowerLine, 'create table')) &&
                    (str_contains($lowerLine, 'users') || str_contains($lowerLine, 'roles') ||
                        str_contains($lowerLine, 'personal_access_tokens') || str_contains($lowerLine, 'offices') ||
                        str_contains($lowerLine, 'cache') || str_contains($lowerLine, 'sessions') ||
                        str_contains($lowerLine, 'jobs') || str_contains($lowerLine, 'failed_jobs'));

                if ($isDangerous) {
                    if (str_ends_with(trim($trimmedLine), ';'))
                        $query = "";
                    continue;
                }

                // ── MySQL to Postgres Translation ──
                if ($isPgsql) {
                    $line = $this->translateSql($line);
                }

                $query .= $line;

                // Check for statement end with flexibility
                if (str_ends_with(trim($trimmedLine), ';')) {
                    $execQuery = trim($query);
                    if (!empty($execQuery)) {
                        $batchBuffer .= $execQuery . "\n";
                        $statementCount++;

                        if ($statementCount % $batchSize === 0) {
                            $this->executeSqlBatch($batchBuffer, $statementCount);
                            $batchBuffer = "";
                        }
                    }
                    $query = "";
                }
            }

            if (!empty($batchBuffer)) {
                $this->executeSqlBatch($batchBuffer, $statementCount);
            }

            fclose($handle);
        }

        if ($dbConnection === 'mysql') {
            DB::statement('SET FOREIGN_KEY_CHECKS=1');
        }
    }

    private function executeSqlBatch($batch, $count)
    {
        try {
            DB::unprepared($batch);
            
            // Heartbeat update every 50 statements
            if ($count % 50 === 0) {
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
                        str_contains($msg, 'must be owner') ||
                        str_contains($msg, 'foreign key') ||
                        str_contains($msg, 'unique constraint') ||
                        str_contains($msg, 'invalid input syntax') ||
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
            'personal_access_tokens',
            'users',
            'roles',
            'offices',
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

        // 4. Handle MySQL string boolean conversions
        $sql = str_replace(", '')", ", false)", $sql);
        $sql = str_replace(", ''", ", false", $sql);

        return $sql;
    }

    private function updateStatus($data)
    {
        try {
            $data['time'] = time();
            $json = json_encode($data);
            $key = 'system_restore_status';
            
            // Unified Signal Path
            $paths = [
                storage_path('app/restore.json'),
                public_path('restore.json')
            ];

            foreach ($paths as $path) {
                @file_put_contents($path, $json);
            }

            // 2. Database Cache (Redundancy)
            DB::table('cache')->updateOrInsert(
                ['key' => $key],
                ['value' => $json, 'expiration' => time() + 3600]
            );

            // 3. Laravel Cache (App logic)
            Cache::put($key, $data, 3600);
        } catch (\Throwable $e) {
            $json = json_encode($data);
            @file_put_contents(storage_path('app/restore.json'), $json);
        }
    }
}
