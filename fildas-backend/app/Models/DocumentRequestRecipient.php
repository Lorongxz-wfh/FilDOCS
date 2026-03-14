<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class DocumentRequestRecipient extends Model
{
    protected $table = 'document_request_recipients';

    protected $fillable = [
        'request_id',
        'office_id',
        'status',
        'due_at',
        'last_submitted_at',
        'last_reviewed_at',
        'meta',
    ];

    protected $casts = [
        'due_at'            => 'datetime',
        'last_submitted_at' => 'datetime',
        'last_reviewed_at'  => 'datetime',
        'meta'              => 'array',
    ];

    public function request(): BelongsTo
    {
        return $this->belongsTo(DocumentRequest::class, 'request_id');
    }

    public function office(): BelongsTo
    {
        return $this->belongsTo(Office::class, 'office_id');
    }

    public function submissions(): HasMany
    {
        return $this->hasMany(DocumentRequestSubmission::class, 'recipient_id');
    }
}
