<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Mail\Mailables\Attachment;
use Illuminate\Queue\SerializesModels;

class SupportIssueMail extends Mailable
{
    use Queueable, SerializesModels;

    /**
     * Create a new message instance.
     *
     * @param string $senderName
     * @param string $senderEmail
     * @param string $notifTitle
     * @param string $notifMessage
     * @param array $attachmentPaths  // Global paths to physical files
     * @param string $appUrl
     * @param string $appName
     */
    public function __construct(
        public readonly string $senderName,
        public readonly string $senderEmail,
        public readonly string $notifTitle,
        public readonly string $notifMessage,
        public readonly array  $attachmentPaths,
        public readonly string $appUrl,
        public readonly string $appName = 'FilDOCS',
    ) {}

    /**
     * Get the message envelope.
     */
    public function envelope(): Envelope
    {
        return new Envelope(
            subject: "[FilDOCS Support] " . $this->notifTitle,
            replyTo: $this->senderEmail,
        );
    }

    /**
     * Get the message content definition.
     */
    public function content(): Content
    {
        return new Content(
            view: 'emails.support-issue',
        );
    }

    /**
     * Get the attachments for the message.
     *
     * @return array<int, \Illuminate\Mail\Mailables\Attachment>
     */
    public function attachments(): array
    {
        $attachments = [];
        foreach ($this->attachmentPaths as $path) {
            if (file_exists($path)) {
                $attachments[] = Attachment::fromPath($path);
            }
        }
        return $attachments;
    }
}
