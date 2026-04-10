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

        // 1. Upload original file synchronously (so it exists for the job)
        Storage::disk()->putFileAs(
            $year . '/' . $version->id,
            $file,
            $storedName
        );

        $version->original_filename = $file->getClientOriginalName();
        $version->file_path = $r2Path;
        $version->checksum = null; // Will be filled by background job
        $version->preview_path = null; // Will be filled by background job
        $version->save();

        // 2. Dispatch background job for heavy processing (Hashing, PDF Preview)
        \App\Jobs\ProcessDocumentVersion::dispatch($version->id);
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
