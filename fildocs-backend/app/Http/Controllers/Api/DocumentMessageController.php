<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DocumentMessage;
use App\Models\DocumentVersion;
use Illuminate\Http\Request;
use App\Models\ActivityLog;

class DocumentMessageController extends Controller
{
    // GET /api/document-versions/{version}/messages
    public function index(DocumentVersion $version)
    {
        $limit = 200;

        $messages = DocumentMessage::query()
            ->where('document_version_id', $version->id)
            ->with([
                'sender:id,first_name,middle_name,last_name,suffix,role_id,profile_photo_path',
                'sender.role:id,name',
            ])
            ->orderBy('created_at', 'desc')
            ->limit($limit)
            ->get()
            ->reverse()
            ->values();

        return response()->json($messages);
    }

    // POST /api/document-versions/{version}/messages
    public function store(Request $request, DocumentVersion $version)
    {
        $data = $request->validate([
            'type' => 'sometimes|in:comment,return_note,approval_note,system',
            'message' => 'required|string',
        ]);

        $msg = DocumentMessage::create([
            'document_version_id' => $version->id,
            'sender_user_id' => $request->user()->id,
            'type' => $data['type'] ?? 'comment',
            'message' => $data['message'],
        ]);

        $this->notifyParticipants($version, $request->user(), $msg);

        ActivityLog::create([
            'document_id' => $version->document_id,
            'document_version_id' => $version->id,
            'actor_user_id' => $request->user()?->id,
            'actor_office_id' => $request->user()?->office_id,
            'target_office_id' => null,
            'event' => 'document.comment_added',
            'label' => 'Posted a comment',
            'meta' => [
                'type' => $msg->type,
                'message' => $msg->message,
            ],
        ]);

        // Load sender once — used for both broadcast payload and the HTTP response
        $msg->load([
            'sender:id,first_name,middle_name,last_name,suffix,role_id,profile_photo_path',
            'sender.role:id,name',
        ]);

        $payload = [
            'id'                  => $msg->id,
            'document_version_id' => $msg->document_version_id,
            'sender_user_id'      => $msg->sender_user_id,
            'type'                => $msg->type,
            'message'             => $msg->message,
            'created_at'          => $msg->created_at,
            'updated_at'          => $msg->updated_at,
            'sender'              => $msg->sender ? [
                'id'                 => $msg->sender->id,
                'full_name'          => $msg->sender->full_name,
                'profile_photo_path' => (str_starts_with($msg->sender->profile_photo_path ?? '', 'data:')) ? null : $msg->sender->profile_photo_path,
                'profile_photo_url'  => (str_starts_with($msg->sender->profile_photo_url ?? '', 'data:')) ? null : $msg->sender->profile_photo_url,
                'role'               => $msg->sender->role
                    ? ['id' => $msg->sender->role->id, 'name' => $msg->sender->role->name]
                    : null,
            ] : null,
        ];

        try {
            broadcast(new \App\Events\DocumentMessagePosted(
                versionId: $version->id,
                message: $payload,
            ));
        } catch (\Exception $e) {
            \Log::warning("[DocumentMessageController] Pusher broadcast failed: " . $e->getMessage());
        }

        return response()->json($msg, 201);
    }

    private function notifyParticipants(DocumentVersion $version, \App\Models\User $sender, DocumentMessage $msg)
    {
        $doc = $version->document;
        if (!$doc) return;

        // Participants = Owner office + any office that has a task for this version
        $officeIds = \App\Models\WorkflowTask::where('document_version_id', $version->id)
            ->whereNotNull('assigned_office_id')
            ->pluck('assigned_office_id')
            ->push($doc->owner_office_id)
            ->unique()
            ->filter()
            ->all();

        $users = \App\Models\User::whereIn('office_id', $officeIds)
            ->where('id', '!=', $sender->id)
            ->whereNull('deleted_at')
            ->whereNull('disabled_at')
            ->get();

        foreach ($users as $u) {
            \App\Models\Notification::create([
                'user_id'             => $u->id,
                'document_id'         => $version->document_id,
                'document_version_id' => $version->id,
                'event'               => 'message.posted',
                'title'               => 'New Message',
                'body'                => "{$sender->full_name} posted a comment on \"{$doc->title}\"",
                'meta'                => [
                    'version_id' => $version->id,
                    'type'       => $msg->type,
                ],
                'read_at'             => null,
            ]);
        }
    }
}
