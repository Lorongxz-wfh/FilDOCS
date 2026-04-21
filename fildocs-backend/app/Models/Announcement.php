<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Builder;

class Announcement extends Model
{
    protected $fillable = [
        'created_by',
        'title',
        'body',
        'type',
        'is_pinned',
        'expires_at',
        'archived_at',
    ];

    protected $casts = [
        'is_pinned'   => 'boolean',
        'expires_at'  => 'datetime',
        'archived_at' => 'datetime',
    ];

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    // Scope: only active (not expired, not archived) announcements
    public function scopeActive(Builder $query): Builder
    {
        return $query->whereNull('archived_at')->where(function ($q) {
            $q->whereNull('expires_at')
                ->orWhere('expires_at', '>', now());
        });
    }

    // Scope: pinned first, then newest
    public function scopeOrdered(Builder $query): Builder
    {
        return $query->orderByDesc('is_pinned')->orderByDesc('created_at');
    }
}
