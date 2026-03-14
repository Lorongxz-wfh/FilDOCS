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
        'mode',
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

    public function items(): HasMany
    {
        return $this->hasMany(DocumentRequestItem::class, 'request_id')->orderBy('sort_order');
    }

    public function isMultiOffice(): bool
    {
        return $this->mode === 'multi_office';
    }

    public function isMultiDoc(): bool
    {
        return $this->mode === 'multi_doc';
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
