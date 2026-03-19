<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\DocumentTemplate;
use App\Traits\RoleNameTrait;
use App\Traits\LogsActivityTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use App\Services\ThumbnailService;

class DocumentTemplateController extends Controller
{
    use RoleNameTrait, LogsActivityTrait;

    // ── GET /api/templates ───────────────────────────────────

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $query = DocumentTemplate::with(['uploader:id,first_name,last_name', 'office:id,name,code', 'tags'])
            ->where(function ($q) use ($user) {
                // Global templates (Admin/QA uploads) — everyone sees these
                $q->whereNull('office_id');

                // Office-scoped templates — only own office
                if ($user->office_id) {
                    $q->orWhere('office_id', $user->office_id);
                }
            })
            ->latest();

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

        $templates = $query->get()->map(fn($t) => $this->format($t, $user));

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

        $disk = config('filesystems.default');
        $path = $file->store('document_templates', $disk);

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
            $storagePath = Storage::disk('public')->path($path);
            // Copy file to public disk if on a different disk
            if ($disk !== 'public') {
                $contents = Storage::disk($disk)->get($path);
                Storage::disk('public')->put($path, $contents);
                $storagePath = Storage::disk('public')->path($path);
            }
            $thumbPath = $thumbnailService->generateForTemplate($path, $mimeType);
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

        // Remove the file from storage
        $disk = config('filesystems.default');

        if ($template->file_path && Storage::disk($disk)->exists($template->file_path)) {
            Storage::disk($disk)->delete($template->file_path);
        }

        // Delete thumbnail
        if ($template->thumbnail_path) {
            Storage::disk('public')->delete($template->thumbnail_path);
        }

        $user = $request->user();
        $templateName = $template->name;
        $templateId   = $template->id;

        $template->forceDelete(); // hard delete; use delete() if you want soft-delete history

        $this->logActivity('template.deleted', 'Deleted a template', $user->id, $user->office_id, ['template_id' => $templateId, 'name' => $templateName]);

        return response()->json(['message' => 'Template deleted.']);
    }

    // ── GET /api/templates/{template}/download ───────────────

    public function download(Request $request, DocumentTemplate $template)
    {
        $this->authorize('download', $template);

        $disk = config('filesystems.default');

        if (!Storage::disk($disk)->exists($template->file_path)) {
            return response()->json(['message' => 'File not found.'], 404);
        }

        /** @var \Illuminate\Filesystem\FilesystemAdapter $storage */
        $storage = Storage::disk($disk);

        return $storage->download(
            $template->file_path,
            $template->original_filename
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
            'thumbnail_url'   => $t->thumbnail_path ? asset('storage/' . $t->thumbnail_path) : null,
            'tags'            => $t->tags->pluck('name')->values()->all(),
            'created_at'      => $t->created_at?->toISOString(),
        ];
    }
}
