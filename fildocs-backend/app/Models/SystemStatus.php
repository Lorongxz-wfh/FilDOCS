<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SystemStatus extends Model
{
    protected $table = 'system_status';
    
    protected $fillable = [
        'maintenance_mode',
        'maintenance_message',
        'maintenance_expires_at',
        'maintenance_starts_at',
        'is_notified',
        'last_disk_alert_at',
    ];

    protected $casts = [
        'maintenance_expires_at' => 'datetime',
        'maintenance_starts_at' => 'datetime',
        'is_notified' => 'boolean',
        'last_disk_alert_at' => 'datetime',
    ];
}
