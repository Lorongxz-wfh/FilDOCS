<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DocumentMessage extends Model
{
    protected $fillable = [
        'document_version_id',
        'sender_user_id',
        'type',
        'message',
    ];

    public function version()
    {
        return $this->belongsTo(DocumentVersion::class, 'document_version_id');
    }

    public function sender()
    {
        return $this->belongsTo(User::class, 'sender_user_id');
    }
}
