<?php

namespace Database\Factories;

use App\Models\Document;
use App\Models\DocumentVersion;
use Illuminate\Database\Eloquent\Factories\Factory;

class DocumentVersionFactory extends Factory
{
    protected $model = DocumentVersion::class;

    public function definition(): array
    {
        return [
            'document_id' => Document::factory(),
            'version_number' => 0,
            'status'         => 'Draft',
            'original_filename' => 'test-file.pdf',
            'file_path'       => 'documents/test-file.pdf',
        ];
    }
}
