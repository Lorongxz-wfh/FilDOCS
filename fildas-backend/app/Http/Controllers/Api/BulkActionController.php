<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Document;
use App\Models\DocumentTemplate;
use App\Models\User;
use App\Models\Office;
use App\Traits\LogsActivityTrait;
use App\Traits\RoleNameTrait;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use ZipArchive;
use Illuminate\Support\Facades\DB;
use App\Http\Controllers\Api\Admin\TrashController;

class BulkActionController extends Controller
{
    use LogsActivityTrait, RoleNameTrait;

    /**
     * POST /api/bulk/documents/archive
     */
    public function archiveDocuments(Request $request)
    {
        $request->validate([
            'ids' => 'required|array',
            'ids.*' => 'integer|exists:documents,id'
        ]);

        $ids = $request->input('ids');
        $user = $request->user();
        $officeId = $user->office_id;
        $role = $this->roleNameOf($user);
        $isAdmin = in_array($role, ['admin', 'sysadmin', 'qa']);

        $documents = Document::whereIn('id', $ids)->get();
        $archivedCount = 0;

        foreach ($documents as $doc) {
            // Check if user is owner office or management
            if ($isAdmin || (int)$doc->owner_office_id === (int)$officeId) {
                if (!$doc->archived_at) {
                    $doc->archived_at = now();
                    $doc->save();
                    $archivedCount++;

                    $this->logActivity('document.archived', 'Archived document via bulk action', $user->id, $officeId, [
                        'document_id' => $doc->id,
                        'title' => $doc->title
                    ], $doc->id);
                }
            }
        }

        try {
            broadcast(new \App\Events\WorkspaceChanged('document'));
        } catch (\Throwable $e) {}

        return response()->json([
            'message' => "Successfully archived {$archivedCount} documents.",
            'count' => $archivedCount
        ]);
    }

    /**
     * POST /api/bulk/documents/unarchive
     */
    public function unarchiveDocuments(Request $request)
    {
        $request->validate([
            'ids' => 'required|array',
            'ids.*' => 'integer|exists:documents,id'
        ]);

        $ids = $request->input('ids');
        $user = $request->user();
        $officeId = $user->office_id;
        $role = $this->roleNameOf($user);
        $isAdmin = in_array($role, ['admin', 'sysadmin', 'qa']);

        $documents = Document::whereIn('id', $ids)->get();
        $restoredCount = 0;

        foreach ($documents as $doc) {
            if ($isAdmin || (int)$doc->owner_office_id === (int)$officeId) {
                if ($doc->archived_at) {
                    // Similar to single restore check
                    $latest = $doc->latestVersion;
                    if ($latest && in_array($latest->status, ['Cancelled', 'Superseded'])) {
                        continue;
                    }

                    $doc->archived_at = null;
                    $doc->save();
                    $restoredCount++;

                    $this->logActivity('document.restored', 'Unarchived document via bulk action', $user->id, $officeId, [
                        'document_id' => $doc->id,
                        'title' => $doc->title
                    ], $doc->id);
                }
            }
        }

        try {
            broadcast(new \App\Events\WorkspaceChanged('document'));
        } catch (\Throwable $e) {}

        return response()->json([
            'message' => "Successfully unarchived {$restoredCount} documents.",
            'count' => $restoredCount
        ]);
    }

    /**
     * POST /api/bulk/documents/delete
     */
    public function deleteDocuments(Request $request)
    {
        $request->validate([
            'ids' => 'required|array',
            'ids.*' => 'integer|exists:documents,id'
        ]);

        $ids = $request->input('ids');
        $user = $request->user();
        $officeId = $user->office_id;
        $role = $this->roleNameOf($user);
        $isAdmin = in_array($role, ['admin', 'sysadmin', 'qa']);

        $documents = Document::whereIn('id', $ids)->get();
        $deletedCount = 0;

        foreach ($documents as $doc) {
            // Ownership check or Admin
            if ($isAdmin || (int)$doc->owner_office_id === (int)$officeId) {
                $docId = $doc->id;
                $docTitle = $doc->title;
                $doc->delete();
                $deletedCount++;

                $this->logActivity('document.deleted', 'Deleted document via bulk action', $user->id, $officeId, [
                    'document_id' => $docId,
                    'title' => $docTitle
                ], $docId);
            }
        }

        try {
            broadcast(new \App\Events\WorkspaceChanged('document'));
        } catch (\Throwable $e) {}

        return response()->json([
            'message' => "Successfully deleted {$deletedCount} documents.",
            'count' => $deletedCount
        ]);
    }

