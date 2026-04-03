<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Document extends Model
{
    use HasFactory;

    protected $fillable = [
        'title',
        'doctype',
        'owner_office_id',
        'review_office_id',
        'visibility_scope',
        'code',
        'reserved_code',
        'school_year',
        'semester',
        'created_by',
        'archived_at',
    ];

    protected $casts = [
        'archived_at' => 'datetime',
    ];



    public function ownerOffice()
    {
        return $this->belongsTo(Office::class, 'owner_office_id');
    }

    public function reviewOffice()
    {
        return $this->belongsTo(Office::class, 'review_office_id');
    }


    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function versions()
    {
        return $this->hasMany(DocumentVersion::class)->orderByDesc('version_number');
    }

    public function sharedOffices()
    {
        return $this->belongsToMany(Office::class, 'document_shares', 'document_id', 'office_id')
            ->withTimestamps();
    }

    public function tags()
    {
        return $this->belongsToMany(Tag::class, 'document_tag', 'document_id', 'tag_id');
    }

    public function latestVersion()
    {
        return $this->hasOne(DocumentVersion::class)
            ->latestOfMany('version_number');
    }

    public function latestDistributedVersion()
    {
        return $this->hasOne(DocumentVersion::class)
            ->where('status', 'Distributed')
            ->ofMany('version_number', 'max');
    }

    public static function generateCode(Office $office, string $doctype, int $sequence): string
    {
        $docTypeCode = $doctype === 'forms' ? 'F' : 'D';
        $nextNum = str_pad($sequence, 3, '0', STR_PAD_LEFT);
        return "FCU-EOMS-{$office->code}-{$nextNum}-{$docTypeCode}";
    }

    /**
     * Peek at the next code without consuming the counter.
     * Returns null if office not found or counter not yet seeded.
     */
    public static function peekNextCode(int $ownerOfficeId, string $doctype): ?string
    {
        $office = Office::find($ownerOfficeId);
        if (!$office) return null;

        $seq = \App\Models\DocumentCounter::where('office_id', $ownerOfficeId)
            ->where('doctype', $doctype)
            ->value('next_seq') ?? 1;

        return self::generateCode($office, $doctype, (int) $seq);
    }
}
