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

        // Load document and office relationships for path building
        $version->load(['document.ownerOffice']);
        $doc = $version->document;
        $officeCode = $doc && $doc->ownerOffice ? $doc->ownerOffice->code : 'OTH';
        $docCode = $doc ? ($doc->document_code ?: "ID-{$doc->id}") : "ID-{$version->document_id}";
        $vNum = $version->version_number ?? 0;

        $extension = strtolower($file->getClientOriginalExtension());
        $storedName = "v{$vNum}_{$file->getClientOriginalName()}";

        // Clean storedName for filesystem safety
        $storedName = \Illuminate\Support\Str::slug(pathinfo($storedName, PATHINFO_FILENAME)) . '.' . $extension;

        $r2Folder = "documents/{$officeCode}/{$docCode}";
        $r2Path = "{$r2Folder}/{$storedName}";

        // 1. Upload original file
        Storage::disk()->putFileAs($r2Folder, $file, $storedName);

        $version->original_filename = $file->getClientOriginalName();
        $version->file_path = $r2Path;
        $version->checksum = null;
        $version->preview_path = null;
        $version->save();

        // 2. Dispatch background job for heavy processing
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
