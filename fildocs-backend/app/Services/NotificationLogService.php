<?php

namespace App\Services;

use App\Models\NotificationLog;
use Illuminate\Support\Facades\Log;

class NotificationLogService
{
    /**
     * Log a sent notification.
     *
     * @param string $email
     * @param string $subject
     * @param string $type
     * @param array $metadata
     * @param int|null $userId
     * @return NotificationLog
     */
    public function logSent(string $email, string $subject, string $type, array $metadata = [], ?int $userId = null): NotificationLog
    {
        return NotificationLog::create([
            'user_id' => $userId,
            'email' => $email,
            'subject' => $subject,
            'type' => $type,
            'status' => 'sent',
            'metadata' => $metadata,
            'sent_at' => now(),
        ]);
    }

    /**
     * Log a failed notification attempt.
     *
     * @param string $email
     * @param string $subject
     * @param string $type
     * @param string $error
     * @param array $metadata
     * @param int|null $userId
     * @return NotificationLog
     */
    public function logFailed(string $email, string $subject, string $type, string $error, array $metadata = [], ?int $userId = null): NotificationLog
    {
        return NotificationLog::create([
            'user_id' => $userId,
            'email' => $email,
            'subject' => $subject,
            'type' => $type,
            'status' => 'failed',
            'error_message' => $error,
            'metadata' => $metadata,
        ]);
    }
}
