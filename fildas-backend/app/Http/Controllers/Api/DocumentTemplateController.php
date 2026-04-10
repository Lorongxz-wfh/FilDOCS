<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\User;
use App\Models\DocumentTemplate;
use App\Traits\RoleNameTrait;
use App\Traits\LogsActivityTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\URL;
use App\Services\ThumbnailService;

class DocumentTemplateController extends Controller
{
    use RoleNameTrait, LogsActivityTrait;

    // ── GET /api/templates ───────────────────────────────────

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $allowedSorts = ['name', 'created_at', 'mime_type', 'file_size'];
        $sortBy  = in_array($request->query('sort_by'), $allowedSorts, true)
            ? $request->query('sort_by') : 'created_at';
        $sortDir = $request->query('sort_dir') === 'asc' ? 'asc' : 'desc';

        $role = $this->roleNameOf($user);
        $isMgmt = in_array($role, ['admin', 'sysadmin', 'qa'], true);

        $query = DocumentTemplate::with(['uploader:id,first_name,last_name', 'office:id,name,code', 'tags'])
            ->where(function ($q) use ($user, $isMgmt) {
                if ($isMgmt) {
                    return; // Management (QA/Admin/SysAdmin) sees all
                }

                $q->whereNull('office_id');
                if ($user->office_id) {
                    $q->orWhere('office_id', $user->office_id);
                }
            })
            ->orderBy($sortBy, $sortDir);

