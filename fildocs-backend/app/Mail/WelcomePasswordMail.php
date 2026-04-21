<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class WelcomePasswordMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public readonly string $recipientName,
        public readonly string $tempPassword,
        public readonly string $appUrl,
        public readonly string $appName = 'FilDOCS',
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: 'Your ' . $this->appName . ' account is ready');
    }

    public function content(): Content
    {
        return new Content(view: 'emails.welcome-password');
    }
}
