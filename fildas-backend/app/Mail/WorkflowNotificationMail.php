<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class WorkflowNotificationMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public readonly string $recipientName,
        public readonly string $notifTitle,
        public readonly string $notifBody,
        public readonly string $documentTitle,
        public readonly string $documentStatus,
        public readonly bool   $isReject,
        public readonly string $actorName,
        public readonly ?int   $documentId,
        public readonly ?string $overrideLinkUrl = null,
        public readonly string $cardLabel = 'Document',
        public readonly string $appUrl,
        public readonly string $appName,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: $this->notifTitle,
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.workflow-notification',
        );
    }
}
