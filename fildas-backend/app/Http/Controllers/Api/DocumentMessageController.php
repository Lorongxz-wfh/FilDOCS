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

        return response()->json(
            $msg->load([
                'sender:id,first_name,middle_name,last_name,suffix,role_id,profile_photo_path',
                'sender.role:id,name',
            ]),
            201
        );
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
