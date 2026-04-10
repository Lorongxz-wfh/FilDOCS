<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ActivityLog extends Model
{
    protected $fillable = [
        'document_id',
        'document_version_id',
        'actor_user_id',
        'actor_office_id',
        'target_office_id',
        'event',
        'label',
        'meta',
        'personal_access_token_id',
    ];

    protected $casts = [
        'meta' => 'array',
    ];

    public function document()
    {
        return $this->belongsTo(Document::class);
    }
    public function version()
    {
        return $this->belongsTo(DocumentVersion::class, 'document_version_id');
    }
    public function actorUser()
    {
        return $this->belongsTo(User::class, 'actor_user_id');
    }
    public function actorOffice()
    {
        return $this->belongsTo(Office::class, 'actor_office_id');
    }
    public function targetOffice()
    {
        return $this->belongsTo(Office::class, 'target_office_id');
    }

    /**
     * Relationship to DocumentRequest using the document_request_id stored in meta.
     * Note: This works in Laravel 10+ with meta->document_request_id as the foreign key.
     */
    public function documentRequest()
    {
        return $this->belongsTo(DocumentRequest::class, 'meta->document_request_id');
    }
}
