<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Traits\RoleNameTrait;
use App\Traits\LogsActivityTrait;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DocumentRequestMessageController extends Controller
{
    use RoleNameTrait, LogsActivityTrait;

    // ── Access guard ───────────────────────────────────────────────────────
    private function canAccess(Request $request, int $requestId): bool
    {
        $role = $this->roleName($request);
        if ($this->isQaOrAdmin($role)) return true;

        $user = $request->user();
        if (!$user) return false;

        // Is the user the creator?
        $req = DB::table('document_requests')->where('id', $requestId)->first();
        if ($req && (int)$req->created_by_user_id === $user->id) return true;

        $officeId = (int) ($user->office_id ?? 0);
        if ($officeId <= 0) return false;

        return DB::table('document_request_recipients')
            ->where('request_id', $requestId)
            ->where('office_id', $officeId)
            ->exists();
    }

    // Resolve the office's own recipient_id for a given request
    private function myRecipientId(Request $request, int $requestId): ?int
    {
        $officeId = (int) ($request->user()?->office_id ?? 0);
        if ($officeId <= 0) return null;

        $id = DB::table('document_request_recipients')
            ->where('request_id', $requestId)
            ->where('office_id', $officeId)
            ->value('id');

        return $id ? (int) $id : null;
    }

    // ── GET /api/document-requests/{request}/messages ──────────────────────
    public function index(Request $request, int $requestId): \Illuminate\Http\JsonResponse
    {
        if (!$this->canAccess($request, $requestId)) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        if (!DB::table('document_requests')->where('id', $requestId)->exists()) {
            return response()->json(['message' => 'Not found.'], 404);
        }

        $role    = $this->roleName($request);
        $isQa    = $this->isQaOrAdmin($role);
        $params  = $request->validate([
            'recipient_id' => 'nullable|integer',
            'item_id'      => 'nullable|integer',
            'thread'       => 'nullable|in:batch,recipient,item',
        ]);

        $recipientId = isset($params['recipient_id']) ? (int) $params['recipient_id'] : null;
        $itemId      = isset($params['item_id'])      ? (int) $params['item_id']      : null;
        $thread      = $params['thread'] ?? null;

        // Office users are scoped to their own recipient thread, UNLESS they specifically ask for the 'batch' thread (broadcast)
        if (!$isQa && $thread !== 'batch') {
            $recipientId = $this->myRecipientId($request, $requestId);
        }

        $q = DB::table('document_request_messages as m')
            ->join('users as u', 'u.id', '=', 'm.sender_user_id')
            ->leftJoin('roles as r', 'r.id', '=', 'u.role_id')
            ->where('m.document_request_id', $requestId)
            ->orderBy('m.created_at', 'asc')
            ->orderBy('m.id', 'asc')
            ->select([
                'm.id',
                'm.document_request_id',
                'm.recipient_id',
                'm.item_id',
                'm.sender_user_id',
                'm.type',
                'm.message',
                'm.created_at',
                'm.updated_at',
                'u.first_name',
                'u.last_name',
                'u.profile_photo_path',
                'r.name as role_name',
            ]);

        // Thread scoping
        if ($thread === 'batch' || ($recipientId === null && $itemId === null && $thread === null && $isQa)) {
            // Batch thread: both recipient_id and item_id are null
            $q->whereNull('m.recipient_id')->whereNull('m.item_id');
        } elseif ($itemId !== null) {
            $q->where('m.item_id', $itemId);
        } elseif ($recipientId !== null) {
            $q->where('m.recipient_id', $recipientId)->whereNull('m.item_id');
        } else {
            // No scope provided and not QA — scope to their recipient
            $myId = $this->myRecipientId($request, $requestId);
            if ($myId) {
                $q->where('m.recipient_id', $myId)->whereNull('m.item_id');
            } else {
                $q->whereNull('m.recipient_id')->whereNull('m.item_id');
            }
        }

        $messages = $q->get()->map(fn($m) => [
            'id'                  => (int) $m->id,
            'document_request_id' => (int) $m->document_request_id,
            'recipient_id'        => $m->recipient_id ? (int) $m->recipient_id : null,
            'item_id'             => $m->item_id ? (int) $m->item_id : null,
            'sender_user_id'      => (int) $m->sender_user_id,
            'type'                => $m->type,
            'message'             => $m->message,
            'created_at'          => $m->created_at,
            'updated_at'          => $m->updated_at,
            'sender' => [
                'id'                 => (int) $m->sender_user_id,
                'name'               => trim($m->first_name . ' ' . $m->last_name),
                'profile_photo_path' => $m->profile_photo_path,
                'role'               => $m->role_name,
            ],
        ])->values();

        return response()->json($messages);
    }

    // ── POST /api/document-requests/{request}/messages ─────────────────────
    public function store(Request $request, int $requestId): \Illuminate\Http\JsonResponse
    {
        if (!$this->canAccess($request, $requestId)) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        if (!DB::table('document_requests')->where('id', $requestId)->exists()) {
            return response()->json(['message' => 'Not found.'], 404);
        }

        $role = $this->roleName($request);
        $isQa = $this->isQaOrAdmin($role);

        $data = $request->validate([
            'message'      => 'required|string|max:2000',
            'recipient_id' => 'nullable|integer',
            'item_id'      => 'nullable|integer',
            'thread'       => 'nullable|in:batch,recipient,item',
        ]);

        $recipientId = isset($data['recipient_id']) ? (int) $data['recipient_id'] : null;
        $itemId      = isset($data['item_id'])      ? (int) $data['item_id']      : null;
        $thread      = $data['thread'] ?? null;

        // Scoping logic: Requester vs Recipient
        // If the user isn't the creator and isn't QA/Admin, they are a Recipient.
        // Recipients cannot broadcast.
        $isCreator = DB::table('document_requests')
            ->where('id', $requestId)
            ->where('created_by_user_id', $request->user()->id)
            ->exists();

        if (!$isQa && !$isCreator) {
            // Block recipients from posting to the broadcast/batch thread
            if ($thread === 'batch') {
                return response()->json(['message' => 'Forbidden. Only the requester can post to the broadcast thread.'], 403);
            }
            $recipientId = $this->myRecipientId($request, $requestId);
            // item_id is preserved if provided (e.g. for multi_doc item comments)
        }

        // If thread=batch, clear scoping (QA posting to shared thread)
        if ($thread === 'batch') {
            $recipientId = null;
            $itemId      = null;
        }

        $user = $request->user();
        $now  = now();

        $id = DB::table('document_request_messages')->insertGetId([
            'document_request_id' => $requestId,
            'recipient_id'        => $recipientId,
            'item_id'             => $itemId,
            'sender_user_id'      => $user->id,
            'type'                => 'comment',
            'message'             => $data['message'],
            'created_at'          => $now,
            'updated_at'          => $now,
        ]);

        $this->logActivity(
            'document_request.message.posted',
            'Posted a comment on a document request',
            $user->id,
            $user->office_id,
            [
                'document_request_id'    => $requestId,
                'document_request_title' => DB::table('document_requests')->where('id', $requestId)->value('title'),
                'message_id'             => $id,
                'thread'                 => $thread ?? ($itemId ? 'item' : ($recipientId ? 'recipient' : 'batch')),
            ]
        );

        $message = DB::table('document_request_messages as m')
            ->join('users as u', 'u.id', '=', 'm.sender_user_id')
            ->leftJoin('roles as r', 'r.id', '=', 'u.role_id')
            ->where('m.id', $id)
            ->select([
                'm.id',
                'm.document_request_id',
                'm.recipient_id',
                'm.item_id',
                'm.sender_user_id',
                'm.type',
                'm.message',
                'm.created_at',
                'm.updated_at',
                'u.first_name',
                'u.last_name',
                'u.profile_photo_path',
                'r.name as role_name',
            ])
            ->first();

        $messagePayload = [
            'id'                  => (int) $message->id,
            'document_request_id' => (int) $message->document_request_id,
            'recipient_id'        => $message->recipient_id ? (int) $message->recipient_id : null,
            'item_id'             => $message->item_id ? (int) $message->item_id : null,
            'sender_user_id'      => (int) $message->sender_user_id,
            'type'                => $message->type,
            'message'             => $message->message,
            'created_at'          => $message->created_at,
            'updated_at'          => $message->updated_at,
            'sender' => [
                'id'                 => (int) $message->sender_user_id,
                'name'               => trim($message->first_name . ' ' . $message->last_name),
                'profile_photo_path' => $message->profile_photo_path,
                'role'               => $message->role_name,
            ],
        ];

        try {
            broadcast(new \App\Events\RequestMessagePosted(
                requestId: $requestId,
                message: $messagePayload,
            ));
        } catch (\Throwable) {
        }

        $this->notifyParticipants($requestId, $recipientId, $itemId, $thread, $user, $data['message']);

        return response()->json($messagePayload, 201);
    }

    private function notifyParticipants(int $requestId, ?int $recipientId, ?int $itemId, ?string $thread, \App\Models\User $sender, string $text)
    {
        $request = DB::table('document_requests')->where('id', $requestId)->first();
        if (!$request) return;

        $role = $this->roleNameOf($sender);
        $isQa = $this->isQaOrAdmin($role);

        $targetUserIds = collect();

        if (!$isQa) {
            // Office posted: notify QA and Admin users
            $qaOfficeId = DB::table('offices')->where('code', 'QA')->value('id');
            $adminRoleIds = DB::table('roles')->whereIn('name', ['QA', 'ADMIN', 'SYSADMIN'])->pluck('id');
            
            $targetUserIds = DB::table('users')
                ->where(function($q) use ($qaOfficeId, $adminRoleIds) {
                    $q->where('office_id', $qaOfficeId)
                      ->orWhereIn('role_id', $adminRoleIds);
                })
                ->where('id', '!=', $sender->id)
                ->whereNull('deleted_at')
                ->whereNull('disabled_at')
                ->pluck('id');
        } else {
            // QA/Admin posted: determine which office(s) to notify
            if ($thread === 'batch') {
                // Broadcast: notify all recipients
                $officeIds = DB::table('document_request_recipients')
                    ->where('request_id', $requestId)
                    ->pluck('office_id');
                
                $targetUserIds = DB::table('users')
                    ->whereIn('office_id', $officeIds)
                    ->where('id', '!=', $sender->id)
                    ->whereNull('deleted_at')
                    ->whereNull('disabled_at')
                    ->pluck('id');
            } else {
                // Specific thread (recipient_id or item_id)
                $targetOfficeId = null;
                if ($recipientId) {
                    $targetOfficeId = DB::table('document_request_recipients')
                        ->where('id', $recipientId)
                        ->value('office_id');
                } elseif ($itemId) {
                    // Item thread — find recipient via item -> request linking or just the request's office if it was 1-to-1
                    // For the sake of simplicity and robustness, notify all people in the recipient office associated with that item
                    $targetOfficeId = DB::table('document_request_items as i')
                        ->join('document_request_recipients as r', 'r.request_id', '=', 'i.request_id')
                        ->where('i.id', $itemId)
                        ->value('r.office_id');
                }

                if ($targetOfficeId) {
                    $targetUserIds = DB::table('users')
                        ->where('office_id', $targetOfficeId)
                        ->where('id', '!=', $sender->id)
                        ->whereNull('deleted_at')
                        ->whereNull('disabled_at')
                        ->pluck('id');
                }
            }
        }

        foreach ($targetUserIds as $uid) {
            \App\Models\Notification::create([
                'user_id'     => $uid,
                'document_id' => null, // This is a request, not a specific doc
                'event'       => 'document_request.message.posted',
                'title'       => 'New Request Message',
                'body'        => "{$sender->full_name} posted a comment on \"{$request->title}\"",
                'meta'        => [
                    'request_id'   => $requestId,
                    'recipient_id' => $recipientId,
                    'item_id'      => $itemId,
                    'thread'       => $thread,
                ],
                'read_at'     => null,
            ]);
        }
    }
}
