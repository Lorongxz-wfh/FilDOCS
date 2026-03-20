<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\DocumentPreviewService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

class PreviewController extends Controller
{
    // POST /api/previews (auth)
    public function store(Request $request)
    {
        $request->validate([
            'file' => 'required|file|mimes:pdf,doc,docx,xls,xlsx,ppt,pptx|max:10240',
        ]);

        $year = now()->year;
        $previewId = (string) Str::uuid();
        $file = $request->file('file');
        $ext = strtolower($file->getClientOriginalExtension());
        $r2Folder = 'previews/' . $year . '/' . $previewId;

        $tmpDir = sys_get_temp_dir() . '/fildas/previews/' . $previewId;
        if (!is_dir($tmpDir)) {
            mkdir($tmpDir, 0775, true);
        }

        $originalName = 'original.' . $ext;
        $tmpOriginalPath = $tmpDir . '/' . $originalName;
        $file->move($tmpDir, $originalName);

        if ($ext === 'pdf') {
            $tmpPreviewPath = $tmpDir . '/preview.pdf';
            @copy($tmpOriginalPath, $tmpPreviewPath);
        } else {
            $previewFileName = DocumentPreviewService::generatePreview($tmpDir, $tmpOriginalPath);

            if (!$previewFileName) {
                return response()->json(['id' => null, 'year' => $year, 'url' => null], 200);
            }

            $tmpPreviewPath = $tmpDir . '/preview.pdf';
            @rename($tmpDir . '/' . $previewFileName, $tmpPreviewPath);
        }

        // Upload preview to storage
        \Illuminate\Support\Facades\Storage::disk()->putFileAs(
            $r2Folder,
            new \Illuminate\Http\File($tmpPreviewPath),
            'preview.pdf'
        );

        // Cleanup tmp
        @unlink($tmpOriginalPath);
        @unlink($tmpPreviewPath);
        @rmdir($tmpDir);

        $signedUrl = URL::temporarySignedRoute(
            'previews.preview',
            now()->addMinutes(60),
            ['year' => $year, 'preview' => $previewId]
        );

        return response()->json([
            'id' => $previewId,
            'year' => $year,
            'url' => $signedUrl,
        ], 201);
    }

    // GET /api/previews/{year}/{preview}/preview (signed)
    public function previewSigned(Request $request, int $year, string $preview)
    {
        $r2Path = 'previews/' . $year . '/' . $preview . '/preview.pdf';

        if (!\Illuminate\Support\Facades\Storage::disk()->exists($r2Path)) {
            return response()->json(['message' => 'Preview not found.'], Response::HTTP_NOT_FOUND);
        }

        $stream = \Illuminate\Support\Facades\Storage::disk()->readStream($r2Path);

        return response()->stream(function () use ($stream) {
            fpassthru($stream);
        }, 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'inline; filename="preview.pdf"',
        ]);
    }

    // DELETE /api/previews/{year}/{preview} (auth)
    public function destroy(Request $request, int $year, string $preview)
    {
        $r2Folder = 'previews/' . $year . '/' . $preview;
        $files = \Illuminate\Support\Facades\Storage::disk()->allFiles($r2Folder);
        \Illuminate\Support\Facades\Storage::disk()->delete($files);

        return response()->json(['message' => 'Preview deleted.'], 200);
    }

    private function rrmdir(string $dir): void
    {
        if (!is_dir($dir)) return;

        $items = scandir($dir);
        if (!$items) return;

        foreach ($items as $item) {
            if ($item === '.' || $item === '..') continue;
            $path = $dir . DIRECTORY_SEPARATOR . $item;

            if (is_dir($path)) $this->rrmdir($path);
            else @unlink($path);
        }

        @rmdir($dir);
    }
}
