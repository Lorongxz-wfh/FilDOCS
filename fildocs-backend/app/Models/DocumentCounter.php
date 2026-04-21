<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class DocumentCounter extends Model
{
    use HasFactory;

    protected $table = "document_counters";

    protected $fillable = [
        'office_id',
        'doctype',
        'next_seq',
    ];
}
