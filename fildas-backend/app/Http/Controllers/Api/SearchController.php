<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Document;
use App\Models\User;
use App\Models\Office;
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
        $op = config('database.default') === 'pgsql' ? 'ilike' : 'like';

        $actor    = $request->user();
        $roleName = $this->roleNameOf($actor);
        $isAdmin  = in_array($roleName, ['admin', 'sysadmin'], true);

        // Documents — title / description match
        $documents = Document::query()
            ->where(function ($query) use ($like, $op) {
                $query->where('title', $op, $like)
                    ->orWhere('description', $op, $like);
            })
            ->with('latestVersion:id,document_id,status')
            ->limit(6)
            ->get(['id', 'title', 'description'])
            ->map(fn($d) => [
                'type'        => 'document',
                'id'          => $d->id,
                'title'       => $d->title,
                'description' => $d->description,
                'meta'        => $d->latestVersion?->status ?? null,
                'url'         => $d->latestVersion?->status === 'Distributed'
                    ? "/documents/{$d->id}/view"
                    : "/documents/{$d->id}",
            ]);

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

        // Templates
        $templateQuery = \App\Models\DocumentTemplate::query()
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

        // Document Requests
        $requestQuery = \App\Models\DocumentRequest::query()
            ->where(function ($query) use ($like, $op) {
                $query->where('title', $op, $like)
                    ->orWhere('description', $op, $like);
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
                'description' => $r->description,
                'meta'        => $r->status,
                'url'         => "/document-requests/{$r->id}",
            ]);

        // Notifications — only current user's own
        $notifications = \App\Models\Notification::query()
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

        return response()->json([
            'documents'     => $documents->values(),
            'users'         => $users->values(),
            'offices'       => $offices->values(),
            'templates'     => $templates->values(),
            'requests'      => $requests->values(),
            'notifications' => $notifications->values(),
        ]);
    }
}
