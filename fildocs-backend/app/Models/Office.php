<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Office extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = ['name', 'code', 'description', 'type', 'parent_office_id'];

    public function documents()
    {
        return $this->hasMany(Document::class, 'owner_office_id');
    }

    public function parentOffice()
    {
        return $this->belongsTo(Office::class, 'parent_office_id');
    }

    public function childOffices()
    {
        return $this->hasMany(Office::class, 'parent_office_id');
    }
}
