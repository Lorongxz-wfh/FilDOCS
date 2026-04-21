<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class TwoFactorChallengeMail extends Mailable
{
    use Queueable, SerializesModels;

    public $recipientName;
    public $code;
    public $appName;

    /**
     * Create a new message instance.
     */
    public function __construct($recipientName, $code)
    {
        $this->recipientName = $recipientName;
        $this->code = $code;
        $this->appName = config('app.name', 'FilDOCS');
    }

    /**
     * Get the message envelope.
     */
    public function envelope(): Envelope
    {
        return new Envelope(
            subject: "[{$this->appName}] Your Verification Code",
        );
    }

    /**
     * Get the message content definition.
     */
    public function content(): Content
    {
        return new Content(
            markdown: 'emails.auth.two_factor_challenge',
        );
    }

    /**
     * Get the attachments for the message.
     *
     * @return array<int, \Illuminate\Mail\Mailables\Attachment>
     */
    public function attachments(): array
    {
        return [];
    }
}
