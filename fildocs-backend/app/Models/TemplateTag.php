<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class TemplateTag extends Model
{
    protected $fillable = ['name'];

    public function templates(): BelongsToMany
    {
        return $this->belongsToMany(DocumentTemplate::class, 'document_template_tag');
    }
}
