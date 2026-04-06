<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Traits\RoleNameTrait;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\File;
use ZipArchive;

class SystemBackupController extends Controller
{
    use RoleNameTrait;

    protected $backupDir = 'backups';

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

        if (!Storage::disk('local')->exists($this->backupDir)) {
            Storage::disk('local')->makeDirectory($this->backupDir);
        }

        $files = Storage::disk('local')->files($this->backupDir);
        $backups = [];
        $totalSize = 0;

        foreach ($files as $file) {
            $size = Storage::disk('local')->size($file);
            $totalSize += $size;
            $backups[] = [
                'filename'   => basename($file),
                'size'       => $size,
                'created_at' => date('c', Storage::disk('local')->lastModified($file)),
            ];
        }

        usort($backups, fn($a, $b) => $b['created_at'] <=> $a['created_at']);

        return response()->json([
            'backups'    => $backups,
            'total_size' => $totalSize,
        ]);
    }

    public function store(Request $request)
    {
        $this->checkAccess($request);

        set_time_limit(300); // Allow up to 5 minutes for large databases

        $dbConnection = config('database.default');
        $timestamp    = now()->format('Y-m-d_His');

        \Log::info('Snapshot triggered', ['connection' => $dbConnection]);

        try {
            if ($dbConnection === 'sqlite') {
                // ── SQLite: direct file copy ─────────────────────────────────
                $filename   = "snapshot_{$timestamp}.sqlite";
                $backupPath = "{$this->backupDir}/{$filename}";
                $dbPath     = config('database.connections.sqlite.database');

                if (!File::exists($dbPath)) {
                    return response()->json(['message' => 'SQLite database file not found.'], 404);
                }

                Storage::disk('local')->put($backupPath, File::get($dbPath));

            } else {
                // ── MySQL / PostgreSQL / Any PDO driver: pure PHP dump ───────
                // No CLI tools required — works on any host.
                $filename   = "snapshot_{$timestamp}.sql";
                $backupPath = "{$this->backupDir}/{$filename}";
                
                // Ensure directory exists in the 'local' disk
                if (!Storage::disk('local')->exists($this->backupDir)) {
                    Storage::disk('local')->makeDirectory($this->backupDir);
                }

                $tempPath = Storage::disk('local')->path($backupPath);

                $isMysql = in_array($dbConnection, ['mysql', 'mariadb'], true);
                $isPgsql  = $dbConnection === 'pgsql';
                $dbName   = config("database.connections.{$dbConnection}.database");

                // Tables to skip (large logs or framework internals)
                $skipTables = ['migrations', 'jobs', 'failed_jobs', 'cache', 'cache_locks',
                               'telescope_entries', 'telescope_entries_tags', 'telescope_monitoring'];

                // Cap rows per table to keep snapshot fast & small
                $rowCap = 2000;

                // Get all table names
                if ($isMysql) {
                    $tables     = DB::select('SHOW TABLES');
                    $tableNames = array_map(fn($t) => array_values((array)$t)[0], $tables);
                } elseif ($isPgsql) {
                    $tables     = DB::select("SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename");
                    $tableNames = array_column($tables, 'tablename');
                } else {
                    $tables     = DB::select("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
                    $tableNames = array_column($tables, 'name');
                }

                $fh = fopen($tempPath, 'w');

                fwrite($fh, "-- FilDAS System Snapshot\n");
                fwrite($fh, "-- Generated: " . now()->toDateTimeString() . "\n");
                fwrite($fh, "-- Database: {$dbName} ({$dbConnection})\n");
                fwrite($fh, "-- Row cap per table: {$rowCap}\n");
                fwrite($fh, "-- ============================================================\n\n");

                if ($isMysql) {
                    fwrite($fh, "SET FOREIGN_KEY_CHECKS=0;\nSET NAMES utf8mb4;\n\n");
                }

                foreach ($tableNames as $table) {
                    if (in_array($table, $skipTables)) continue;

                    fwrite($fh, "-- Table: {$table}\n");

                    $offset    = 0;
                    $chunkSize = 500;

                    do {
                        $rows = DB::table($table)->offset($offset)->limit($chunkSize)->get();

                        if ($rows->isEmpty()) break;

                        foreach ($rows as $row) {
                            $arr    = (array) $row;
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

                        $offset += $chunkSize;

                    } while ($rows->count() === $chunkSize && $offset < $rowCap);

                    fwrite($fh, "\n");
                }

                if ($isMysql) fwrite($fh, "SET FOREIGN_KEY_CHECKS=1;\n");

                fclose($fh);

                // Compress to zip if ZipArchive is available
                if (class_exists('ZipArchive')) {
                    $zipFilename   = "snapshot_{$timestamp}.zip";
                    $zipBackupPath = "{$this->backupDir}/{$zipFilename}";
                    $zipTempPath   = Storage::disk('local')->path($zipBackupPath);

                    $zip = new ZipArchive();
                    if ($zip->open($zipTempPath, ZipArchive::CREATE | ZipArchive::OVERWRITE) === true) {
                        $zip->addFile($tempPath, $filename);
                        $zip->close();
                        @unlink($tempPath);

                        $filename   = $zipFilename;
                        $backupPath = $zipBackupPath;
                    }
                }
            }

        } catch (\Throwable $e) {
            \Log::error('Snapshot failed', [
                'message' => $e->getMessage(),
                'file'    => $e->getFile(),
                'line'    => $e->getLine(),
                'trace'   => $e->getTraceAsString(),
            ]);
            return response()->json([
                'message' => 'Snapshot failed: ' . $e->getMessage() . ' (in ' . basename($e->getFile()) . ':' . $e->getLine() . ')',
            ], 500);
        }

        $finalSize = Storage::disk('local')->exists($backupPath) 
            ? Storage::disk('local')->size($backupPath) 
            : 0;

        return response()->json([
            'message' => 'System snapshot created successfully.',
            'backup'  => [
                'filename'   => $filename,
                'size'       => $finalSize,
                'created_at' => now()->toIso8601String(),
            ],
        ], 201);
    }

    public function download(Request $request, $filename)
    {
        $this->checkAccess($request);

        $filename = basename($filename);
        $path = "{$this->backupDir}/{$filename}";

        if (!Storage::disk('local')->exists($path)) {
            abort(404, 'Backup file not found.');
        }

        return response()->download(Storage::disk('local')->path($path));
    }

    public function destroy(Request $request, $filename)
    {
        $this->checkAccess($request);

        $filename = basename($filename);
        $path = "{$this->backupDir}/{$filename}";

        if (!Storage::disk('local')->exists($path)) {
            return response()->json(['message' => 'Backup file not found.'], 404);
        }

        Storage::disk('local')->delete($path);

        return response()->json(['message' => 'Backup deleted successfully.']);
    }

    public function restore(Request $request, $filename)
    {
        $this->checkAccess($request);

        set_time_limit(600); // 10 minutes for large restores

        $filename = basename($filename);
        $path = "{$this->backupDir}/{$filename}";

        if (!Storage::disk('local')->exists($path)) {
            abort(404, 'Backup file not found.');
        }

        $fullPath = Storage::disk('local')->path($path);
        $tempExtractDir = storage_path('app/temp/restore_' . time());

        if (!is_dir($tempExtractDir)) {
            mkdir($tempExtractDir, 0755, true);
        }

        try {
            $sqlFile = null;

            if (str_ends_with($filename, '.zip')) {
                $zip = new ZipArchive();
                if ($zip->open($fullPath) === true) {
                    $zip->extractTo($tempExtractDir);
                    $zip->close();

                    // Find the .sql or .sqlite file
                    $extractedFiles = scandir($tempExtractDir);
                    foreach ($extractedFiles as $f) {
                        if (str_ends_with($f, '.sql') || str_ends_with($f, '.sqlite')) {
                            $sqlFile = $tempExtractDir . '/' . $f;
                            break;
                        }
                    }
                }
            } else {
                $sqlFile = $fullPath;
            }

            if (!$sqlFile || !file_exists($sqlFile)) {
                throw new \Exception('No valid SQL or SQLite file found in backup.');
            }

            $dbConnection = config('database.default');

            if ($dbConnection === 'sqlite' && str_ends_with($sqlFile, '.sqlite')) {
                // Direct file replacement for SQLite
                $dbPath = config('database.connections.sqlite.database');
                copy($sqlFile, $dbPath);
            } else {
                // Execute SQL commands
                $sql = file_get_contents($sqlFile);
                
                // Disable foreign keys for the restore process
                if ($dbConnection === 'mysql') {
                    DB::statement('SET FOREIGN_KEY_CHECKS=0');
                } elseif ($dbConnection === 'pgsql') {
                    DB::statement('SET session_replication_role = \'replica\'');
                }

                // Execute the SQL. split by semicolon if needed for large files? 
                // DB::unprepared is usually okay for moderate sizes.
                DB::unprepared($sql);

                if ($dbConnection === 'mysql') {
                    DB::statement('SET FOREIGN_KEY_CHECKS=1');
                } elseif ($dbConnection === 'pgsql') {
                    DB::statement('SET session_replication_role = \'origin\'');
                }
            }

            // Cleanup temp dir
            File::deleteDirectory($tempExtractDir);

            return response()->json([
                'message' => 'System restored successfully. You may need to refresh the page.',
            ]);

        } catch (\Throwable $e) {
            if (is_dir($tempExtractDir)) {
                File::deleteDirectory($tempExtractDir);
            }

            \Log::error('Restore failed', [
                'filename' => $filename,
                'message' => $e->getMessage(),
            ]);

            return response()->json([
                'message' => 'Restore failed: ' . $e->getMessage(),
            ], 500);
        }
    }
}
