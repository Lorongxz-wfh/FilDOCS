<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Role;

class RoleSeeder extends Seeder
{
    public function run(): void
    {
        $roles = [
            ['name' => 'admin',      'label' => 'System Admin'],
            ['name' => 'auditor',    'label' => 'Auditor'],

            ['name' => 'qa',         'label' => 'Quality Assurance'],
            ['name' => 'office_staff', 'label' => 'Office Staff'],
            ['name' => 'office_head',  'label' => 'Office Head'],

            ['name' => 'vp',         'label' => 'Vice President'],

            ['name' => 'president',  'label' => 'President'],
        ];

        foreach ($roles as $role) {
            Role::updateOrCreate(['name' => $role['name']], $role);
        }
    }
}
