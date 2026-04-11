<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;
use ZipArchive;
use Illuminate\Support\Str;

class SplitFullBackup extends Command
{
    protected $signature = 'backup:split {filename : The name of the full backup ZIP}';
    protected $description = 'Splits a full backup into separate Database and Storage snapshots';

    public function handle()
    {
        $filename = $this->argument('filename');
        $disk = Storage::disk(config('filesystems.default') === 's3' ? 's3' : 'local');

        // Check multiple possible paths
        $possiblePaths = [
            "backups/full/{$filename}",
            "backups/{$filename}",
            $filename
        ];

        $foundPath = null;
        foreach ($possiblePaths as $path) {
            if ($disk->exists($path)) {
                $foundPath = $path;
                break;
            }
        }

        $this->info("Found backup at: {$foundPath}");
        $this->info("Downloading for splitting (Streaming Mode)...");
        
        ini_set('memory_limit', '1024M'); // Request 1GB RAM for the zip operation
        
        $tempPath = tempnam(sys_get_temp_dir(), 'split_');
        
        // Use streaming to prevent "Memory Size Exhausted" error
        $readStream = $disk->readStream($foundPath);
        $writeStream = fopen($tempPath, 'w+');
        stream_copy_to_stream($readStream, $writeStream);
        fclose($writeStream);
        if (is_resource($readStream)) fclose($readStream);

        $zip = new ZipArchive();
        if ($zip->open($tempPath) === true) {
            $this->info("Analyzing archive structure...");
            
            $sqlFile = null;
            $docZip = null;

            for ($i = 0; $i < $zip->numFiles; $i++) {
                $stat = $zip->statIndex($i);
                if (Str::endsWith(strtolower($stat['name']), '.sql')) $sqlFile = $stat['name'];
                if (Str::endsWith(strtolower($stat['name']), 'document_collection.zip')) $docZip = $stat['name'];
            }

            $baseName = pathinfo($filename, PATHINFO_FILENAME);

            // 1. Create DB Only Backup
            if ($sqlFile) {
                $this->info("Extracting Database (Streaming Mode)...");
                $dbZipPath = tempnam(sys_get_temp_dir(), 'db_');
                
                // Use the zip:// wrapper to copy directly to a new file without loading into RAM
                $sqlSourcePath = "zip://" . $tempPath . "#" . $sqlFile;
                $tempSqlFile = tempnam(sys_get_temp_dir(), 'sql_');
                copy($sqlSourcePath, $tempSqlFile);
                
                $dbZip = new ZipArchive();
                $dbZip->open($dbZipPath, ZipArchive::CREATE);
                $dbZip->addFile($tempSqlFile, $sqlFile);
                $dbZip->close();
                
                $newDbName = $baseName . "_db_only.zip";
                $disk->put("backups/database/{$newDbName}", fopen($dbZipPath, 'r+'));
                $this->info("Created: backups/database/{$newDbName}");
                
                @unlink($dbZipPath);
                @unlink($tempSqlFile);
            }

            // 2. Create Storage Only Backup
            if ($docZip) {
                $this->info("Extracting Storage (Streaming Mode)...");
                $docZipPath = tempnam(sys_get_temp_dir(), 'st_');
                
                $stSourcePath = "zip://" . $tempPath . "#" . $docZip;
                $tempDocFile = tempnam(sys_get_temp_dir(), 'doc_');
                copy($stSourcePath, $tempDocFile);

                $stZip = new ZipArchive();
                $stZip->open($docZipPath, ZipArchive::CREATE);
                $stZip->addFile($tempDocFile, $docZip);
                $stZip->close();

                $newStName = $baseName . "_storage_only.zip";
                $disk->put("backups/storage/{$newStName}", fopen($docZipPath, 'r+'));
                $this->info("Created: backups/storage/{$newStName}");
                
                @unlink($docZipPath);
                @unlink($tempDocFile);
            }

            $zip->close();
            $this->info("Split operation complete!");
        } else {
            $this->error("Could not open ZIP file.");
        }

        @unlink($tempPath);
    }
}
