<?php

namespace App\Services;

use Illuminate\Support\Facades\Log;

class DocumentPreviewService
{
    public static function generatePreview(string $outputFolder, string $originalFullPath): ?string
    {
        $libreOffice = env('LIBREOFFICE_PATH');

        if (! $libreOffice || ! file_exists($libreOffice)) {
            Log::warning('Preview skipped: LibreOffice not configured', [
                'LIBREOFFICE_PATH' => $libreOffice,
                'original' => $originalFullPath,
            ]);
            return null;
        }

        $previewFolder = $outputFolder;
        if (! is_dir($previewFolder)) {
            mkdir($previewFolder, 0775, true);
        }


        $command = sprintf(
            '"%s" --headless --convert-to pdf --outdir "%s" "%s"',
            $libreOffice,
            $previewFolder,
            $originalFullPath
        );

        $output = [];
        $resultCode = 0;
        exec($command . ' 2>&1', $output, $resultCode);

        if ($resultCode !== 0) {
            Log::error('Preview generation failed (LibreOffice)', [
                'cmd' => $command,
                'code' => $resultCode,
                'output' => $output,
                'original' => $originalFullPath,
                'outdir' => $previewFolder,
            ]);
            return null;
        }

        $baseName = pathinfo($originalFullPath, PATHINFO_FILENAME);
        $previewFullPath = $previewFolder . DIRECTORY_SEPARATOR . $baseName . '.pdf';

        if (! file_exists($previewFullPath)) {
            Log::error('Preview generation missing output file', [
                'expected' => $previewFullPath,
                'cmd' => $command,
                'output' => $output,
            ]);
            return null;
        }

        return basename($previewFullPath);
    }
}