    /**
     * GET /api/bulk/documents/download
     */
    public function downloadDocuments(Request $request)
    {
        $request->validate([
            'ids' => 'required|string', // comma separated
            'filename' => 'nullable|string|max:255'
        ]);

        $ids = explode(',', $request->query('ids'));
        $user = $request->user();
        $filename = $request->query('filename') ?: 'Documents_Export_' . now()->format('Y-m-d');
        $filename = Str::finish($filename, '.zip');

        $documents = Document::whereIn('id', $ids)->with('latestVersion')->get();
        
        $zipPath = storage_path('app/temp/' . Str::random(16) . '.zip');
        if (!is_dir(storage_path('app/temp'))) {
            mkdir(storage_path('app/temp'), 0755, true);
        }

        $zip = new ZipArchive;
        if ($zip->open($zipPath, ZipArchive::CREATE) !== TRUE) {
            return response()->json(['message' => 'Could not create ZIP file.'], 500);
        }

        $addedCount = 0;
        foreach ($documents as $doc) {
            $version = $doc->latestVersion;
            if (!$version || !$version->file_path) continue;

            $disk = config('filesystems.default');
            if (!Storage::disk($disk)->exists($version->file_path)) continue;

            $extension = pathinfo($version->original_filename, PATHINFO_EXTENSION);
            $entryName = Str::slug($doc->title) . '_v' . $version->version_number . ($extension ? '.' . $extension : '');
            
            // Handle duplicate names in zip
            $originalEntryName = $entryName;
            $counter = 1;
            while ($zip->locateName($entryName) !== false) {
                $entryName = pathinfo($originalEntryName, PATHINFO_FILENAME) . " ({$counter})." . $extension;
                $counter++;
            }

            $zip->addFromString($entryName, Storage::disk($disk)->get($version->file_path));
            $addedCount++;
        }

        $zip->close();

        if ($addedCount === 0) {
            @unlink($zipPath);
            return response()->json(['message' => 'No valid files found for download.'], 422);
        }

        $this->logActivity('bulk.download', "Downloaded {$addedCount} documents in a ZIP", $user->id, $user->office_id, [
            'count' => $addedCount,
            'ids' => $ids
        ]);

        return response()->download($zipPath, $filename)->deleteFileAfterSend(true);
    }

    /**
     * POST /api/bulk/templates/delete
     */
    public function deleteTemplates(Request $request)
    {
        $request->validate([
            'ids' => 'required|array',
            'ids.*' => 'integer|exists:document_templates,id'
        ]);

        $ids = $request->input('ids');
        $user = $request->user();
        $role = $this->roleNameOf($user);
        $isAdmin = in_array($role, ['admin', 'sysadmin', 'qa']);

        $templates = DocumentTemplate::whereIn('id', $ids)->get();
        $deletedCount = 0;

        foreach ($templates as $t) {
            // QA/Admin can delete any, others only their own
            if ($isAdmin || (int)$t->uploaded_by === (int)$user->id) {
                $tId = $t->id;
                $tName = $t->name;
                $t->delete();
                $deletedCount++;

                $this->logActivity('template.deleted', 'Deleted template via bulk action', $user->id, $user->office_id, [
                    'template_id' => $tId,
                    'name' => $tName
                ]);
            }
        }

        try {
            broadcast(new \App\Events\WorkspaceChanged('template'));
        } catch (\Throwable $e) {}

        return response()->json([
            'message' => "Successfully deleted {$deletedCount} templates.",
            'count' => $deletedCount
        ]);
    }

