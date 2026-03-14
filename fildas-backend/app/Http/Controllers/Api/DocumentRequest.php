<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DocumentRequest extends Model
{
    protected $table = 'document_requests';

    protected $fillable = [
        'title',
        'description',
        'due_at',
        'status',
        'example_original_filename',
        'example_file_path',
        'example_preview_path',
        'created_by_user_id',
        'meta',
    ];

    protected $casts = [
        'due_at' => 'datetime',
        'meta'   => 'array',
    ];

    public function recipients(): HasMany
    {
        return $this->hasMany(DocumentRequestRecipient::class, 'request_id');
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by_user_id');
    }

    public function messages(): HasMany
    {
        return $this->hasMany(DocumentRequestMessage::class, 'document_request_id');
    }
}
