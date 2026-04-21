<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DocumentRequestSubmissionFile extends Model
{
    protected $table = 'document_request_submission_files';

    protected $fillable = [
        'submission_id',
        'original_filename',
        'file_path',
        'preview_path',
        'mime',
        'size_bytes',
        'meta',
    ];

    protected $casts = [
        'meta' => 'array',
    ];

    public function submission(): BelongsTo
    {
        return $this->belongsTo(DocumentRequestSubmission::class, 'submission_id');
    }
}
