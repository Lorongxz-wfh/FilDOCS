<?php

use Illuminate\Support\Facades\Broadcast;

// Private user channel — only the authenticated user can subscribe
Broadcast::channel('user.{userId}', function ($user, $userId) {
    return (int) $user->id === (int) $userId;
});

// Private document request channel — user must be a participant
Broadcast::channel('request.{requestId}', function ($user, $requestId) {
    $officeId = (int) ($user->office_id ?? 0);
    if (!$officeId) return false;

    return \Illuminate\Support\Facades\DB::table('document_request_recipients')
        ->where('request_id', $requestId)
        ->where('office_id', $officeId)
        ->exists();
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
