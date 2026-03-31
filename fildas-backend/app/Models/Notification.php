<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Notification extends Model
{
    protected $fillable = [
        'user_id',
        'document_id',
        'document_version_id',
        'event',
        'title',
        'body',
        'meta',
        'read_at',
    ];

    protected $casts = [
        'meta' => 'array',
        'read_at' => 'datetime',
    ];

    protected static function booted(): void
    {
        static::created(function (Notification $notification) {
            try {
                broadcast(new \App\Events\NotificationCreated(
                    userId: (int) $notification->user_id,
                    notification: [
                        'id'          => $notification->id,
                        'event'       => $notification->event,
                        'title'       => $notification->title,
                        'body'        => $notification->body,
                        'meta'        => $notification->meta,
                        'read_at'     => $notification->read_at,
                        'created_at'  => $notification->created_at?->toISOString(),
                        'document_id' => $notification->document_id,
                        'document_version_id' => $notification->document_version_id,
                    ],
                ));
            } catch (\Throwable) {
                // Never let a broadcast failure break the main request
            }
        });
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function document()
    {
        return $this->belongsTo(Document::class);
    }

    public function version()
    {
        return $this->belongsTo(DocumentVersion::class, 'document_version_id');
    }
}
