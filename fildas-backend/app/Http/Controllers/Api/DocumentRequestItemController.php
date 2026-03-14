<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Services\DocumentRequests\DocumentRequestFileService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;

class DocumentRequestItemController extends Controller
{
    public function __construct(private DocumentRequestFileService $files) {}

    private function roleName(Request $request): string
    {
        $user = $request->user();
        $raw  =
            (optional($user?->role)->name ?? null) ??
            ($user?->role_name ?? null) ??
            ($user?->role ?? null) ??
            '';
        return strtolower(trim((string) $raw));
    }

    // POST /api/document-request-items/{item}/example
    public function uploadExample(Request $request, int $itemId)
    {
        $role = $this->roleName($request);
        if (!in_array($role, ['qa', 'sysadmin', 'admin'], true)) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $request->validate([
            'example_file' => 'required|file|mimes:pdf,doc,docx,xls,xlsx,ppt,pptx|max:10240',
        ]);

        $item = DB::table('document_request_items')->where('id', $itemId)->first();
        if (!$item) return response()->json(['message' => 'Item not found.'], 404);

        $payload = $this->files->saveRequestItemExampleFile($itemId, $request->file('example_file'));

        DB::table('document_request_items')->where('id', $itemId)->update([
            'example_original_filename' => $payload['original_filename'],
            'example_file_path'         => $payload['file_path'],
            'example_preview_path'      => $payload['preview_path'],
            'updated_at'                => now(),
        ]);

        ActivityLog::create([
            'document_id'         => null,
            'document_version_id' => null,
            'actor_user_id'       => $request->user()->id,
            'actor_office_id'     => $request->user()->office_id,
            'target_office_id'    => null,
            'event'               => 'document_request_item.example_uploaded',
            'label'               => 'Uploaded example file for document request item',
            'meta'                => [
                'item_id'    => $itemId,
                'request_id' => $item->request_id,
                'filename'   => $payload['original_filename'],
            ],
        ]);

        return response()->json([
            'message'                   => 'Example file uploaded.',
            'example_original_filename' => $payload['original_filename'],
            'example_file_path'         => $payload['file_path'],
            'example_preview_path'      => $payload['preview_path'],
        ]);
    }

    // GET /api/document-request-items/{item}/example/preview-link
    public function examplePreviewLink(Request $request, int $itemId)
    {
        $item = DB::table('document_request_items')->where('id', $itemId)->first();
        if (!$item || !$item->example_preview_path) {
            return response()->json(['message' => 'No preview available.'], 404);
        }

        $url = URL::temporarySignedRoute(
            'document-request-items.example.preview',
            now()->addMinutes(30),
            ['item' => $itemId]
        );

        return response()->json(['url' => $url, 'expires_in_minutes' => 30]);
    }

    // GET /api/document-request-items/{item}/example/preview (signed)
    public function examplePreviewSigned(Request $request, int $itemId)
    {
        $item = DB::table('document_request_items')->where('id', $itemId)->first();
        if (!$item || !$item->example_preview_path) {
            abort(404);
        }

        if (!Storage::disk()->exists($item->example_preview_path)) {
            abort(404);
        }

        $ext      = strtolower(pathinfo($item->example_preview_path, PATHINFO_EXTENSION));
        $mimeMap  = ['pdf' => 'application/pdf', 'png' => 'image/png', 'jpg' => 'image/jpeg'];
        $mimeType = $mimeMap[$ext] ?? 'application/octet-stream';

        return response()->stream(function () use ($item) {
            $stream = Storage::disk()->readStream($item->example_preview_path);
            fpassthru($stream);
            fclose($stream);
        }, 200, [
            'Content-Type'        => $mimeType,
            'Content-Disposition' => 'inline; filename="preview.' . $ext . '"',
            'Cache-Control'       => 'private, max-age=1800',
        ]);
    }
}
