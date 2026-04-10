<?php

namespace App\Jobs;

use App\Models\DocumentVersion;
use App\Services\DocumentPreviewService;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Log;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class ProcessDocumentVersion implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $versionId;

    public function __construct(int $versionId)
    {
        $this->versionId = $versionId;
    }

    public function handle(): void
    {
        $version = DocumentVersion::with('document')->find($this->versionId);
        if (!$version || !$version->file_path) {
            return;
        }

        try {
            $extension = strtolower(pathinfo($version->file_path, PATHINFO_EXTENSION));
            $year = $version->created_at->year;

            // 1. Download original file to temp for processing
            $tmpDir = sys_get_temp_dir() . '/fildas_queue/' . $version->id;
            if (!is_dir($tmpDir)) {
                mkdir($tmpDir, 0775, true);
            }

            $storedName = 'original.' . $extension;
            $tmpFilePath = $tmpDir . '/' . $storedName;
            
            // Stream from Storage to local temp
            $fileContents = Storage::disk()->get($version->file_path);
            if (!$fileContents) {
                Log::error("Could not find file at {$version->file_path} for processing.");
                return;
            }
            file_put_contents($tmpFilePath, $fileContents);

            // 2. Update Checksum if missing
            if (!$version->checksum) {
                $version->checksum = hash_file('sha256', $tmpFilePath);
            }

            // 3. Generate Preview if not PDF
            if ($extension === 'pdf') {
                $version->preview_path = $version->file_path;
            } else {
                $previewFileName = DocumentPreviewService::generatePreview($tmpDir, $tmpFilePath);

                if ($previewFileName) {
                    $previewTmpPath = $tmpDir . '/' . $previewFileName;
                    $r2PreviewPath  = $year . '/' . $version->id . '/' . $previewFileName;

                    Storage::disk()->putFileAs(
                        $year . '/' . $version->id,
                        new \Illuminate\Http\File($previewTmpPath),
                        $previewFileName
                    );

                    $version->preview_path = $r2PreviewPath;
                    @unlink($previewTmpPath);
                }
            }

            $version->save();

            // Cleanup
            @unlink($tmpFilePath);
            @rmdir($tmpDir);

        } catch (\Exception $e) {
            Log::error("Failed to process document version #{$this->versionId}: " . $e->getMessage());
            throw $e; // Retry
        }
    }
}
