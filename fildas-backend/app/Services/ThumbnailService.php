<?php

namespace App\Services;

use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Log;

class ThumbnailService
{
    /**
     * Generate a thumbnail for a given file and store it.
     * Returns the storage path or null on failure.
     */
    public function generateForTemplate(string $filePath, string $mimeType, string $diskName = 'public'): ?string
    {
        $disk = Storage::disk($diskName);
        if (!$disk->exists($filePath)) return null;

        $tmpOriginal = sys_get_temp_dir() . '/fildas_orig_' . uniqid();
        file_put_contents($tmpOriginal, $disk->get($filePath));

        $outputPath = 'template-thumbnails/' . Str::uuid() . '.png';
        
        // We ALWAYS generate the thumbnail locally first
        $localTmpThumb = sys_get_temp_dir() . '/fildas_thumb_out_' . uniqid() . '.png';

        try {
            if ($mimeType === 'application/pdf') {
                $success = $this->pdfToThumbnail($tmpOriginal, $localTmpThumb);
            } elseif ($this->isOfficeFile($mimeType)) {
                $success = $this->officeToThumbnail($tmpOriginal, $localTmpThumb, $mimeType);
            } else {
                @unlink($tmpOriginal);
                return null;
            }

            @unlink($tmpOriginal);

            if ($success && file_exists($localTmpThumb)) {
                // Upload local thumbnail to the specified disk
                $disk->putFileAs(
                    dirname($outputPath), 
                    new \Illuminate\Http\File($localTmpThumb), 
                    basename($outputPath)
                );
                @unlink($localTmpThumb);
                return $outputPath;
            }
        } catch (\Throwable $e) {
            Log::warning('ThumbnailService failed', ['error' => $e->getMessage()]);
            @unlink($tmpOriginal);
            @unlink($localTmpThumb);
        }

        return null;
    }

    private function pdfToThumbnail(string $pdfPath, string $outputPath): bool
    {
        // Use LibreOffice to convert PDF first page to PNG
        $sofficePath = $this->getSofficePath();
        $tempDir = sys_get_temp_dir() . '/fildas_thumb_' . uniqid();
        mkdir($tempDir, 0755, true);

        $cmd = sprintf(
            '%s --headless --convert-to png --outdir %s %s 2>&1',
            escapeshellarg($sofficePath),
            escapeshellarg($tempDir),
            escapeshellarg($pdfPath)
        );

        exec($cmd, $output, $code);

        $pngFiles = glob($tempDir . '/*.png');
        if (!empty($pngFiles)) {
            // LibreOffice may generate multiple pages — take first
            sort($pngFiles);
            copy($pngFiles[0], $outputPath);
            foreach ($pngFiles as $f) @unlink($f);
            @rmdir($tempDir);
            return true;
        }

        @rmdir($tempDir);
        return false;
    }

    private function officeToThumbnail(string $filePath, string $outputPath, string $mimeType): bool
    {
        $sofficePath = $this->getSofficePath();
        $tempDir = sys_get_temp_dir() . '/fildas_thumb_' . uniqid();
        mkdir($tempDir, 0755, true);

        // Convert to PDF first, then to PNG
        $cmd = sprintf(
            '%s --headless --convert-to pdf --outdir %s %s 2>&1',
            escapeshellarg($sofficePath),
            escapeshellarg($tempDir),
            escapeshellarg($filePath)
        );

        exec($cmd, $output, $code);

        $pdfFiles = glob($tempDir . '/*.pdf');
        if (empty($pdfFiles)) {
            @rmdir($tempDir);
            return false;
        }

        $result = $this->pdfToThumbnail($pdfFiles[0], $outputPath);

        foreach ($pdfFiles as $f) @unlink($f);
        @rmdir($tempDir);

        return $result;
    }

    private function getSofficePath(): string
    {
        // Windows local path — on Linux/Docker this will be just 'libreoffice' or 'soffice'
        $windowsPath = 'C:\\Program Files\\LibreOffice\\program\\soffice.exe';
        if (PHP_OS_FAMILY === 'Windows' && file_exists($windowsPath)) {
            return $windowsPath;
        }

        // Linux/Docker fallback
        return 'libreoffice';
    }

    private function isOfficeFile(string $mimeType): bool
    {
        return in_array($mimeType, [
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-powerpoint',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        ]);
    }

    public function delete(?string $thumbnailPath): void
    {
        if ($thumbnailPath) {
            Storage::disk('public')->delete($thumbnailPath);
        }
    }
}
