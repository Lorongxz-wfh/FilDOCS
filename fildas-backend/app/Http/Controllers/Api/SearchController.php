<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Document;
use App\Models\User;
use App\Models\Office;
use App\Models\ActivityLog;
use App\Models\DocumentRequest;
use App\Models\DocumentTemplate;
use App\Models\Announcement;
use App\Models\Notification;
use App\Traits\RoleNameTrait;
use Illuminate\Http\Request;

class SearchController extends Controller
{
    use RoleNameTrait;

    public function __invoke(Request $request)
    {
        $q = trim((string) ($request->query('q', '')));

        if (strlen($q) < 2) {
            return response()->json([
                'documents'   => [],
                'users'       => [],
                'offices'     => [],
                'templates'   => [],
                'requests'    => [],
                'notifications' => [],
            ]);
        }

        $like = "%{$q}%";
        $op   = config('database.default') === 'pgsql' ? 'ilike' : 'like';

        $actor    = $request->user();
        if (!$actor) {
            return response()->json([
                'documents'     => [],
                'users'         => [],
                'offices'       => [],
                'templates'     => [],
                'requests'      => [],
                'announcements' => [],
                'notifications' => [],
                'activity'      => [],
            ]);
        }

        $roleName = $this->roleNameOf($actor);
        $isAdmin  = in_array($roleName, ['admin', 'sysadmin'], true);
        $isQA     = $roleName === 'qa';
        $canSeeSensitive = $isAdmin || $isQA;

        $documentQuery = Document::query()
            ->where(function ($query) use ($like, $op, $q) {
                // Exact/Like matches
                $query->where('documents.title', $op, $like)
                    ->orWhere('documents.code', $op, $like)
                    ->orWhereHas('latestVersion', function ($v) use ($like, $op) {
                        $v->where('description', $op, $like);
                    })
                    // Search by Tags
                    ->orWhereHas('tags', function ($t) use ($like, $op) {
                        $t->where('name', $op, $like);
                    })
                    // Search by Owner Office
                    ->orWhereHas('ownerOffice', function ($o) use ($like, $op) {
                        $o->where('name', $op, $like)->orWhere('code', $op, $like);
                    })
                    // Search by Version Filenames
                    ->orWhereHas('versions', function ($v) use ($like, $op) {
                        $v->where('original_filename', $op, $like);
                    });

                // Direct ID Match (if numeric)
                if (is_numeric($q)) {
                    $query->orWhere('documents.id', $q);
                }
            });

        $documentQuery = app(\App\Services\DocumentIndexService::class)->applyVisibility($documentQuery, $actor);

        $documents = $documentQuery
            ->with(['latestVersion' => function ($v) {
                $v->select([
                    'document_versions.id',
                    'document_versions.document_id',
                    'document_versions.status',
                    'document_versions.effective_date',
                ]);
            }])
            ->limit(10)
            ->get(['documents.id', 'documents.title', 'documents.code', 'documents.doctype'])
            ->map(function ($d) {
                $status = $d->latestVersion?->status ?? 'Draft';
                $isArchived = in_array($status, ['Superseded', 'Cancelled'], true);
                
                return [
                    'type'        => $isArchived ? 'archive' : 'document',
                    'id'          => $d->id,
                    'title'       => $d->title,
                    'description' => $d->code ?: $d->doctype,
                    'meta'        => $status,
                    'status'      => $status,
                    'url'         => ($status === 'Distributed' || $isArchived)
                        ? "/library/{$d->id}"
                        : "/documents/{$d->id}",
                ];
            });

        // ── Predictive Suggestions (Fuzzy) ──────────────────────────────────
        $suggestions = collect();
        if ($documents->isEmpty() && strlen($q) > 3) {
            // Very simple fuzzy suggestion based on SOUNDEX (MySQL) or similar
            // For cross-db, we'll just check for words starting with the term
            $suggestedDocs = Document::query()
                ->where('title', 'like', substr($q, 0, 3) . '%')
                ->limit(3)
                ->get(['title'])
                ->pluck('title');
            
            foreach ($suggestedDocs as $s) {
                $suggestions->push([
                    'type' => 'suggestion',
                    'id' => 'suggest-' . md5($s),
                    'title' => $s,
                    'url' => '#', 
                ]);
            }
        }

        // Users — admin only
        $users = collect();
        if ($isAdmin) {
            $users = User::query()
                ->where(function ($query) use ($like, $op) {
                    $query->where('first_name', $op, $like)
                        ->orWhere('last_name', $op, $like)
                        ->orWhere('email', $op, $like);
                })
                ->with('role')
                ->limit(5)
                ->get(['id', 'first_name', 'last_name', 'email', 'role_id'])
                ->map(fn($u) => [
                    'type'  => 'user',
                    'id'    => $u->id,
                    'title' => trim("{$u->first_name} {$u->last_name}"),
                    'description' => $u->email,
                    'meta'  => strtolower($u->role?->name ?? ''),
                    'url'   => "/user-manager",
                ]);
        }

        // Offices
        $offices = Office::query()
            ->where(function ($query) use ($like, $op) {
                $query->where('name', $op, $like)
                    ->orWhere('code', $op, $like);
            })
            ->limit(5)
            ->get(['id', 'name', 'code'])
            ->map(fn($o) => [
                'type'        => 'office',
                'id'          => $o->id,
                'title'       => $o->name,
                'description' => $o->code,
                'url'         => "/office-manager",
            ]);

        $templateQuery = DocumentTemplate::query()
            ->where(function ($query) use ($like, $op) {
                $query->where('name', $op, $like)
                    ->orWhere('description', $op, $like);
            });
        // Non-admins only see their office templates or global (office_id null)
        if (!$isAdmin) {
            $officeId = $actor?->office_id;
            $templateQuery->where(function ($q2) use ($officeId) {
                $q2->whereNull('office_id')
                    ->orWhere('office_id', $officeId);
            });
        }
        $templates = $templateQuery
            ->limit(4)
            ->get(['id', 'name', 'description'])
            ->map(fn($t) => [
                'type'        => 'template',
                'id'          => $t->id,
                'title'       => $t->name,
                'description' => $t->description,
                'url'         => '/templates',
            ]);

        // Document Requests - search by title, description, or items
        $requestQuery = DocumentRequest::query()
            ->where(function ($query) use ($like, $op) {
                $query->where('title', $op, $like)
                    ->orWhere('description', $op, $like)
                    ->orWhereHas('items', function ($iq) use ($like, $op) {
                        $iq->where('title', $op, $like)->orWhere('description', $op, $like);
                    });
            });

        // Non-admins only see requests assigned to their office
        if (!$isAdmin) {
            $officeId = $actor?->office_id;
            $requestQuery->whereHas('recipients', function ($q2) use ($officeId) {
                $q2->where('office_id', $officeId);
            });
        }

        $requests = $requestQuery
            ->limit(4)
            ->get(['id', 'title', 'description', 'status'])
            ->map(fn($r) => [
                'type'        => 'request',
                'id'          => $r->id,
                'title'       => $r->title,
                'description' => $r->description ?: 'No description provided.',
                'meta'        => $r->status,
                'status'      => $r->status,
                'url'         => "/requests/{$r->id}", 
            ]);

        // Announcements
        $announcementQuery = Announcement::query()
            ->where(function ($query) use ($like, $op) {
                $query->where('title', $op, $like)
                    ->orWhere('body', $op, $like);
            })
            ->active()
            ->ordered();

        $announcements = $announcementQuery
            ->limit(4)
            ->get(['id', 'title', 'body', 'type'])
            ->map(fn($a) => [
                'type'        => 'announcement',
                'id'          => $a->id,
                'title'       => $a->title,
                'description' => \Illuminate\Support\Str::limit($a->body, 60),
                'meta'        => $a->type,
                'url'         => '/announcements',
            ]);

        // Notifications
        $notifications = Notification::query()
            ->where('user_id', $actor?->id)
            ->where(function ($query) use ($like, $op) {
                $query->where('title', $op, $like)
                    ->orWhere('body', $op, $like);
            })
            ->orderByDesc('created_at')
            ->limit(4)
            ->get(['id', 'title', 'body', 'read_at'])
            ->map(fn($n) => [
                'type'        => 'notification',
                'id'          => $n->id,
                'title'       => $n->title,
                'description' => $n->body
                    ? \Illuminate\Support\Str::limit($n->body, 60)
                    : null,
                'meta'        => $n->read_at ? 'read' : 'unread',
                'url'         => '/inbox',
            ]);

        // Activity Logs
        $logs = collect();
        if ($canSeeSensitive) {
            $logs = ActivityLog::query()
                ->where(function ($query) use ($like, $op) {
                    $query->where('label', $op, $like)
                        ->orWhere('event', $op, $like);
                })
                ->with(['actorUser:id,first_name,last_name', 'document:id,title'])
                ->orderByDesc('created_at')
                ->limit(5)
                ->get()
                ->map(fn($log) => [
                    'type'        => 'activity',
                    'id'          => $log->id,
                    'title'       => $log->label ?: $log->event,
                    'description' => "By " . ($log->actorUser ? trim("{$log->actorUser->first_name} {$log->actorUser->last_name}") : 'System') . 
                                     ($log->document ? " on {$log->document->title}" : ""),
                    'meta'        => $log->created_at->diffForHumans(),
                    'url'         => $log->document_id ? "/documents/{$log->document_id}" : "/activity",
                ]);
        }

        return response()->json([
            'documents'     => $documents->values(),
            'users'         => $users->values(),
            'offices'       => $offices->values(),
            'templates'     => $templates->values(),
            'requests'      => $requests->values(),
            'announcements' => $announcements->values(),
            'notifications' => $notifications->values(),
            'activity'      => $logs->values(),
            'suggestions'   => $suggestions->values(),
        ]);

        return response()->json([
            'documents'     => $documents->values(),
            'users'         => $users->values(),
            'offices'       => $offices->values(),
            'templates'     => $templates->values(),
            'requests'      => $requests->values(),
            'announcements' => $announcements->values(),
            'notifications' => $notifications->values(),
            'activity'      => $logs->values(),
        ]);
    }
}
