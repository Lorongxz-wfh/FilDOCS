<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use App\Models\User;
use App\Models\Role;
use App\Models\Office;

class UserSeeder extends Seeder
{
    public function run(): void
    {
        // Clear existing users for a fresh start
        \DB::table('users')->delete();

        $adminRole    = Role::where('name', 'admin')->firstOrFail();
        $qaRole       = Role::where('name', 'qa')->firstOrFail();
        $officeHeadRole = Role::where('name', 'office_head')->firstOrFail();
        $vpRole       = Role::where('name', 'vp')->firstOrFail();
        $presRole     = Role::where('name', 'president')->firstOrFail();

        $officeId = function (string $code): int {
            return (int) (Office::where('code', strtoupper(trim($code)))->value('id') ?: 0);
        };

        // 1. System Admin
        User::create([
            'email' => 'lorongxz.wfh@gmail.com',
            'first_name' => 'System',
            'last_name' => 'Admin',
            'password' => Hash::make('Posa_123'),
            'role_id' => $adminRole->id,
            'office_id' => null,
        ]);

        // 2. Document Controller (QA)
        User::create([
            'email' => 'qa@example.com',
            'first_name' => 'Document',
            'last_name' => 'Controller',
            'password' => Hash::make('Password_123'),
            'role_id' => $qaRole->id,
            'office_id' => $officeId('QA'),
        ]);

        // 3. Vice Presidents
        $vps = [
            ['email' => 'vpadmin@example.com', 'first' => 'VP', 'last' => 'Admin', 'code' => 'VPAD'],
            ['email' => 'vpfinance@example.com', 'first' => 'VP', 'last' => 'Finance', 'code' => 'VPFIN'],
            ['email' => 'vpreqa@example.com', 'first' => 'VP', 'last' => 'REQA', 'code' => 'VPREQA'],
            ['email' => 'vpaa@example.com', 'first' => 'VP', 'last' => 'AA', 'code' => 'VPAA'],
        ];

        foreach ($vps as $vp) {
            User::create([
                'email' => $vp['email'],
                'first_name' => $vp['first'],
                'last_name' => $vp['last'],
                'password' => Hash::make('Password_123'),
                'role_id' => $vpRole->id,
                'office_id' => $officeId($vp['code']),
            ]);
        }

        // 4. President
        User::create([
            'email' => 'pres@example.com',
            'first_name' => 'Office of',
            'last_name' => 'President',
            'password' => Hash::make('Password_123'),
            'role_id' => $presRole->id,
            'office_id' => $officeId('PO'),
        ]);

        // 5. Office Heads (Real-Life Accounts)
        $heads = [
            ['email' => 'laquino@filamer.edu.ph', 'first' => 'Lor Frederick', 'last' => 'Aquino', 'code' => 'CCS'],
            ['email' => 'josephbanay@filamer.edu.ph', 'first' => 'Joseph Marie', 'last' => 'Banay', 'code' => 'CBA'],
            ['email' => 'sebacuado@filamer.edu.ph', 'first' => 'Stefan John', 'last' => 'Ebacuado', 'code' => 'CN'],
            ['email' => 'rdolfo@filamer.edu.ph', 'first' => 'Rei Ashley', 'last' => 'Dolfo', 'code' => 'CHTM'],
        ];

        foreach ($heads as $head) {
            User::create([
                'email' => $head['email'],
                'first_name' => $head['first'],
                'last_name' => $head['last'],
                'password' => Hash::make('Password_123'),
                'role_id' => $officeHeadRole->id,
                'office_id' => $officeId($head['code']),
            ]);
        }

        Log::info('FilDOCS UserSeeder completed successfully.');
    }
}
