<?php

namespace App\Jobs;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Mail;
use App\Models\User;
use App\Models\Notification as NotificationModel;
use ZipArchive;

class SystemRestoreJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    protected $filename;
    protected $path;
    protected $userId;
    protected $officeId;
    protected $diskName;

    public $timeout = 600; // 10 minutes

    public function __construct($filename, $path, $userId, $officeId, $diskName = 'local')
    {
        $this->filename = $filename;
        $this->path = $path;
        $this->userId = $userId;
        $this->officeId = $officeId;
        $this->diskName = $diskName;
    }

    public function handle()
    {
        try {
            $this->updateStatus([
                'status' => 'running',
                'message' => 'Preparing structural recovery...',
                'progress' => 10,
                'time' => time()
            ]);

            \Log::info("Async Restore Started: {$this->filename}");

            $disk = Storage::disk($this->diskName);
            if (!$disk->exists($this->path)) {
                throw new \Exception("Backup file not found at path: {$this->path}");
            }

            $tempDir = storage_path('app/temp/restore_' . time());
            if (!is_dir($tempDir)) {
                mkdir($tempDir, 0755, true);
            }

            $localFile = $tempDir . '/' . basename($this->path);
            file_put_contents($localFile, $disk->get($this->path));

            // Extract if ZIP
            if (str_ends_with($this->filename, '.zip')) {
                $zip = new ZipArchive();
                if ($zip->open($localFile) === true) {
                    $zip->extractTo($tempDir);
                    $zip->close();
                    
                    // Look for SQL file inside
                    $files = scandir($tempDir);
                    $sqlFile = null;
                    foreach ($files as $f) {
                        if (str_ends_with($f, '.sql')) {
                            $sqlFile = $tempDir . '/' . $f;
                            break;
                        }
                    }

                    if ($sqlFile) {
                        $this->runSqlRestore($sqlFile);
                    } else {
                        throw new \Exception("No SQL file found inside the zip.");
                    }
                } else {
                    throw new \Exception("Failed to open ZIP backup.");
                }
            } else {
                $this->runSqlRestore($localFile);
            }

            // Clean up
            File::deleteDirectory($tempDir);

            // Final Status Notification
            $actor = User::find($this->userId);
            if ($actor) {
                $this->notifyAdminsOfRestore($actor, 'Full System', $this->filename);
            }

            $this->updateStatus([
                'status' => 'completed',
                'message' => 'System Restoration successful!',
                'progress' => 100,
                'time' => time()
            ]);

            \Log::info("RESTORE: Background Process finished successfully");

        } catch (\Throwable $e) {
            \Log::error("Restoration failed critically: " . $e->getMessage());
            $this->updateStatus([
                'status' => 'failed',
                'message' => 'Restoration failed: ' . $e->getMessage(),
                'progress' => 0,
                'time' => time()
            ]);
        }
    }

    private function updateStatus($data)
    {
        $existing = Cache::get('system_restore_status', []);
        Cache::put('system_restore_status', array_merge($existing, $data), 1800);
    }

    private function runSqlRestore($sqlPath)
    {
        $dbDriver = config('database.default');
        $isMysql = ($dbDriver === 'mysql');

        // 1. ANSI ARMOR + LAX MODE: The Global "Mission" Settings
        // ANSI_QUOTES: Treats " as identifiers (PostgreSQL native style)
        // NO_AUTO_VALUE_ON_ZERO: allows id=0 in imports
        if ($isMysql) {
            DB::statement("SET sql_mode='ANSI_QUOTES,NO_AUTO_VALUE_ON_ZERO,NO_ENGINE_SUBSTITUTION'");
        }

        // 2. Clear out existing architecture before injection
        $this->wipeApplicationTables();

        // 3. STEP-BY-STEP RECONSTRUCTION: Line-by-line streaming buffer
        $handle = fopen($sqlPath, "r");
        $statements = [];
        $currentStmt = "";

        while (($line = fgets($handle)) !== false) {
            $trimmed = trim($line);
            if (empty($trimmed) || str_starts_with($trimmed, '--')) continue;
            
            $currentStmt .= $line;
            if (str_ends_with($trimmed, ';')) {
                $statements[] = trim($currentStmt);
                $currentStmt = "";
            }
        }
        fclose($handle);
        
        $total = count($statements);
        $pass = 1;
        $maxPasses = 5;
        $attempted = $statements;
        $totalInjected = 0;

        \Log::info("RESTORE: Pass 1 starting with {$total} buffered statements.");

        while ($pass <= $maxPasses && count($attempted) > 0) {
            $failedInThisPass = [];
            $injectedInThisPass = 0;
            
            foreach ($attempted as $stmt) {
                if (empty($stmt)) continue;

                // Strip trailing semicolon for execution
                $execSql = rtrim($stmt, ';');

                // PROTECT SESSION/JOB SAFETY
                if (str_contains($execSql, '"sessions"') || str_contains($execSql, '"jobs"')) continue;

                // Final Data Healing (Booleans/Casting only)
                $execSql = $this->translateToMysql($execSql);

                try {
                    DB::connection()->getPdo()->exec($execSql);
                    $injectedInThisPass++;
                    $totalInjected++;
                } catch (\Throwable $e) {
                    $msg = $e->getMessage();
                    // Retry on foreign key errors
                    if (str_contains(strtolower($msg), 'foreign key') || str_contains(strtolower($msg), 'does not exist')) {
                        $failedInThisPass[] = $stmt;
                    } else {
                        \Log::warning("RESTORE: Statement failed! Error: {$msg} | SQL: " . substr($execSql, 0, 300));
                    }
                }

                if ($totalInjected % 50 === 0) {
                    $this->updateStatus(['progress' => 15 + (int)(($totalInjected / $total) * 80)]);
                }
            }

            \Log::info("RESTORE: Pass {$pass} complete. Injected: {$injectedInThisPass}. Remaining: " . count($failedInThisPass));
            
            if ($injectedInThisPass === 0 && count($failedInThisPass) > 0) {
                \Log::error("RESTORE: Deadlock detected at Pass {$pass}. This usually implies translation failure.");
                break; 
            }

            $attempted = $failedInThisPass;
            $pass++;
        }

        $this->updateStatus(['progress' => 99, 'message' => "SQL Reconstruction complete."]);
    }

    private function translateToMysql(string $sql): string
    {
        // 1. Remove PostgreSQL specific casting globally
        $sql = str_replace(['public.', '::jsonb', '::json', '::text', '::timestamp', '::date', '::varying'], '', $sql);
        $sql = preg_replace('/::[a-z_ ]+/', '', $sql);

        // 2. Standalone Boolean conversion
        // (MySQL ANSI_QUOTES handles the "quotes", we handle the true/false)
        $sql = preg_replace('/\btrue\b/i', '1', $sql);
        $sql = preg_replace('/\bfalse\b/i', '0', $sql);
        
        // 3. PostgreSQL Constants
        $sql = str_replace("'now'", "NOW()", $sql);

        return $sql;
    }

    private function wipeApplicationTables()
    {
        $dbDriver = config('database.default');
        $isMysql = ($dbDriver === 'mysql');
        $isPgsql = ($dbDriver === 'pgsql');

        if ($isMysql) {
            DB::statement('SET FOREIGN_KEY_CHECKS=0');
        } elseif ($isPgsql) {
            DB::statement('SET session_replication_role = \'replica\'');
        }

        $tables = DB::select($isMysql ? 'SHOW TABLES' : "SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public'");
        $key = $isMysql ? 'Tables_in_' . config('database.connections.mysql.database') : 'tablename';

        $protectedTables = ['migrations', 'jobs', 'failed_jobs', 'cache', 'cache_locks', 'sessions', 'telescope_entries', 'telescope_entries_tags', 'telescope_monitoring'];

        foreach ($tables as $table) {
            $tableName = $table->$key;
            if (in_array($tableName, $protectedTables)) continue;

            try {
                DB::table($tableName)->truncate();
            } catch (\Throwable $e) {
                \Log::warning("Could not truncate {$tableName}, skipping wipe.", ['error' => $e->getMessage()]);
            }
        }

        if ($isMysql) {
            DB::statement('SET FOREIGN_KEY_CHECKS=1');
        } elseif ($isPgsql) {
            DB::statement('SET session_replication_role = \'origin\'');
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
            NotificationModel::create([
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

            try {
                Mail::to($admin->email)->queue(new \App\Mail\WorkflowNotificationMail(
                    recipientName: $admin->full_name,
                    notifTitle: $notifTitle,
                    notifBody: $notifBody,
                    documentTitle: 'System Integrity',
                    documentStatus: 'RESTORED',
                    isReject: true, 
                    actorName: $actor->full_name,
                    documentId: null,
                    appUrl: rtrim(env('FRONTEND_URL', config('app.url')), '/'),
                    appName: config('app.name', 'FilDOCS'),
                    cardLabel: 'Critical'
                ));
            } catch (\Throwable $e) {}
        }
    }
}
