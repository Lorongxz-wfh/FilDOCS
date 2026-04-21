<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class DocumentRequestSubmission extends Model
{
    protected $table = 'document_request_submissions';

    protected $fillable = [
        'recipient_id',
        'item_id',
        'attempt_no',
        'submitted_by_user_id',
        'note',
        'status',
        'qa_reviewed_by_user_id',
        'qa_review_note',
        'reviewed_at',
        'meta',
    ];

    protected $casts = [
        'reviewed_at' => 'datetime',
        'meta'        => 'array',
    ];

    public function recipient(): BelongsTo
    {
        return $this->belongsTo(DocumentRequestRecipient::class, 'recipient_id');
    }

    public function item(): BelongsTo
    {
        return $this->belongsTo(DocumentRequestItem::class, 'item_id');
    }

    public function submittedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'submitted_by_user_id');
    }

    public function reviewedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'qa_reviewed_by_user_id');
    }

    public function files(): HasMany
    {
        return $this->hasMany(DocumentRequestSubmissionFile::class, 'submission_id');
    }
}