        // Optional search
        if ($search = trim((string) $request->query('q', ''))) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('description', 'like', "%{$search}%")
                    ->orWhere('original_filename', 'like', "%{$search}%")
                    ->orWhereHas('tags', fn($tq) => $tq->where('name', 'like', "%{$search}%"));
            });
        }

        // Optional tag filter
        if ($tag = trim((string) $request->query('tag', ''))) {
            $query->whereHas('tags', fn($tq) => $tq->where('name', $tag));
        }

        $templates = $query->get()->map(fn(DocumentTemplate $t) => $this->format($t, $user));

        return response()->json(['data' => $templates]);
    }

    // ── POST /api/templates ──────────────────────────────────

    public function store(Request $request): JsonResponse
    {
        $this->authorize('create', DocumentTemplate::class);

        $request->validate([
            'name'        => 'required|string|max:255',
            'description' => 'nullable|string|max:1000',
            'file'        => 'required|file|max:20480|mimes:pdf,doc,docx,xls,xlsx,ppt,pptx',
            'is_global'   => 'nullable|boolean',
        ]);

        $user = $request->user();
        $file = $request->file('file');

        $role = $this->roleNameOf($user);

        // Admin → always global (has no office)
        // QA / sysadmin → can choose via is_global param (defaults to office-scoped)
        // Everyone else → always office-scoped
        if ($role === 'admin') {
            $isGlobal = true;
        } elseif (in_array($role, ['qa', 'sysadmin'])) {
            $isGlobal = filter_var($request->input('is_global', false), FILTER_VALIDATE_BOOLEAN);
        } else {
            $isGlobal = false;
        }

        $officeId = $isGlobal ? null : $user->office_id;
        $officeCode = 'global';
        if ($officeId) {
            $office = \App\Models\Office::find($officeId);
            if ($office) $officeCode = $office->code;
        }

        $disk = config('filesystems.default');
        $path = $file->store("templates/{$officeCode}", $disk);

        $mimeType = $file->getMimeType() ?? $file->getClientMimeType();

        $template = DocumentTemplate::create([
            'name'              => trim($request->input('name')),
            'description'       => trim($request->input('description', '')) ?: null,
            'original_filename' => $file->getClientOriginalName(),
            'file_path'         => $path,
            'file_size'         => $file->getSize(),
            'mime_type'         => $mimeType,
            'uploaded_by'       => $user->id,
            'office_id'         => $officeId,
        ]);

        // Sync tags if provided
        if ($request->has('tags')) {
            $tagNames = collect($request->input('tags', []))
                ->map(fn($t) => trim($t))
                ->filter()
                ->unique()
                ->values();

            $tagIds = $tagNames->map(function ($name) {
                return \App\Models\TemplateTag::firstOrCreate(['name' => $name])->id;
            });

            $template->tags()->sync($tagIds);
        }

        // Generate thumbnail in the background (best-effort)
        try {
            $thumbnailService = app(ThumbnailService::class);
            $thumbPath = $thumbnailService->generateForTemplate($path, $mimeType, $disk);
            if ($thumbPath) {
                $template->thumbnail_path = $thumbPath;
                $template->save();
            }
        } catch (\Throwable $e) {
            // Never fail the upload due to thumbnail error
        }

        $template->load(['uploader:id,first_name,last_name', 'office:id,name,code', 'tags']);

        $this->logActivity('template.created', 'Created a template', $user->id, $user->office_id, [
            'template_id' => $template->id,
            'name'        => $template->name,
            'scope'       => $isGlobal ? 'global' : 'office',
        ]);

        return response()->json(['template' => $this->format($template, $user)], 201);
    }

    // ── DELETE /api/templates/{template} ────────────────────

    public function destroy(Request $request, DocumentTemplate $template): JsonResponse
    {
        $this->authorize('delete', $template);

        $user = $request->user();
        $templateName = $template->name;
        $templateId   = $template->id;

        $template->delete();

        $this->logActivity('template.deleted', 'Deleted a template', $user->id, $user->office_id, [
            'template_id' => $templateId, 
            'name' => $templateName
        ]);

        try {
            broadcast(new \App\Events\WorkspaceChanged('template'));
        } catch (\Throwable) {}

        return response()->json(['message' => 'Template deleted.']);
    }

    // ── GET /api/templates/{template}/download ───────────────

    public function download(Request $request, DocumentTemplate $template)
    {
        $this->authorize('download', $template);

        $path = $template->file_path;
        $disk = config('filesystems.default');
        $storage = Storage::disk($disk);

        if (!$storage->exists($path)) {
            // Aggressive path healing for legacy data
            $filename = basename($path);
            $officeCode = $template->office ? $template->office->code : 'global';
            
            $alternatives = [
                "templates/global/{$filename}",
                "templates/{$officeCode}/{$filename}",
                "document_templates/{$filename}",
                "templates/{$filename}",
            ];

            foreach ($alternatives as $alt) {
                if ($storage->exists($alt)) {
                    $path = $alt;
                    break;
                }
            }

            if (!$storage->exists($path)) {
                return response()->json(['message' => 'File not found on server.'], 404);
            }
        }

        /** @var \Illuminate\Filesystem\FilesystemAdapter $storage */
        $storage = Storage::disk($disk);

        $extension = pathinfo($template->original_filename, PATHINFO_EXTENSION);
        $downloadName = Str::slug($template->name) . ($extension ? '.' . $extension : '');

        return $storage->download(
            $path,
            $downloadName
        );
    }

    // ── PATCH /api/templates/{template}/tags ─────────────────

    public function updateTags(Request $request, DocumentTemplate $template): JsonResponse
    {
        $this->authorize('delete', $template); // reuse — only uploader/admin

        $request->validate([
            'tags'   => 'present|array',
            'tags.*' => 'string|max:50',
        ]);

        $tagNames = collect($request->input('tags', []))
            ->map(fn($t) => trim($t))
            ->filter()
            ->unique()
            ->values();

        $tagIds = $tagNames->map(function ($name) {
            return \App\Models\TemplateTag::firstOrCreate(['name' => $name])->id;
        });

        $template->tags()->sync($tagIds);
        $template->load('tags');

        $this->logActivity('template.tags_updated', 'Updated template tags', $request->user()->id, $request->user()->office_id, ['template_id' => $template->id, 'name' => $template->name]);

        return response()->json([
            'tags' => $template->tags->pluck('name')->values()->all(),
        ]);
    }

    // ── GET /api/templates/{template}/thumbnail ───────────────
    public function thumbnail(Request $request, DocumentTemplate $template)
    {
        // Must be signed or have a valid auth session (this route is signed)
        if (!$template->thumbnail_path) {
            return response()->json(['message' => 'No thumbnail available.'], 404);
        }

        $disk = config('filesystems.default');

        if (!Storage::disk($disk)->exists($template->thumbnail_path)) {
            return response()->json(['message' => 'Thumbnail file not found.'], 404);
        }

        $stream = Storage::disk($disk)->readStream($template->thumbnail_path);

        return response()->stream(function () use ($stream) {
            fpassthru($stream);
            if (is_resource($stream)) fclose($stream);
        }, 200, [
            'Content-Type'  => 'image/png', // Thumbnails are generated as PNG by ThumbnailService
            'Cache-Control' => 'private, max-age=86400, must-revalidate',
        ]);
    }

    /**
     * Generate a signed link for template preview.
     */
    public function previewLink(Request $request, DocumentTemplate $template)
    {
        $this->authorize('download', $template);

        $url = URL::temporarySignedRoute(
            'templates.preview',
            now()->addMinutes(60),
            ['template' => $template->id, 'uid' => $request->user()->id]
        );

        return response()->json(['url' => $url, 'expires_in_minutes' => 60]);
    }

    /**
     * Stream template file for inline preview (signed).
     */
    public function preview(Request $request, DocumentTemplate $template)
    {
        $uid = (int) $request->query('uid');
        if ($uid <= 0) abort(422, 'Missing uid.');

        $user = User::find($uid);
        if (!$user) abort(404, 'User not found.');

        // Authorization check: User can see if global OR from the same office.
        // This matches the logic in DocumentTemplatePolicy@canSee and @download.
        $isGlobal = (int) ($template->office_id ?? 0) <= 0;
        $isSameOffice = (int) ($template->office_id ?? 0) === (int) ($user->office_id ?? 0);

        // Simple role check for admin/sysadmin/qa
        $role = strtolower((string) ($user->role?->name ?? $user->role ?? ''));
        $isManagement = in_array($role, ['admin', 'sysadmin', 'qa']);

        if (!$isGlobal && !$isSameOffice && !$isManagement) {
            abort(403, 'Unauthorized access to this template.');
        }

        $path = $template->file_path;
        $disk = config('filesystems.default');
        $storage = Storage::disk($disk);

        if (!$storage->exists($path)) {
            // Aggressive path healing for legacy data
            $filename = basename($path);
            $officeCode = $template->office ? $template->office->code : 'global';
            
            $alternatives = [
                "templates/global/{$filename}",
                "templates/{$officeCode}/{$filename}",
                "document_templates/{$filename}",
                "templates/{$filename}",
            ];

            foreach ($alternatives as $alt) {
                if ($storage->exists($alt)) {
                    $path = $alt;
                    break;
                }
            }

            if (!$storage->exists($path)) {
                abort(404, 'File not found on server.');
            }
        }

        $mime = $template->mime_type ?? 'application/pdf';

        return response()->stream(function () use ($path, $storage) {
            $stream = $storage->readStream($path);
            fpassthru($stream);
            if (is_resource($stream)) fclose($stream);
        }, 200, [
            'Content-Type'        => $mime,
            'Content-Disposition' => 'inline; filename="' . $template->original_filename . '"',
            'Cache-Control'       => 'private, max-age=3600',
        ]);
    }

    // ── Private helpers ──────────────────────────────────────

    private function format(DocumentTemplate $t, $user): array
    {
        $role     = $this->roleNameOf($user);
        $isAdmin  = $role === 'admin';
        $canDelete = $isAdmin || $t->uploaded_by === $user->id;

        return [
            'id'                => $t->id,
            'name'              => $t->name,
            'description'       => $t->description,
            'original_filename' => $t->original_filename,
            'file_size'         => $t->file_size,
            'file_size_label'   => $t->formattedSize(),
            'mime_type'         => $t->mime_type,
            'is_global'         => $t->isGlobal(),
            'office'            => $t->office ? [
                'id'   => $t->office->id,
                'name' => $t->office->name,
                'code' => $t->office->code,
            ] : null,
            'uploaded_by' => $t->uploader ? [
                'id'   => $t->uploader->id,
                'name' => trim("{$t->uploader->first_name} {$t->uploader->last_name}"),
            ] : null,
            'can_delete'      => $canDelete,
            'thumbnail_url'   => $t->thumbnail_url, // Using virtual attribute
            'tags'            => $t->tags->pluck('name')->values()->all(),
            'created_at'      => $t->created_at?->toISOString(),
        ];
    }
}
