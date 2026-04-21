<?php

namespace Database\Factories;

use App\Models\Document;
use App\Models\Office;
use Illuminate\Database\Eloquent\Factories\Factory;

class DocumentFactory extends Factory
{
    protected $model = Document::class;

    public function definition(): array
    {
        return [
            'owner_office_id' => Office::factory(),
            'title'           => $this->faker->sentence(4),
            'description'     => $this->faker->paragraph,
            'doctype'         => 'Internal Memorandum',
            'visibility_scope' => 'office',
            'created_by'      => 1, // Will be overridden in tests
        ];
    }
}
