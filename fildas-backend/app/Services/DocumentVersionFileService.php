<?php

namespace App\Services;

use App\Models\DocumentVersion;
use App\Services\DocumentPreviewService;
use Illuminate\Support\Facades\Storage;

class DocumentVersionFileService
{
    public function saveVersionFile(DocumentVersion $version, $file): void
    {
        // Delete old files first
        $this->deleteVersionFiles($version);

        $year = now()->year;
        $extension = strtolower($file->getClientOriginalExtension());
        $storedName = 'original.' . $extension;
        $r2Path = $year . '/' . $version->id . '/' . $storedName;

        // Upload original file to R2
        Storage::disk('s3')->putFileAs(
            $year . '/' . $version->id,
            $file,
            $storedName
        );

        $version->original_filename = $file->getClientOriginalName();
        $version->file_path = $r2Path;

        // Preview generation: store file locally, convert, upload to R2, cleanup
        $tmpDir = sys_get_temp_dir() . '/fildas/' . $version->id;
        if (!is_dir($tmpDir)) {
            mkdir($tmpDir, 0775, true);
        }

        $tmpFilePath = $tmpDir . '/' . $storedName;
        copy($file->getRealPath(), $tmpFilePath);

        $previewFileName = DocumentPreviewService::generatePreview($tmpDir, $tmpFilePath);

        if ($previewFileName) {
            $previewTmpPath = $tmpDir . '/' . $previewFileName;
            $r2PreviewPath = $year . '/' . $version->id . '/' . $previewFileName;

            Storage::disk('s3')->putFileAs(
                $year . '/' . $version->id,
                new \Illuminate\Http\File($previewTmpPath),
                $previewFileName
            );

            $version->preview_path = $r2PreviewPath;

            @unlink($previewTmpPath);
        } else {
            $version->preview_path = null;
        }

        @unlink($tmpFilePath);
        @rmdir($tmpDir);

        $version->save();
    }

    public function deleteVersionFiles(DocumentVersion $version): void
    {
        if ($version->file_path) {
            Storage::disk('s3')->delete($version->file_path);
        }
        if ($version->preview_path) {
            Storage::disk('s3')->delete($version->preview_path);
        }
    }
}
