<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DocumentTemplate extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'name',
        'description',
        'original_filename',
        'file_path',
        'thumbnail_path',
        'file_size',
        'mime_type',
        'uploaded_by',
        'office_id',
    ];

    protected $appends = ['thumbnail_url'];

    protected $casts = [
        'file_size' => 'integer',
        'office_id' => 'integer',
    ];

    // ── Relationships ────────────────────────────────────────

    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }

    public function office(): BelongsTo
    {
        return $this->belongsTo(Office::class);
    }

    public function tags(): \Illuminate\Database\Eloquent\Relations\BelongsToMany
    {
        return $this->belongsToMany(TemplateTag::class, 'document_template_tag');
    }

    // ── Helpers ──────────────────────────────────────────────

    /**
     * True when this template is visible to all offices.
     */
    public function isGlobal(): bool
    {
        return is_null($this->office_id);
    }

    /**
     * Human-readable file size, e.g. "1.2 MB".
     */
    public function formattedSize(): string
    {
        $bytes = $this->file_size;

        if ($bytes >= 1_048_576) {
            return round($bytes / 1_048_576, 1) . ' MB';
        }

        if ($bytes >= 1_024) {
            return round($bytes / 1_024, 1) . ' KB';
        }

        return $bytes . ' B';
    }

    public function getThumbnailUrlAttribute(): ?string
    {
        if (!$this->thumbnail_path) {
            return null;
        }

        // Return a signed URL to the proxy route
        return \Illuminate\Support\Facades\URL::temporarySignedRoute(
            'templates.thumbnail',
            now()->addMinutes(60),
            ['template' => $this->id]
        );
    }
}
