<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Traits\RoleNameTrait;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;

class DocumentRequestFileController extends Controller
{
    use RoleNameTrait;

    private function canViewDocumentRequest(User $user, object $requestRow): bool
    {
        $role = $this->roleNameOf($user);

        // QA/SYSADMIN can view everything
        if (in_array($role, ['qa', 'sysadmin', 'admin'], true)) return true;

        $officeId = (int) ($user->office_id ?? 0);
        if ($officeId <= 0) return false;

        // Recipient office users can view their own requests
        return DB::table('document_request_recipients')
            ->where('request_id', (int) $requestRow->id)
            ->where('office_id', $officeId)
            ->exists();
    }

    private function canViewSubmissionFile(User $user, object $fileRow): bool
    {
        $role = $this->roleNameOf($user);
        if (in_array($role, ['qa', 'sysadmin', 'admin'], true)) return true;

        $officeId = (int) ($user->office_id ?? 0);
        if ($officeId <= 0) return false;

        // Walk: file -> submission -> recipient (office)
        $recipientOfficeId = DB::table('document_request_submission_files as f')
            ->join('document_request_submissions as s', 's.id', '=', 'f.submission_id')
            ->join('document_request_recipients as r', 'r.id', '=', 's.recipient_id')
            ->where('f.id', (int) $fileRow->id)
            ->value('r.office_id');

        return (int) $recipientOfficeId === $officeId;
    }

    private function storageRoot(): string
    {
        return base_path(env('DOC_STORAGE_PATH', '../documents'));
    }

    // ---------- Request example: preview-link ----------
    public function requestExamplePreviewLink(Request $request, int $requestId)
    {
        $ttlMinutes = 60;

        $me = $request->user();
        $userId = (int) ($me?->id ?? 0);
        if ($userId <= 0) return response()->json(['message' => 'Unauthorized.'], 401);

        $row = DB::table('document_requests')->where('id', $requestId)->first();
        if (!$row) return response()->json(['message' => 'Not found'], 404);
        if (!$row->example_preview_path) return response()->json(['message' => 'Preview not available.'], 404);

        if (!$this->canViewDocumentRequest($me, $row)) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $cacheKey = "document_request:req{$requestId}:example:preview_link:uid{$userId}:ttl{$ttlMinutes}";

        $payload = Cache::remember($cacheKey, ($ttlMinutes - 5) * 60, function () use ($requestId, $ttlMinutes, $userId) {
            $signedUrl = URL::temporarySignedRoute(
                'document-requests.example.preview',
                now()->addMinutes($ttlMinutes),
                ['request' => $requestId, 'uid' => $userId]
            );

            return ['url' => $signedUrl, 'expires_in_minutes' => $ttlMinutes];
        });

        return response()->json($payload);
    }

    public function requestExamplePreviewSigned(Request $request, int $requestId)
    {
        $uid = (int) ($request->query('uid') ?? 0);
        if ($uid <= 0) return response()->json(['message' => 'Missing uid.'], 422);

        $user = User::find($uid);
        if (!$user) return response()->json(['message' => 'User not found.'], 404);

        $row = DB::table('document_requests')->where('id', $requestId)->first();
        if (!$row) return response()->json(['message' => 'Not found'], 404);
        if (!$row->example_preview_path) return response()->json(['message' => 'Preview not available.'], 404);

        if (!$this->canViewDocumentRequest($user, $row)) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        /** @var \Illuminate\Filesystem\FilesystemAdapter $disk */
        $disk = Storage::disk();
        if (!$disk->exists($row->example_preview_path)) {
            return response()->json(['message' => 'Preview file not found on server.'], 404);
        }

        $stream = $disk->readStream($row->example_preview_path);
        $mime = $disk->mimeType($row->example_preview_path) ?: 'application/pdf';

        return response()->stream(function () use ($stream) {
            fpassthru($stream);
        }, 200, [
            'Content-Type' => $mime,
            'Content-Disposition' => 'inline; filename="' . ($row->example_original_filename ?? 'preview.pdf') . '"',
        ]);
    }

    // ---------- Request example: download-link ----------
    public function requestExampleDownloadLink(Request $request, int $requestId)
    {
        $ttlMinutes = 60;

        $me = $request->user();
        $userId = (int) ($me?->id ?? 0);
        if ($userId <= 0) return response()->json(['message' => 'Unauthorized.'], 401);

        $row = DB::table('document_requests')->where('id', $requestId)->first();
        if (!$row) return response()->json(['message' => 'Not found'], 404);
        if (!$row->example_file_path) return response()->json(['message' => 'No file available.'], 404);

        if (!$this->canViewDocumentRequest($me, $row)) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $cacheKey = "document_request:req{$requestId}:example:download_link:uid{$userId}:ttl{$ttlMinutes}";

        $payload = Cache::remember($cacheKey, ($ttlMinutes - 5) * 60, function () use ($requestId, $ttlMinutes, $userId) {
            $signedUrl = URL::temporarySignedRoute(
                'document-requests.example.download',
                now()->addMinutes($ttlMinutes),
                ['request' => $requestId, 'uid' => $userId]
            );

            return ['url' => $signedUrl, 'expires_in_minutes' => $ttlMinutes];
        });

        return response()->json($payload);
    }

