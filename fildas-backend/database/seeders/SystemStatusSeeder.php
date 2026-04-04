<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class SystemStatusSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        \App\Models\SystemStatus::firstOrCreate(['id' => 1], [
            'maintenance_mode' => 'off',
            'maintenance_message' => 'System is currently undergoing scheduled maintenance. Please try again later.',
        ]);
    }
}
