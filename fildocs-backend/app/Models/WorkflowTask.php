<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class WorkflowTask extends Model
{
    use HasFactory;
    protected $fillable = [
        'document_version_id',
        'phase',
        'step',
        'assigned_office_id',
        'assigned_role_id',
        'assigned_user_id',
        'status',
        'opened_at',
        'completed_at',
    ];

    protected $casts = [
        'opened_at' => 'datetime',
        'completed_at' => 'datetime',
    ];

    public function version()
    {
        return $this->belongsTo(DocumentVersion::class, 'document_version_id');
    }

    public function assignedOffice()
    {
        return $this->belongsTo(Office::class, 'assigned_office_id');
    }
}
