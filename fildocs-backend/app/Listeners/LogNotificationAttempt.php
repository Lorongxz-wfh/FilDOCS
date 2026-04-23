<?php

namespace App\Listeners;

use App\Services\NotificationLogService;
use Illuminate\Mail\Events\MessageSent;
use Illuminate\Mail\Events\MessageSending;
use Illuminate\Support\Facades\Log;

class LogNotificationAttempt
{
    protected $logService;

    public function __construct(NotificationLogService $logService)
    {
        $this->logService = $logService;
    }

    /**
     * Handle the event.
     */
    public function handle(object $event): void
    {
        try {
            $message = $event->message;
            $recipients = $message->getTo();
            $recipientEmails = [];
            
            foreach ($recipients as $recipient) {
                $recipientEmails[] = $recipient->getAddress();
            }

            $email = implode(', ', $recipientEmails);
            $subject = $message->getSubject();
            
            // Try to extract metadata if available (some custom mailables might provide it)
            $metadata = [
                'headers' => $message->getHeaders()->toArray(),
            ];

            if ($event instanceof MessageSent) {
                $this->logService->logSent(
                    $email,
                    $subject,
                    'email',
                    $metadata
                );
            } elseif ($event instanceof MessageSending) {
                // We could log 'sending' status here if we wanted to track start times
            }
        } catch (\Exception $e) {
            Log::error('Failed to log notification audit: ' . $e->getMessage());
        }
    }
}
