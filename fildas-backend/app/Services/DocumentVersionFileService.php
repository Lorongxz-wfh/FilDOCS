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

        // Upload original file to storage
        Storage::disk()->putFileAs(
            $year . '/' . $version->id,
            $file,
            $storedName
        );

        $version->original_filename = $file->getClientOriginalName();
        $version->file_path = $r2Path;
        $version->checksum = hash_file('sha256', $file->getRealPath());

        // Preview generation: skip conversion if it's already a PDF
        if ($extension === 'pdf') {
            $version->preview_path = $r2Path;
        } else {
            // Convert to PDF for preview
            $tmpDir = sys_get_temp_dir() . '/fildas/' . $version->id;
            if (!is_dir($tmpDir)) {
                mkdir($tmpDir, 0775, true);
            }

            $tmpFilePath = $tmpDir . '/' . $storedName;
            copy($file->getRealPath(), $tmpFilePath);

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
            } else {
                $version->preview_path = null;
            }

            @unlink($tmpFilePath);
            @rmdir($tmpDir);
        }

        $version->save();
    }

    public function deleteVersionFiles(DocumentVersion $version): void
    {
        if ($version->file_path) {
            Storage::disk()->delete($version->file_path);
        }
        if ($version->preview_path) {
            Storage::disk()->delete($version->preview_path);
        }
    }
}