    /**
     * GET /api/bulk/templates/download
     */
    public function downloadTemplates(Request $request)
    {
        $request->validate([
            'ids' => 'required|string',
            'filename' => 'nullable|string|max:255'
        ]);

        $ids = explode(',', $request->query('ids'));
        $user = $request->user();
        $filename = $request->query('filename') ?: 'Templates_Export_' . now()->format('Y-m-d');
        $filename = Str::finish($filename, '.zip');

        $templates = DocumentTemplate::whereIn('id', $ids)->get();
        
        $zipPath = storage_path('app/temp/' . Str::random(16) . '.zip');
        if (!is_dir(storage_path('app/temp'))) {
            mkdir(storage_path('app/temp'), 0755, true);
        }

        $zip = new ZipArchive;
        if ($zip->open($zipPath, ZipArchive::CREATE) !== TRUE) {
            return response()->json(['message' => 'Could not create ZIP file.'], 500);
        }

        $addedCount = 0;
        foreach ($templates as $t) {
            if (!$t->file_path) continue;

            $disk = config('filesystems.default');
            if (!Storage::disk($disk)->exists($t->file_path)) continue;

            $extension = pathinfo($t->original_filename, PATHINFO_EXTENSION);
            $entryName = Str::slug($t->name) . ($extension ? '.' . $extension : '');
            
            $originalEntryName = $entryName;
            $counter = 1;
            while ($zip->locateName($entryName) !== false) {
                $entryName = pathinfo($originalEntryName, PATHINFO_FILENAME) . " ({$counter})." . $extension;
                $counter++;
            }

            $zip->addFromString($entryName, Storage::disk($disk)->get($t->file_path));
            $addedCount++;
        }

        $zip->close();

        if ($addedCount === 0) {
            @unlink($zipPath);
            return response()->json(['message' => 'No valid templates found for download.'], 422);
        }

        $this->logActivity('bulk.templates_download', "Downloaded {$addedCount} templates in a ZIP", $user->id, $user->office_id, [
            'count' => $addedCount,
            'ids' => $ids
        ]);

        return response()->download($zipPath, $filename)->deleteFileAfterSend(true);
    }

    /**
     * POST /api/bulk/trash/{type}/restore
     */
    public function restoreTrash(Request $request, $type)
    {
        $request->validate([
            'ids' => 'required|array',
            'password' => 'required|string',
            'code' => 'nullable|string',
        ]);

        // Security check reusing TrashController logic
        $trashCtrl = new TrashController();
        $verification = $trashCtrl->verify($request);
        if ($verification instanceof \Illuminate\Http\JsonResponse && $verification->getStatusCode() !== 200) {
            return $verification;
        }

        $ids = $request->input('ids');
        $user = $request->user();

        $modelClass = $this->getModelClass($type);
        if (!$modelClass) return response()->json(['message' => 'Invalid type.'], 400);

        $items = $modelClass::onlyTrashed()->whereIn('id', $ids)->get();
        $restoredCount = 0;

        foreach ($items as $item) {
            $item->restore();
            $restoredCount++;
            
            $this->logActivity('admin.bulk_restore', "Restored {$type} via bulk action", $user->id, $user->office_id, [
                'type' => $type,
                'id' => $item->id
            ]);
        }

        return response()->json([
            'message' => "Successfully restored {$restoredCount} items.",
            'count' => $restoredCount
        ]);
    }

    /**
     * POST /api/bulk/trash/{type}/purge
     */
    public function purgeTrash(Request $request, $type)
    {
        $request->validate([
            'ids' => 'required|array',
            'password' => 'required|string',
            'code' => 'nullable|string',
        ]);

        // Security check
        $trashCtrl = new TrashController();
        $verification = $trashCtrl->verify($request);
        if ($verification instanceof \Illuminate\Http\JsonResponse && $verification->getStatusCode() !== 200) {
            return $verification;
        }

        $ids = $request->input('ids');
        $user = $request->user();

        $modelClass = $this->getModelClass($type);
        if (!$modelClass) return response()->json(['message' => 'Invalid type.'], 400);

        $items = $modelClass::onlyTrashed()->whereIn('id', $ids)->get();
        $purgedCount = 0;

        foreach ($items as $item) {
            $itemId = $item->id;
            $item->forceDelete();
            $purgedCount++;
            
            $this->logActivity('admin.bulk_purge', "Permanently deleted {$type} via bulk action", $user->id, $user->office_id, [
                'type' => $type,
                'id' => $itemId
            ]);
        }

        return response()->json([
            'message' => "Successfully purged {$purgedCount} items.",
            'count' => $purgedCount
        ]);
    }

