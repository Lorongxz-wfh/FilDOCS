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
        $adminRole    = Role::where('name', 'admin')->firstOrFail();
        $auditorRole  = Role::where('name', 'auditor')->firstOrFail();

        $qaRole        = Role::where('name', 'qa')->firstOrFail();
        $deptRole      = Role::where('name', 'office_staff')->firstOrFail();
        $officeHeadRole = Role::where('name', 'office_head')->firstOrFail();

        $officeId = function (string $code): int {
            $id = (int) (Office::where('code', strtoupper(trim($code)))->value('id') ?? 0);
            if ($id <= 0) {
                throw new \RuntimeException("Office not found for code={$code}");
            }
            return $id;
        };

        $csOfficeId = Office::where('code', 'CS')->value('id');
        if (!$csOfficeId) {
            throw new \RuntimeException('Office not found for code=CS');
        }


        $vpRole   = Role::where('name', 'vp')->firstOrFail();
        $presRole = Role::where('name', 'president')->firstOrFail();

        User::updateOrCreate(
            ['email' => 'lorongxz.wfh@gmail.com'],
            [
                'first_name' => 'Lorongxz',
                'middle_name' => null,
                'last_name' => 'Admin',
                'suffix' => null,
                'profile_photo_path' => null,

                'password' => Hash::make('Posa123'),
                'role_id'  => $adminRole->id,
                'office_id' => null,
            ]
        );

        User::updateOrCreate(
            ['email' => 'laquino@filamer.edu.ph'],
            [
                'first_name' => 'Lor Frederick James',
                'middle_name' => 'Roxas',
                'last_name' => 'Aquino',
                'suffix' => null,
                'profile_photo_path' => null,

                'password' => Hash::make('Posa123'),
                'role_id'  => $deptRole->id,
                'office_id' => $officeId('CS'),
            ]
        );



        User::updateOrCreate(
            ['email' => 'auditor@example.com'],
            [
                'first_name' => 'External',
                'middle_name' => null,
                'last_name' => 'Auditor',
                'suffix' => null,
                'profile_photo_path' => null,

                'password' => Hash::make('password'),
                'role_id'  => $auditorRole->id,
                'office_id' => null,
            ]
        );

        User::updateOrCreate(
            ['email' => 'vpadmin@example.com'],
            [
                'first_name' => 'VP',
                'middle_name' => null,
                'last_name' => 'Admin',
                'suffix' => null,
                'profile_photo_path' => null,

                'password' => Hash::make('password'),
                'role_id'  => $vpRole->id,
                'office_id' => $officeId('VAD'),
            ]
        );


        User::updateOrCreate(
            ['email' => 'vpfinance@example.com'],
            [
                'first_name' => 'VP',
                'middle_name' => null,
                'last_name' => 'Finance',
                'suffix' => null,
                'profile_photo_path' => null,

                'password' => Hash::make('password'),
                'role_id'  => $vpRole->id,
                'office_id' => $officeId('VFI'),

            ]
        );

        User::updateOrCreate(
            ['email' => 'vpreqa@example.com'],
            [
                'first_name' => 'VP',
                'middle_name' => null,
                'last_name' => 'REQA',
                'suffix' => null,
                'profile_photo_path' => null,

                'password' => Hash::make('password'),
                'role_id'  => $vpRole->id,
                'office_id' => $officeId('VRQ'),

            ]
        );


        User::updateOrCreate(
            ['email' => 'qa@example.com'],
            [
                'first_name' => 'Document',
                'middle_name' => null,
                'last_name' => 'Controller',
                'suffix' => null,
                'profile_photo_path' => null,

                'password' => Hash::make('password'),
                'role_id'  => $qaRole->id,
                'office_id' => $officeId('QA'),
            ]
        );


        User::updateOrCreate(
            ['email' => 'ccs@example.com'],
            [
                'first_name' => 'CCS',
                'middle_name' => null,
                'last_name' => 'Staff',
                'suffix' => null,
                'profile_photo_path' => null,

                'password' => Hash::make('password'),
                'role_id'  => $deptRole->id,
                'office_id' => $officeId('CS'),
            ]
        );

        User::updateOrCreate(
            ['email' => 'cshead@example.com'], // <-- confirm/replace email
            [
                'first_name' => 'CS',
                'middle_name' => null,
                'last_name' => 'Head',
                'suffix' => null,
                'profile_photo_path' => null,

                'password' => Hash::make('password'),
                'role_id'  => $officeHeadRole->id,
                'office_id' => (int) $csOfficeId,
            ]
        );

        User::updateOrCreate(
            ['email' => 'vpaa@example.com'],
            [
                'first_name' => 'VP',
                'middle_name' => null,
                'last_name' => 'AA',
                'suffix' => null,
                'profile_photo_path' => null,

                'password' => Hash::make('password'),
                'role_id'  => $vpRole->id,
                'office_id' => $officeId('VAR'),
            ]
        );

        User::updateOrCreate(
            ['email' => 'pres@example.com'],
            [
                'first_name' => 'Office',
                'middle_name' => 'of',
                'last_name' => 'President',
                'suffix' => null,
                'profile_photo_path' => null,

                'password' => Hash::make('password'),
                'role_id'  => $presRole->id,
                'office_id' => $officeId('PO'),
            ]
        );

        User::updateOrCreate(
            ['email' => 'josephbanay030@gmail.com'],
            [
                'first_name'         => 'Joseph',
                'middle_name'        => null,
                'last_name'          => 'Banay',
                'suffix'             => null,
                'profile_photo_path' => null,
                'password'           => Hash::make('password'),
                'role_id'            => $officeHeadRole->id,
                'office_id'          => $officeId('CB'),
            ]
        );

        User::updateOrCreate(
            ['email' => 'Ebacuadomentino@gmail.com'],
            [
                'first_name'         => 'Mentino',
                'middle_name'        => null,
                'last_name'          => 'Ebacuado',
                'suffix'             => null,
                'profile_photo_path' => null,
                'password'           => Hash::make('password'),
                'role_id'            => $officeHeadRole->id,
                'office_id'          => $officeId('CN'),
            ]
        );

        Log::info('UserSeeder done', [
            'admin_exists' => \App\Models\User::where('email', 'admin@example.com')->exists(),
            'qa_exists' => \App\Models\User::where('email', 'qa@example.com')->exists(),
            'user_count' => \App\Models\User::count(),
        ]);
    }
}
