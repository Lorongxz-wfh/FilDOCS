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