    /**
     * POST /api/bulk/users/delete
     */
    public function deleteUsers(Request $request)
    {
        $request->validate([
            'ids' => 'required|array',
            'ids.*' => 'integer|exists:users,id'
        ]);

        $ids = $request->input('ids');
        $user = $request->user();
        
        // Only Sysadmin/Admin
        if (!in_array($this->roleNameOf($user), ['admin', 'sysadmin'])) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $users = User::whereIn('id', $ids)->get();
        $deletedCount = 0;

        foreach ($users as $u) {
            // Cannot delete yourself
            if ($u->id === $user->id) continue;
            
            $uId = $u->id;
            $uName = $u->full_name;
            $u->delete();
            $deletedCount++;

            $this->logActivity('user.deleted', 'Deleted user via bulk action', $user->id, $user->office_id, [
                'user_id' => $uId,
                'name' => $uName
            ]);
        }

        return response()->json([
            'message' => "Successfully deleted {$deletedCount} users.",
            'count' => $deletedCount
        ]);
    }

    /**
     * POST /api/bulk/users/toggle-status
     */
    public function toggleUsersStatus(Request $request)
    {
        $request->validate([
            'ids' => 'required|array',
            'ids.*' => 'integer|exists:users,id',
            'disabled' => 'required|boolean'
        ]);

        $ids = $request->input('ids');
        $disabled = $request->input('disabled');
        $user = $request->user();
        
        if (!in_array($this->roleNameOf($user), ['admin', 'sysadmin'])) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $users = User::whereIn('id', $ids)->get();
        $updatedCount = 0;

        foreach ($users as $u) {
            if ($u->id === $user->id) continue;

            $u->disabled_at = $disabled ? now() : null;
            $u->save();
            $updatedCount++;

            $this->logActivity($disabled ? 'user.disabled' : 'user.enabled', 'Toggled user status via bulk action', $user->id, $user->office_id, [
                'user_id' => $u->id,
                'name' => $u->full_name,
                'disabled' => $disabled
            ]);
        }

        return response()->json([
            'message' => "Successfully updated status for {$updatedCount} users.",
            'count' => $updatedCount
        ]);
    }

    /**
     * POST /api/bulk/offices/delete
     */
    public function deleteOffices(Request $request)
    {
        $request->validate([
            'ids' => 'required|array',
            'ids.*' => 'integer|exists:offices,id'
        ]);

        $ids = $request->input('ids');
        $user = $request->user();
        
        if (!in_array($this->roleNameOf($user), ['admin', 'sysadmin'])) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $offices = Office::whereIn('id', $ids)->get();
        $deletedCount = 0;

        foreach ($offices as $o) {
            $oId = $o->id;
            $oCode = $o->code;
            $o->delete();
            $deletedCount++;

            $this->logActivity('office.deleted', 'Deleted office via bulk action', $user->id, $user->office_id, [
                'office_id' => $oId,
                'code' => $oCode
            ]);
        }

        return response()->json([
            'message' => "Successfully deleted {$deletedCount} offices.",
            'count' => $deletedCount
        ]);
    }

    private function getModelClass($type)
    {
        return match ($type) {
            'users'     => \App\Models\User::class,
            'offices'   => \App\Models\Office::class,
            'templates' => \App\Models\DocumentTemplate::class,
            'documents' => \App\Models\Document::class,
            'requests'  => \App\Models\DocumentRequest::class,
            default     => null
        };
    }
}
