<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;

class SystemBackupController extends Controller
{
    protected $backupDir = 'backups';

    public function index()
    {
        if (!Storage::exists($this->backupDir)) {
            Storage::makeDirectory($this->backupDir);
        }

        $files = Storage::files($this->backupDir);
        $backups = [];
        $totalSize = 0;

        foreach ($files as $file) {
            $size = Storage::size($file);
            $totalSize += $size;
            $backups[] = [
                'filename' => basename($file),
                'size' => $size,
                'created_at' => date('c', Storage::lastModified($file)),
            ];
        }

        // Sort by date descending
        usort($backups, fn($a, $b) => $b['created_at'] <=> $a['created_at']);

        return response()->json([
            'backups' => $backups,
            'total_size' => $totalSize,
        ]);
    }

    public function store(Request $request)
    {
        $dbConnection = config('database.default');
        $timestamp = now()->format('Y-m-d_His');
        $filename = "snapshot_{$timestamp}.sqlite";
        $backupPath = "{$this->backupDir}/{$filename}";

        if ($dbConnection === 'sqlite') {
            $dbPath = config('database.connections.sqlite.database');
            if (!File::exists($dbPath)) {
                return response()->json(['message' => 'Database file not found.'], 404);
            }

            // Copy the active database file to storage
            Storage::put($backupPath, File::get($dbPath));
        } else {
            // For non-sqlite, we would normally use mysqldump, but for this 
            // implementation we'll focus on the primary developer setup.
            return response()->json(['message' => 'Backup logic for ' . $dbConnection . ' not implemented.'], 501);
        }

        return response()->json([
            'message' => 'System snapshot created successfully.',
            'backup' => [
                'filename' => $filename,
                'size' => Storage::size($backupPath),
                'created_at' => now()->toIso8601String(),
            ]
        ], 201);
    }

    public function download($filename)
    {
        // Prevent directory traversal
        $filename = basename($filename);
        $path = "{$this->backupDir}/{$filename}";

        if (!Storage::exists($path)) {
            abort(404, 'Backup file not found.');
        }

        return Storage::download($path);
    }

    public function destroy($filename)
    {
        $filename = basename($filename);
        $path = "{$this->backupDir}/{$filename}";

        if (!Storage::exists($path)) {
            return response()->json(['message' => 'Backup file not found.'], 404);
        }

        Storage::delete($path);

        return response()->json(['message' => 'Backup deleted successfully.']);
    }
}
