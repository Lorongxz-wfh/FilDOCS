<?php

namespace Database\Factories;

use App\Models\Office;
use Illuminate\Database\Eloquent\Factories\Factory;

class OfficeFactory extends Factory
{
    protected $model = Office::class;

    public function definition(): array
    {
        return [
            'name' => $this->faker->company . ' Office',
            'code' => strtoupper($this->faker->unique()->lexify('???')),
            'description' => $this->faker->sentence,
            'type' => 'office',
            'cluster_kind' => null,
            'parent_office_id' => null,
        ];
    }
}
