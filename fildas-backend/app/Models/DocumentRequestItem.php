<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class DocumentRequestItem extends Model
{
    protected $table = 'document_request_items';

    protected $fillable = [
        'request_id',
        'title',
        'description',
        'due_at',
        'example_original_filename',
        'example_file_path',
        'example_preview_path',
        'sort_order',
    ];

    protected $casts = [
        'due_at' => 'datetime',
    ];

    public function request(): BelongsTo
    {
        return $this->belongsTo(DocumentRequest::class, 'request_id');
    }

    public function submissions(): HasMany
    {
        return $this->hasMany(DocumentRequestSubmission::class, 'item_id');
    }

    public function latestSubmissionForRecipient(int $recipientId): ?DocumentRequestSubmission
    {
        return $this->submissions()
            ->where('recipient_id', $recipientId)
            ->orderByDesc('attempt_no')
            ->first();
    }
}
