<?php

namespace App\Services\DocumentRequests;

use App\Services\DocumentPreviewService;
use Illuminate\Support\Facades\Storage;

class DocumentRequestFileService
{
    public function saveRequestExampleFile(int $requestId, $file): array
    {
        $year = now()->year;
        $extension = strtolower($file->getClientOriginalExtension());
        $storedName = 'example.' . $extension;
        $r2Folder = $year . '/document_requests/' . $requestId;
        $originalName = $file->getClientOriginalName();
        $filePath = $r2Folder . '/' . $storedName;

        Storage::disk()->putFileAs($r2Folder, $file, $storedName);

        // PDFs are natively previewable — use the file itself as the preview
        if ($extension === 'pdf') {
            return [
                'original_filename' => $originalName,
                'file_path'         => $filePath,
                'preview_path'      => $filePath,
            ];
        }

        // Non-PDF: attempt LibreOffice conversion
        $tmpDir = sys_get_temp_dir() . '/fildas/doc_requests/' . $requestId;
        if (!is_dir($tmpDir)) mkdir($tmpDir, 0775, true);

        $tmpFilePath = $tmpDir . '/' . $storedName;
        copy($file->getRealPath() ?: Storage::disk()->path($filePath), $tmpFilePath);

        $previewFileName = DocumentPreviewService::generatePreview($tmpDir, $tmpFilePath);
        $previewPath = null;

        if ($previewFileName) {
            $tmpPreviewPath = $tmpDir . '/' . $previewFileName;
            Storage::disk()->putFileAs($r2Folder, new \Illuminate\Http\File($tmpPreviewPath), $previewFileName);
            $previewPath = $r2Folder . '/' . $previewFileName;
            @unlink($tmpPreviewPath);
        }

        @unlink($tmpFilePath);
        @rmdir($tmpDir);

        return [
            'original_filename' => $originalName,
            'file_path'         => $filePath,
            'preview_path'      => $previewPath,
        ];
    }

    public function saveRequestItemExampleFile(int $itemId, $file): array
    {
        $year = now()->year;
        $extension = strtolower($file->getClientOriginalExtension());
        $storedName = 'example.' . $extension;
        $r2Folder = $year . '/document_request_items/' . $itemId;
        $originalName = $file->getClientOriginalName();
        $filePath = $r2Folder . '/' . $storedName;

        Storage::disk()->putFileAs($r2Folder, $file, $storedName);

        // PDFs are natively previewable — use the file itself as the preview
        if ($extension === 'pdf') {
            return [
                'original_filename' => $originalName,
                'file_path'         => $filePath,
                'preview_path'      => $filePath,
            ];
        }

        // Non-PDF: attempt LibreOffice conversion
        $tmpDir = sys_get_temp_dir() . '/fildas/doc_request_items/' . $itemId;
        if (!is_dir($tmpDir)) mkdir($tmpDir, 0775, true);

        $tmpFilePath = $tmpDir . '/' . $storedName;
        copy($file->getRealPath() ?: Storage::disk()->path($filePath), $tmpFilePath);

        $previewFileName = DocumentPreviewService::generatePreview($tmpDir, $tmpFilePath);
        $previewPath = null;

        if ($previewFileName) {
            $tmpPreviewPath = $tmpDir . '/' . $previewFileName;
            Storage::disk()->putFileAs($r2Folder, new \Illuminate\Http\File($tmpPreviewPath), $previewFileName);
            $previewPath = $r2Folder . '/' . $previewFileName;
            @unlink($tmpPreviewPath);
        }

        @unlink($tmpFilePath);
        @rmdir($tmpDir);

        return [
            'original_filename' => $originalName,
            'file_path'         => $filePath,
            'preview_path'      => $previewPath,
        ];
    }

    public function saveSubmissionFile(int $submissionId, $file, int $index): array
    {
        $year = now()->year;
        $extension = strtolower($file->getClientOriginalExtension());
        $storedName = 'file_' . $index . '.' . $extension;
        $r2Folder = $year . '/document_request_submissions/' . $submissionId;

        $originalName = $file->getClientOriginalName();
        $mime = $file->getClientMimeType();
        $sizeBytes = (int) $file->getSize();
        $tmpRealPath = $file->getRealPath();

        $filePath = $r2Folder . '/' . $storedName;

        Storage::disk()->putFileAs($r2Folder, $file, $storedName);

        // PDFs are natively previewable — use the file itself as the preview
        if ($extension === 'pdf') {
            return [
                'original_filename' => $originalName,
                'file_path'         => $filePath,
                'preview_path'      => $filePath,
                'mime'              => $mime,
                'size_bytes'        => $sizeBytes,
            ];
        }

        // Non-PDF: attempt LibreOffice conversion
        $tmpDir = sys_get_temp_dir() . '/fildas/doc_request_submissions/' . $submissionId;
        if (!is_dir($tmpDir)) mkdir($tmpDir, 0775, true);

        $tmpFilePath = $tmpDir . '/' . $storedName;
        copy($tmpRealPath, $tmpFilePath);

        $previewFileName = DocumentPreviewService::generatePreview($tmpDir, $tmpFilePath);
        $previewPath = null;

        if ($previewFileName) {
            $tmpPreviewPath = $tmpDir . '/' . $previewFileName;
            Storage::disk()->putFileAs($r2Folder, new \Illuminate\Http\File($tmpPreviewPath), $previewFileName);
            $previewPath = $r2Folder . '/' . $previewFileName;
            @unlink($tmpPreviewPath);
        }

        @unlink($tmpFilePath);
        @rmdir($tmpDir);

        return [
            'original_filename' => $originalName,
            'file_path'         => $filePath,
            'preview_path'      => $previewPath,
            'mime'              => $mime,
            'size_bytes'        => $sizeBytes,
        ];
    }

    public function deletePath(?string $relativePath): void
    {
        if (!$relativePath) return;
        Storage::disk()->delete($relativePath);
    }
}
