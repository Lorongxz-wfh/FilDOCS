<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Notification;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    // GET /api/notifications?per_page=25
    public function index(Request $request)
    {
        $user = $request->user();

        $perPage = (int) ($request->query('per_page', 25));
        $perPage = max(1, min(50, $perPage));

        $page = (int) ($request->query('page', 1));
        $page = max(1, $page);

        // Build a cheap fingerprint for "has anything changed for this user/page/perPage?"
        $baseQuery = Notification::query()
            ->where('user_id', $user->id);

        $latestId = (int) (clone $baseQuery)->max('id');
        $latestTouchedAt = (clone $baseQuery)->max('updated_at'); // may be string depending on DB/driver

        $latestTouchedTs = 0;
        if ($latestTouchedAt) {
            $latestTouchedTs = is_string($latestTouchedAt)
                ? strtotime($latestTouchedAt)
                : $latestTouchedAt->timestamp;
        }

        $etag = sprintf(
            'W/"u%s-p%s-pp%s-i%s-t%s"',
            $user->id,
            $page,
            $perPage,
            $latestId,
            $latestTouchedTs
        );

        // If client already has this version, return 304 with no body
        $ifNoneMatch = $request->header('If-None-Match');
        if ($ifNoneMatch && trim($ifNoneMatch) === $etag) {
            return response('', 304)->header('ETag', $etag);
        }

        $items = $baseQuery
            ->orderByDesc('id')
            ->paginate($perPage);

        // Stronger: fingerprint the actual page slice
        $pageIds = collect($items->items())->pluck('id');
        $pageMaxUpdatedAt = collect($items->items())->max('updated_at');

        $etag = sprintf(
            'W/"u%s-p%s-pp%s-ids%s-t%s"',
            $user->id,
            $page,
            $perPage,
            $pageIds->implode(','),
            $pageMaxUpdatedAt ? strtotime((string) $pageMaxUpdatedAt) : 0
        );

        $ifNoneMatch = $request->header('If-None-Match');
        if ($ifNoneMatch && trim($ifNoneMatch) === $etag) {
            return response('', 304)->header('ETag', $etag);
        }

        return response()->json($items)->header('ETag', $etag);
    }

    // GET /api/notifications/unread-count
    public function unreadCount(Request $request)
    {
        $user = $request->user();

        $cnt = Notification::query()
            ->where('user_id', $user->id)
            ->whereNull('read_at')
            ->count();

        return response()->json(['unread' => $cnt]);
    }

    // POST /api/notifications/{notification}/read
    public function markRead(Request $request, Notification $notification)
    {
        $user = $request->user();

        if ((int) $notification->user_id !== (int) $user->id) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        if (!$notification->read_at) {
            $notification->read_at = now();
            $notification->save();
        }

        return response()->json(['ok' => true, 'notification' => $notification->fresh()]);
    }

    // POST /api/notifications/read-all
    public function markAllRead(Request $request)
    {
        $user = $request->user();

        Notification::query()
            ->where('user_id', $user->id)
            ->whereNull('read_at')
            ->update(['read_at' => now()]);

        return response()->json(['ok' => true]);
    }

    // DELETE /api/notifications/{notification}
    public function destroy(Request $request, Notification $notification)
    {
        if ((int) $notification->user_id !== (int) $request->user()->id) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $notification->delete();

        return response()->json(['ok' => true]);
    }

    // DELETE /api/notifications
    public function destroyAll(Request $request)
    {
        Notification::query()
            ->where('user_id', $request->user()->id)
            ->delete();

        return response()->json(['ok' => true]);
    }
}
