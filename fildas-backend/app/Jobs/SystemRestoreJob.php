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
        
        $publicSignalPath = public_path('_restore_signal.json');

        $this->updateStatus(['status' => 'running', 'message' => "Starting restoration of {$this->filename}...", 'progress' => 5]);

        // Physical Signal - public root is 100% visible to the lifeboat script
        @file_put_contents($publicSignalPath, json_encode([
            'status' => 'running',
            'message' => 'Engine initializing...',
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
            @unlink('/tmp/fildas_restore/status.json');
            @unlink(public_path('_restore_signal.json'));

            $data = ['status' => 'completed', 'message' => "Restoration finished successfully.", 'progress' => 100];
            Cache::store('file')->put($statusKey, $data, 1800);
            Cache::store('file')->put('system_restore_status', $data, 1800);

            $actor = User::find($this->actorId);
            $this->notifyAdminsOfCompletion($actor, $this->filename);

        } catch (\Throwable $e) {
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
        $batchSize = 10; // High-precision batching to avoid constraint spikes

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
                    str_contains($lowerLine, 'set client_min_messages');

                if ($isForbidden) {
                    if (str_ends_with(trim($trimmedLine), ';')) {
                        $query = ""; // Clear buffer if the forbidden command was a single line
                    }
                    continue;
                }

                // ── Infrastructure Protection (Do not re-create tables that keep app alive) ──
                $isDangerous = (str_contains($lowerLine, 'drop table') || str_contains($lowerLine, 'create table')) &&
                    (str_contains($lowerLine, 'users') || str_contains($lowerLine, 'roles') ||
                        str_contains($lowerLine, 'personal_access_tokens') || str_contains($lowerLine, 'offices') ||
                        str_contains($lowerLine, 'cache') || str_contains($lowerLine, 'sessions'));

                if ($isDangerous) {
                    if (str_ends_with(trim($trimmedLine), ';'))
                        $query = "";
                    continue;
                }

                // ── MySQL to Postgres Translation (Still useful for mixed envs) ──
                if ($isPgsql) {
                    $line = str_replace('`', '"', $line);
                    $line = preg_replace('/ENGINE=[^; ]+/', '', $line);
                    
                    // Universal Translator: Convert MySQL-isms to Postgres booleans/NULLs
                    $line = str_replace(", '')", ", false)", $line);
                    $line = str_replace(", ''", ", false", $line);
                }

                $query .= $line;

                // Check for statement end with flexibility
                if (str_ends_with(trim($trimmedLine), ';')) {
                    $execQuery = trim($query);
                    if (!empty($execQuery)) {
                        $batchBuffer .= $execQuery . "\n";
                        $statementCount++;

                        // Execute in bulk to reduce latency
                        if ($statementCount % $batchSize === 0) {
                            try {
                                DB::unprepared($batchBuffer);

                                // Heartbeat update every 600 total statements
                                if ($statementCount % 600 === 0) {
                                    $this->updateStatus([
                                        'status' => 'running',
                                        'message' => "Injecting SQL Data (Segment " . ($statementCount / $batchSize) . ")...",
                                        'progress' => 60
                                    ]);
                                }
                            } catch (\Throwable $e) {
                                $msg = $e->getMessage();
                                // Ignore standard 'already exists' or 'extension' errors that aren't fatal.
                                $isIgnorable = str_contains($msg, 'already exists') ||
                                    str_contains($msg, 'must be owner') ||
                                    str_contains($msg, 'foreign key') ||
                                    str_contains($msg, 'unique constraint') ||
                                    str_contains($msg, 'invalid input syntax') ||
                                    str_contains($msg, 'violates') ||
                                    str_contains($msg, 'check violation') ||
                                    str_contains($msg, 'extension');

                                if (!$isIgnorable) {
                                    throw new \Exception("Bulk Injection Failure: " . $msg . " | Near: " . substr($batchBuffer, 0, 100));
                                }
                            }
                            $batchBuffer = "";
                        }
                    }
                    $query = "";
                }
            }

            // Final Flush for the remaining batch
            if (!empty($batchBuffer)) {
                try {
                    DB::unprepared($batchBuffer);
                } catch (\Throwable $e) {
                    $msg = $e->getMessage();
                    $isIgnorable = str_contains($msg, 'already exists') ||
                                    str_contains($msg, 'must be owner') ||
                                    str_contains($msg, 'foreign key') ||
                                    str_contains($msg, 'unique constraint') ||
                                    str_contains($msg, 'extension');
                    if (!$isIgnorable) {
                        throw new \Exception("Final Flush Failure: " . $msg);
                    }
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
            // Keep migrations metadata so Laravel stays sane
            if ($table === 'migrations') continue;

            try {
                if ($isPgsql) {
                    // TRUNCATE is safer than DROP because it keeps the schema created by migrate:fresh
                    DB::statement("TRUNCATE TABLE \"{$table}\" CASCADE");
                } elseif ($isMysql) {
                    DB::statement("TRUNCATE TABLE `{$table}`");
                } else {
                    DB::table($table)->truncate();
                }
            } catch (\Throwable $e) {
                // Ignore failures (system tables or locked tables)
                \Log::debug("Table bypass during sweep: {$table}");
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

    private function updateStatus($data)
    {
        try {
            $json = json_encode($data);
            $key = 'system_restore_status';
            
            // On Render, Database is the ONLY shared medium between Worker and Web
            // We write a RAW string so the Lifeboat script can read it without Laravel's serialization
            DB::table('cache')->updateOrInsert(
                ['key' => $key],
                ['value' => $json, 'expiration' => time() + 3600]
            );

            // Also maintain Laravel cache for standard app logic
            Cache::put($key, $data, 3600);
        } catch (\Throwable $e) {
            // Log but don't crash if DB is busy
            \Log::debug("Status heartbeat skipped (DB busy): " . $e->getMessage());
        }
    }
}
