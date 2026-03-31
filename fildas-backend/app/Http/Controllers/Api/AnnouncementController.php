<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Announcement;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class AnnouncementController extends Controller
{
    // All authenticated users — active announcements only
    public function index(): JsonResponse
    {
        $announcements = Announcement::with('creator:id,first_name,middle_name,last_name,suffix')
            ->active()
            ->ordered()
            ->get()
            ->map(fn($a) => [
                'id'           => $a->id,
                'title'        => $a->title,
                'body'         => $a->body,
                'type'         => $a->type,
                'is_pinned'    => $a->is_pinned,
                'expires_at'   => $a->expires_at?->toISOString(),
                'created_at'   => $a->created_at->toISOString(),
                'created_by'   => $a->creator->full_name ?? 'QA',
            ]);

        return response()->json($announcements);
    }

    // All announcements ever — for the full list page
    public function all(): JsonResponse
    {
        $announcements = Announcement::with('creator:id,first_name,middle_name,last_name,suffix')
            ->ordered()
            ->paginate(20);

        return response()->json([
            'data' => collect($announcements->items())->map(fn($a) => [
                'id'           => $a->id,
                'title'        => $a->title,
                'body'         => $a->body,
                'type'         => $a->type,
                'is_pinned'    => $a->is_pinned,
                'is_archived'  => $a->archived_at !== null,
                'expires_at'   => $a->expires_at?->toISOString(),
                'archived_at'  => $a->archived_at?->toISOString(),
                'created_at'   => $a->created_at->toISOString(),
                'created_by'   => $a->creator->full_name ?? 'QA',
            ]),
            'meta' => [
                'current_page' => $announcements->currentPage(),
                'last_page'    => $announcements->lastPage(),
                'total'        => $announcements->total(),
            ],
        ]);
    }

    // QA + Admin only
    public function store(Request $request): JsonResponse
    {
        $this->authorizeRole($request);

        $data = $request->validate([
            'title'      => 'required|string|max:255',
            'body'       => 'required|string|max:2000',
            'type'       => 'required|in:info,warning,urgent',
            'is_pinned'  => 'boolean',
            'expires_at' => 'nullable|date|after:now',
        ]);

        $announcement = Announcement::create([
            ...$data,
            'created_by' => $request->user()->id,
        ]);

        $announcement->load('creator:id,first_name,middle_name,last_name,suffix');

        $typeLabel   = ucfirst($announcement->type);
        $pinnedLabel = $announcement->is_pinned ? 'Yes' : 'No';
        $expiresLabel = $announcement->expires_at
            ? $announcement->expires_at->format('F j, Y g:i A')
            : 'No expiry set';

        $this->log($request, 'announcement.created', "Posted a new announcement: \"{$announcement->title}\"", [
            'Announcement ID' => $announcement->id,
            'Title'           => $announcement->title,
            'Priority'        => $typeLabel,
            'Pinned'          => $pinnedLabel,
            'Expires'         => $expiresLabel,
            'Posted by'       => $request->user()->full_name,
        ]);

        // Push in-app notification to all active users (except the author)
        $authorId  = (int) $request->user()->id;
        $typeEmoji = match ($announcement->type) {
            'urgent'  => '🔴',
            'warning' => '🟡',
            default   => '🔵',
        };

        $recipientIds = User::whereNull('deleted_at')
            ->whereNull('disabled_at')
            ->where('id', '!=', $authorId)
            ->pluck('id');

        if ($recipientIds->isNotEmpty()) {
            $now  = now();
            $rows = $recipientIds->map(fn($userId) => [
                'user_id'    => $userId,
                'event'      => 'announcement.posted',
                'title'      => "{$typeEmoji} Announcement: {$announcement->title}",
                'body'       => \Illuminate\Support\Str::limit($announcement->body, 120),
                'meta'       => json_encode([
                    'announcement_id' => $announcement->id,
                    'type'            => $announcement->type,
                ]),
                'read_at'    => null,
                'created_at' => $now,
                'updated_at' => $now,
            ])->all();

            // Bulk insert in chunks of 500 for large user bases
            foreach (array_chunk($rows, 500) as $chunk) {
                \App\Models\Notification::insert($chunk);
            }
        }

        $payload = [
            'id'          => $announcement->id,
            'title'       => $announcement->title,
            'body'        => $announcement->body,
            'type'        => $announcement->type,
            'is_pinned'   => $announcement->is_pinned,
            'is_archived' => false,
            'expires_at'  => $announcement->expires_at?->toISOString(),
            'archived_at' => null,
            'created_at'  => $announcement->created_at->toISOString(),
            'created_by'  => $announcement->creator->full_name ?? 'QA',
        ];

        try {
            broadcast(new \App\Events\AnnouncementBroadcast($payload));
        } catch (\Throwable) {
        }

        return response()->json($payload, 201);
    }

    // QA + Admin only
    public function archive(Request $request, Announcement $announcement): JsonResponse
    {
        $this->authorizeRole($request);
        $announcement->update(['archived_at' => now()]);

        $this->log($request, 'announcement.archived', "Archived announcement: \"{$announcement->title}\"", [
            'Announcement ID' => $announcement->id,
            'Title'           => $announcement->title,
            'Priority'        => ucfirst($announcement->type),
            'Archived by'     => $request->user()->full_name,
            'Archived at'     => now()->format('F j, Y g:i A'),
        ]);

        return response()->json(['message' => 'Archived.']);
    }

    // QA + Admin only
    public function unarchive(Request $request, Announcement $announcement): JsonResponse
    {
        $this->authorizeRole($request);
        $announcement->update(['archived_at' => null]);

        $this->log($request, 'announcement.unarchived', "Restored announcement from archive: \"{$announcement->title}\"", [
            'Announcement ID' => $announcement->id,
            'Title'           => $announcement->title,
            'Priority'        => ucfirst($announcement->type),
            'Restored by'     => $request->user()->full_name,
            'Restored at'     => now()->format('F j, Y g:i A'),
        ]);

        return response()->json(['message' => 'Unarchived.']);
    }

    // QA + Admin only
    public function destroy(Request $request, Announcement $announcement): JsonResponse
    {
        $this->authorizeRole($request);

        $this->log($request, 'announcement.deleted', "Permanently deleted announcement: \"{$announcement->title}\"", [
            'Announcement ID' => $announcement->id,
            'Title'           => $announcement->title,
            'Priority'        => ucfirst($announcement->type),
            'Was Pinned'      => $announcement->is_pinned ? 'Yes' : 'No',
            'Was Archived'    => $announcement->archived_at ? 'Yes' : 'No',
            'Deleted by'      => $request->user()->full_name,
            'Deleted at'      => now()->format('F j, Y g:i A'),
        ]);

        $announcement->delete();
        return response()->json(['message' => 'Deleted.']);
    }

    private function authorizeRole(Request $request): void
    {
        $roleName = $request->user()->role?->name ?? '';
        if (!in_array(strtolower($roleName), ['admin', 'qa', 'sysadmin'])) {
            abort(403, 'Unauthorized.');
        }
    }

    private function log(Request $request, string $event, string $label, array $meta = []): void
    {
        $user = $request->user();
        \App\Models\ActivityLog::create([
            'actor_user_id'   => $user->id,
            'actor_office_id' => $user->office_id ?? null,
            'event'           => $event,
            'label'           => $label,
            'meta'            => $meta,
        ]);
    }
}
