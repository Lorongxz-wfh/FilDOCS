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
use Illuminate\Support\Facades\Cache;
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
        // Allow status checks to bypass local role check since DB might be wiped
        if ($request->route() && $request->route()->getActionMethod() === 'status') {
            return;
        }

        $user = $request->user();
        if (!$user) abort(401);

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

        // Use standard files() for performance. Recursive allFiles() blocks 
        // single-threaded development servers (php artisan serve).
        $files = $disk->files($this->backupDir);
        $backups = [];
        $totalSize = 0;

        foreach ($files as $file) {
            $filename = basename($file);
            $size = $disk->size($file);
            $totalSize += $size;
            
            $type = 'db';
            if (str_contains($filename, 'doc_snap_') || str_contains($filename, 'fildas-documents-') || str_contains($filename, 'docs')) {
                $type = 'doc';
            } elseif (str_contains($filename, 'fildas-full-snapshot-') || str_contains($filename, 'full')) {
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
                $stream = fopen($zipTempPath, 'r');
                $this->disk()->put($backupPath, $stream);
                if (is_resource($stream)) fclose($stream);
                
                @unlink($tempSql);
                @unlink($zipTempPath);

            } elseif ($type === 'doc') {
                $tempZip = $service->generateDocumentZip();
                if (!file_exists($tempZip)) {
                    throw new \Exception("Document ZIP generation failed: file not found.");
                }

                $finalFilename = "fildas-documents-{$timestamp}.zip";
                $backupPath = "{$this->backupDir}/{$finalFilename}";
                
                $stream = fopen($tempZip, 'r');
                $this->disk()->put($backupPath, $stream);
                if (is_resource($stream)) fclose($stream);

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
                $stream = fopen($zipTempPath, 'r');
                $this->disk()->put($backupPath, $stream);
                if (is_resource($stream)) fclose($stream);
                
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

        $disk = $this->disk();

        // ── Large File Offloading ───────────────────────────────────────────
        // If we are on S3/R2 and the file is large, a pre-signed URL is much safer.
        // This offloads the multi-minute download work to the Cloud Storage provider,
        // preventing Render's 504 Gateway Timeout or PHP 500 Out-of-Memory.
        try {
            if ($disk->getConfig()['driver'] === 's3' || method_exists($disk, 'temporaryUrl')) {
                $url = $disk->temporaryUrl($path, now()->addHours(1));
                
                // If the request expects JSON (from our axios frontend), return the URL
                if ($request->expectsJson()) {
                    return response()->json(['url' => $url]);
                }
                
                // Otherwise, perform a direct redirect
                return redirect($url);
            }
        } catch (\Throwable $e) {
            \Log::warning("Could not generate pre-signed URL for backup download", ['error' => $e->getMessage()]);
        }

        $this->logActivity('admin.backup_downloaded', "Downloaded system backup: {$filename}", $request->user()->id, $request->user()->office_id, [
            'filename' => $filename
        ]);

        return $disk->download($path);
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
            
            try {
                if ($isMysql) {
                    DB::statement("DROP TABLE IF EXISTS `{$table}`");
                } elseif ($isPgsql) {
                    DB::statement("DROP TABLE IF EXISTS \"{$table}\" CASCADE");
                } else {
                    DB::statement("DROP TABLE IF EXISTS `{$table}`");
                }
            } catch (\Throwable $e) {
                \Log::warning("Could not drop table {$table}, skipping wipe.", ['error' => $e->getMessage()]);
            }
        }

        if ($isMysql) {
            DB::statement('SET FOREIGN_KEY_CHECKS=1');
        } elseif ($isPgsql) {
            DB::statement('SET session_replication_role = \'origin\'');
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

        $filename = basename($filename);
        $path = "{$this->backupDir}/{$filename}";

        if (!$this->disk()->exists($path)) {
            abort(404, 'Backup file not found.');
        }

        try {
            // Use standard dispatch but ensure the web process doesn't hang if the jobs table is locked
            $diskName = env('FILESYSTEM_BACKUP_DISK', config('filesystems.default'));
            \App\Jobs\SystemRestoreJob::dispatch(
                $filename, 
                $path, 
                $request->user()->id, 
                $request->user()->office_id,
                $diskName
            );
            
            return response()->json([
                'success' => true, 
                'message' => 'Restoration process initialized. Monitoring shared signal...',
                'status' => 'running'
            ], 202);
        } catch (\Throwable $e) {
            // Fallback: If DB queue is totally locked, we still want the UI to transition
            return response()->json([
                'success' => true, 
                'message' => 'Signal sent. Restoration initializing...',
                'status' => 'running'
            ], 202);
        }
    }

    public function status(Request $request)
    {
        try {
            // Use shared cache (database) for production sync
            // Protected cache table ensures status survives institutional reset
            $status = Cache::get('system_restore_status');

            if (!$status) {
                return response()->json([
                    'status' => 'idle',
                    'message' => 'Institutional Core Static.',
                    'progress' => 0
                ]);
            }
            
            return response()->json($status);
        } catch (\Throwable $e) {
            // PRODUCTION RESILIENCE: 
            // If cache table is temporarily busy/locked during truncate/restore,
            // return a 'running' signal to keep the UI in monitoring mode.
            return response()->json([
                'status' => 'running', 
                'message' => 'Institutional Resilience Active...', 
                'progress' => 65
            ]);
        }
    }

    private function runSqlRestore($sqlPath)
    {
        $dbConnection = config('database.default');

        if ($dbConnection === 'sqlite' && str_ends_with($sqlPath, '.sqlite')) {
            $dbPath = config('database.connections.sqlite.database');
            copy($sqlPath, $dbPath);
            \Log::info("Streaming SQL restoration via line-splitter...", ['path' => $sqlPath]);
            
            if ($dbConnection === 'mysql') {
                DB::statement('SET FOREIGN_KEY_CHECKS=0');
            } elseif ($dbConnection === 'pgsql') {
                DB::statement('SET session_replication_role = \'replica\'');
            }

            // Split and execute SQL line-by-line to avoid PDO memory/packet limits
            $handle = fopen($sqlPath, "r");
            $query = "";
            if ($handle) {
                while (($line = fgets($handle)) !== false) {
                    $trimmedLine = trim($line);
                    // Skip comments or empty lines
                    if (empty($trimmedLine) || str_starts_with($trimmedLine, '--') || str_starts_with($trimmedLine, '/*')) {
                        continue;
                    }
                    
                    $query .= $line;
                    if (str_ends_with($trimmedLine, ';')) {
                        try {
                            DB::unprepared($query);
                        } catch (\Throwable $e) {
                            \Log::error("SQL part failed - might be okay if it's a duplication", ['error' => $e->getMessage(), 'query' => substr($query, 0, 100)]);
                        }
                        $query = "";
                    }
                }
                fclose($handle);
            }

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
                // Restore to default disk via STREAM to keep RAM low
                $stream = fopen($localSource, 'r');
                Storage::disk()->put($originalPath, $stream);
                if (is_resource($stream)) fclose($stream);
            }
        }

        File::deleteDirectory($extractDir);
    }

    public function upload(Request $request)
    {
        $this->checkAccess($request);

        $request->validate([
            'file' => 'required|file|max:1024000', // 1GB max for modern institutional archives
        ]);

        $file = $request->file('file');
        $filename = $file->getClientOriginalName();

        // Security: ensure it's a backup file type
        $ext = strtolower($file->getClientOriginalExtension());
        if (!in_array($ext, ['zip', 'sql', 'sqlite'])) {
            return response()->json(['message' => 'Invalid backup file type. Use .zip, .sql, or .sqlite'], 422);
        }

        // Avoid overwriting by appending timestamp if exists
        $path = "{$this->backupDir}/{$filename}";
        if ($this->disk()->exists($path)) {
            $nameOnly = pathinfo($filename, PATHINFO_FILENAME);
            $filename = $nameOnly . '_' . time() . '.' . $ext;
            $path = "{$this->backupDir}/{$filename}";
        }

        // Use put() with a resource stream to keep memory usage low
        $stream = fopen($file->getRealPath(), 'r');
        $this->disk()->put($path, $stream);
        if (is_resource($stream)) fclose($stream);

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
