<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Traits\RoleNameTrait;
use App\Traits\LogsActivityTrait;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DocumentRequestMessageController extends Controller
{
    use RoleNameTrait, LogsActivityTrait;

    private function canAccess(Request $request, int $requestId): bool
    {
        $user = $request->user();
        $role = $this->roleName($request);

        if ($this->isQaOrAdmin($role)) {
            return true;
        }

        $officeId = (int) ($user?->office_id ?? 0);
        if ($officeId <= 0) return false;

        return DB::table('document_request_recipients')
            ->where('request_id', $requestId)
            ->where('office_id', $officeId)
            ->exists();
    }

    // GET /api/document-requests/{request}/messages
    public function index(Request $request, int $requestId)
    {
        if (!$this->canAccess($request, $requestId)) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $row = DB::table('document_requests')->where('id', $requestId)->first();
        if (!$row) return response()->json(['message' => 'Not found.'], 404);

        $messages = DB::table('document_request_messages as m')
            ->join('users as u', 'u.id', '=', 'm.sender_user_id')
            ->leftJoin('roles as r', 'r.id', '=', 'u.role_id')
            ->where('m.document_request_id', $requestId)
            ->orderBy('m.created_at', 'asc')
            ->orderBy('m.id', 'asc')
            ->select([
                'm.id',
                'm.document_request_id',
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
            ->get()
            ->map(fn($m) => [
                'id'                   => (int) $m->id,
                'document_request_id'  => (int) $m->document_request_id,
                'sender_user_id'       => (int) $m->sender_user_id,
                'type'                 => $m->type,
                'message'              => $m->message,
                'created_at'           => $m->created_at,
                'updated_at'           => $m->updated_at,
                'sender' => [
                    'id'                  => (int) $m->sender_user_id,
                    'name'                => trim($m->first_name . ' ' . $m->last_name),
                    'profile_photo_path'  => $m->profile_photo_path,
                    'role'                => $m->role_name,
                ],
            ])
            ->values();

        return response()->json($messages);
    }

    // POST /api/document-requests/{request}/messages
    public function store(Request $request, int $requestId)
    {
        if (!$this->canAccess($request, $requestId)) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $row = DB::table('document_requests')->where('id', $requestId)->first();
        if (!$row) return response()->json(['message' => 'Not found.'], 404);

        $data = $request->validate([
            'message' => 'required|string|max:2000',
        ]);

        $user = $request->user();
        $now  = now();

        $id = DB::table('document_request_messages')->insertGetId([
            'document_request_id' => $requestId,
            'sender_user_id'      => $user->id,
            'type'                => 'comment',
            'message'             => $data['message'],
            'created_at'          => $now,
            'updated_at'          => $now,
        ]);

        $this->logActivity('document_request.message.posted', 'Posted a comment on a document request', $user->id, $user->office_id, [
            'document_request_id' => $requestId,
            'message_id'          => $id,
        ]);

        $message = DB::table('document_request_messages as m')
            ->join('users as u', 'u.id', '=', 'm.sender_user_id')
            ->leftJoin('roles as r', 'r.id', '=', 'u.role_id')
            ->where('m.id', $id)
            ->select([
                'm.id',
                'm.document_request_id',
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

        return response()->json([
            'id'                  => (int) $message->id,
            'document_request_id' => (int) $message->document_request_id,
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
        ], 201);
    }
}
