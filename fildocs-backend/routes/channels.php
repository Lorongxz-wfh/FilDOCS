<?php

use Illuminate\Support\Facades\Broadcast;

// Private user channel — only the authenticated user can subscribe
Broadcast::channel('user.{userId}', function ($user, $userId) {
    return (int) $user->id === (int) $userId;
});

// Private document request channel — user must be a participant or creator or with elevated roles
Broadcast::channel('request.{requestId}', function ($user, $requestId) {
    if (!$user) return false;

    // 1. Roles that always have access (QA, Admin, Sysadmin)
    $roleName = strtolower($user->role_name ?? $user->role?->name ?? '');
    if (in_array($roleName, ['qa', 'admin', 'sysadmin'])) {
        return true;
    }

    // 2. Is the user the creator?
    $isCreator = \Illuminate\Support\Facades\DB::table('document_requests')
        ->where('id', (int) $requestId)
        ->where('created_by_user_id', $user->id)
        ->exists();
    if ($isCreator) return true;

    // 3. User office check (must be a participant)
    $officeId = (int) ($user->office_id ?? 0);
    if ($officeId) {
        return \Illuminate\Support\Facades\DB::table('document_request_recipients')
            ->where('request_id', (int) $requestId)
            ->where('office_id', $officeId)
            ->exists();
    }

    return false;
});

// Presence announcements channel — any authenticated user can join
Broadcast::channel('announcements', function ($user) {
    return ['id' => $user->id, 'name' => $user->full_name ?? ''];
});

// Private workspace channel — stats and volume changes
Broadcast::channel('workspace', function ($user) {
    return (bool) $user;
});

// Private document channel — specific document lifecycle updates
Broadcast::channel('document.{documentVersionId}', function ($user, $documentVersionId) {
    // Basic check: user must be authenticated
    if (!$user) return false;

    // Optional: Add logic here to check if the user/office has permission 
    // for this specific document. For now, any authenticated user (staff/QA) can join.
    return true;
});
