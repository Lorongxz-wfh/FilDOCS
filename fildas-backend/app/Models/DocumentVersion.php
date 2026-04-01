<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class DocumentVersion extends Model
{
    use HasFactory;

    protected $fillable = [
        'document_id',
        'version_number',
        'status',
        'workflow_type',
        'routing_mode',

        'file_path',
        'preview_path',
        'original_filename',
        'description',
        'revision_reason',
        'effective_date',
        'distributed_at',
        'superseded_at',
        'cancelled_at',
    ];

    protected $casts = [
        'workflow_type' => 'string',
        'routing_mode'  => 'string',
        'effective_date' => 'date',
        'distributed_at' => 'datetime',
        'superseded_at'  => 'datetime',
        'cancelled_at'   => 'datetime',
    ];

    public function document()
    {
        return $this->belongsTo(Document::class);
    }

    public function messages()
    {
        return $this->hasMany(DocumentMessage::class, 'document_version_id')
            ->orderBy('created_at');
    }

    public function tasks()
    {
        return $this->hasMany(WorkflowTask::class, 'document_version_id');
    }
}
