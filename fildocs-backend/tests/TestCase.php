<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Foundation\Testing\RefreshDatabase;
use App\Models\User;
use App\Models\Role;
use App\Models\Office;

abstract class TestCase extends BaseTestCase
{
    use RefreshDatabase;

    protected function createQaUser()
    {
        $qaRole = Role::firstOrCreate(['name' => 'qa'], ['label' => 'QA']);
        $qaOffice = Office::factory()->create(['code' => 'QA', 'name' => 'QA Office']);
        
        return User::factory()->create([
            'role_id' => $qaRole->id,
            'office_id' => $qaOffice->id
        ]);
    }

    protected function createOfficeUser(string $code = 'HR')
    {
        $role = Role::firstOrCreate(['name' => 'office_staff'], ['label' => 'Staff']);
        $office = Office::factory()->create(['code' => $code]);
        
        return User::factory()->create([
            'role_id' => $role->id,
            'office_id' => $office->id
        ]);
    }
}