    public function requestExampleDownloadSigned(Request $request, int $requestId)
    {
        $uid = (int) ($request->query('uid') ?? 0);
        if ($uid <= 0) return response()->json(['message' => 'Missing uid.'], 422);

        $user = User::find($uid);
        if (!$user) return response()->json(['message' => 'User not found.'], 404);

        $row = DB::table('document_requests')->where('id', $requestId)->first();
        if (!$row) return response()->json(['message' => 'Not found'], 404);
        if (!$row->example_file_path) return response()->json(['message' => 'No file available.'], 404);

        if (!$this->canViewDocumentRequest($user, $row)) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        /** @var \Illuminate\Filesystem\FilesystemAdapter $disk */
        $disk = Storage::disk();
        if (!$disk->exists($row->example_file_path)) {
            return response()->json(['message' => 'File not found on server.'], 404);
        }

        $downloadName = $row->example_original_filename ?? 'document_request_example';

        return $disk->download($row->example_file_path, $downloadName);
    }

    // ---------- Submission file: preview-link ----------
    public function submissionFilePreviewLink(Request $request, int $fileId)
    {
        $ttlMinutes = 60;

        $me = $request->user();
        $userId = (int) ($me?->id ?? 0);
        if ($userId <= 0) return response()->json(['message' => 'Unauthorized.'], 401);

        $row = DB::table('document_request_submission_files')->where('id', $fileId)->first();
        if (!$row) return response()->json(['message' => 'Not found'], 404);
        if (!$row->preview_path) return response()->json(['message' => 'Preview not available.'], 404);

        if (!$this->canViewSubmissionFile($me, $row)) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $cacheKey = "document_request:file{$fileId}:preview_link:uid{$userId}:ttl{$ttlMinutes}";

        $payload = Cache::remember($cacheKey, ($ttlMinutes - 5) * 60, function () use ($fileId, $ttlMinutes, $userId) {
            $signedUrl = URL::temporarySignedRoute(
                'document-request-submission-files.preview',
                now()->addMinutes($ttlMinutes),
                ['file' => $fileId, 'uid' => $userId]
            );

            return ['url' => $signedUrl, 'expires_in_minutes' => $ttlMinutes];
        });

        return response()->json($payload);
    }

    public function submissionFilePreviewSigned(Request $request, int $fileId)
    {
        $uid = (int) ($request->query('uid') ?? 0);
        if ($uid <= 0) return response()->json(['message' => 'Missing uid.'], 422);

        $user = User::find($uid);
        if (!$user) return response()->json(['message' => 'User not found.'], 404);

        $row = DB::table('document_request_submission_files')->where('id', $fileId)->first();
        if (!$row) return response()->json(['message' => 'Not found'], 404);
        if (!$row->preview_path) return response()->json(['message' => 'Preview not available.'], 404);

        if (!$this->canViewSubmissionFile($user, $row)) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        /** @var \Illuminate\Filesystem\FilesystemAdapter $disk */
        $disk = Storage::disk();
        if (!$disk->exists($row->preview_path)) {
            return response()->json(['message' => 'Preview file not found on server.'], 404);
        }

        $stream = $disk->readStream($row->preview_path);
        $mime = $disk->mimeType($row->preview_path) ?: 'application/pdf';

        return response()->stream(function () use ($stream) {
            fpassthru($stream);
        }, 200, [
            'Content-Type' => $mime,
            'Content-Disposition' => 'inline; filename="' . ($row->original_filename ?? 'preview.pdf') . '"',
        ]);
    }

    // ---------- Submission file: download-link ----------
    public function submissionFileDownloadLink(Request $request, int $fileId)
    {
        $ttlMinutes = 60;

        $me = $request->user();
        $userId = (int) ($me?->id ?? 0);
        if ($userId <= 0) return response()->json(['message' => 'Unauthorized.'], 401);

        $row = DB::table('document_request_submission_files')->where('id', $fileId)->first();
        if (!$row) return response()->json(['message' => 'Not found'], 404);
        if (!$row->file_path) return response()->json(['message' => 'No file available.'], 404);

        if (!$this->canViewSubmissionFile($me, $row)) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $cacheKey = "document_request:file{$fileId}:download_link:uid{$userId}:ttl{$ttlMinutes}";

        $payload = Cache::remember($cacheKey, ($ttlMinutes - 5) * 60, function () use ($fileId, $ttlMinutes, $userId) {
            $signedUrl = URL::temporarySignedRoute(
                'document-request-submission-files.download',
                now()->addMinutes($ttlMinutes),
                ['file' => $fileId, 'uid' => $userId]
            );

            return ['url' => $signedUrl, 'expires_in_minutes' => $ttlMinutes];
        });

        return response()->json($payload);
    }

    public function submissionFileDownloadSigned(Request $request, int $fileId)
    {
        $uid = (int) ($request->query('uid') ?? 0);
        if ($uid <= 0) return response()->json(['message' => 'Missing uid.'], 422);

        $user = User::find($uid);
        if (!$user) return response()->json(['message' => 'User not found.'], 404);

        $row = DB::table('document_request_submission_files')->where('id', $fileId)->first();
        if (!$row) return response()->json(['message' => 'Not found'], 404);
        if (!$row->file_path) return response()->json(['message' => 'No file available.'], 404);

        if (!$this->canViewSubmissionFile($user, $row)) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        /** @var \Illuminate\Filesystem\FilesystemAdapter $disk */
        $disk = Storage::disk();
        if (!$disk->exists($row->file_path)) {
            return response()->json(['message' => 'File not found on server.'], 404);
        }

        $downloadName = $row->original_filename ?? 'document_request_submission_file';

        return $disk->download($row->file_path, $downloadName);
    }
}
