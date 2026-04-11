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

        if (!$disk->exists("backups/full/{$filename}")) {
            $this->error("Full backup not found: backups/full/{$filename}");
            return;
        }

        $this->info("Downloading full backup for splitting...");
        $tempPath = tempnam(sys_get_temp_dir(), 'split_');
        file_put_contents($tempPath, $disk->get("backups/full/{$filename}"));

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
                $this->info("Extracting Database...");
                $sqlContent = $zip->getFromName($sqlFile);
                $dbZipPath = tempnam(sys_get_temp_dir(), 'db_');
                $dbZip = new ZipArchive();
                $dbZip->open($dbZipPath, ZipArchive::CREATE);
                $dbZip->addFromString($sqlFile, $sqlContent);
                $dbZip->close();
                
                $newDbName = $baseName . "_db_only.zip";
                $disk->put("backups/database/{$newDbName}", file_get_contents($dbZipPath));
                $this->info("Created: backups/database/{$newDbName}");
                @unlink($dbZipPath);
            }

            // 2. Create Storage Only Backup
            if ($docZip) {
                $this->info("Extracting Storage...");
                $docContent = $zip->getFromName($docZip);
                $docZipPath = tempnam(sys_get_temp_dir(), 'st_');
                $stZip = new ZipArchive();
                $stZip->open($docZipPath, ZipArchive::CREATE);
                $stZip->addFromString($docZip, $docContent);
                $stZip->close();

                $newStName = $baseName . "_storage_only.zip";
                $disk->put("backups/storage/{$newStName}", file_get_contents($docZipPath));
                $this->info("Created: backups/storage/{$newStName}");
                @unlink($docZipPath);
            }

            $zip->close();
            $this->info("Split operation complete!");
        } else {
            $this->error("Could not open ZIP file.");
        }

        @unlink($tempPath);
    }
}
