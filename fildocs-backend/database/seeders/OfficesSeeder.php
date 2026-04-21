<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Office;

class OfficesSeeder extends Seeder
{
    public function run(): void
    {
        $offices = [
            // President Office
            ['name' => "President's Office", 'code' => 'PO', 'type' => 'office', 'cluster_kind' => 'president'],
            ['name' => 'Human Resource', 'code' => 'HR', 'type' => 'office'],
            ['name' => 'Student Affairs Office', 'code' => 'SA', 'type' => 'office'],
            ['name' => 'Chaplaincy Office', 'code' => 'CH', 'type' => 'office'],
            ['name' => 'Alumni Affairs Office', 'code' => 'AA', 'type' => 'office'],

            // VP-Admin
            ['name' => 'VP-Admin', 'code' => 'VPAD', 'type' => 'office', 'cluster_kind' => 'vp'],
            ['name' => 'Pollution Control', 'code' => 'PC', 'type' => 'office'],
            ['name' => 'Medical-Dental Clinic', 'code' => 'MD', 'type' => 'office'],
            ['name' => 'Security Office', 'code' => 'SO', 'type' => 'office'],
            ['name' => 'Sports Office', 'code' => 'SP', 'type' => 'office'],
            ['name' => 'Socio-Cultural Affairs', 'code' => 'SC', 'type' => 'office'],
            ['name' => 'Safety and Health', 'code' => 'SH', 'type' => 'office'],
            ['name' => 'Buildings and Grounds', 'code' => 'BG', 'type' => 'office'],
            ['name' => 'Mass Media', 'code' => 'MM', 'type' => 'office'],
            ['name' => 'Work-Study Program Office', 'code' => 'WP', 'type' => 'office'],
            ['name' => 'IT / MIS', 'code' => 'IT', 'type' => 'office'],

            // VP-Academic Affairs
            ['name' => 'VP-Academic Affairs', 'code' => 'VPAA', 'type' => 'office', 'cluster_kind' => 'vp'],

            // Departments (Academic)
            ['name' => 'College of Nursing', 'code' => 'CN', 'type' => 'department'],
            ['name' => 'College of Business and Accountancy', 'code' => 'CBA', 'type' => 'department'],
            ['name' => 'College of Teacher Education', 'code' => 'CTE', 'type' => 'department'],
            ['name' => 'High School', 'code' => 'HS', 'type' => 'department'],
            ['name' => 'Elementary', 'code' => 'ES', 'type' => 'department'],
            ['name' => 'Preschool', 'code' => 'PS', 'type' => 'department'],
            ['name' => 'Graduate School', 'code' => 'GS', 'type' => 'department'],
            ['name' => 'College of Arts and Sciences', 'code' => 'CAS', 'type' => 'department'],
            ['name' => 'College of Hospitality and Tourism Management', 'code' => 'CHTM', 'type' => 'department'],
            ['name' => 'College of Computer Studies', 'code' => 'CCS', 'type' => 'department'],
            ['name' => 'College of Criminal Justice Education', 'code' => 'CCJE', 'type' => 'department'],
            ['name' => 'College of Engineering', 'code' => 'COE', 'type' => 'department'],

            // Still under VP-Academic Affairs (non-department offices)
            ['name' => 'Registrar', 'code' => 'AR', 'type' => 'office'],
            ['name' => 'Guidance Counseling Center', 'code' => 'GCC', 'type' => 'office'],
            ['name' => 'University Library', 'code' => 'UL', 'type' => 'office'],
            ['name' => 'NSTP', 'code' => 'NSTP', 'type' => 'office'],

            // VP-Finance
            ['name' => 'VP-Finance', 'code' => 'VPFIN', 'type' => 'office', 'cluster_kind' => 'vp'],
            ['name' => 'Accounting Office', 'code' => 'AO', 'type' => 'office'],
            ['name' => 'Bookkeeping', 'code' => 'BO', 'type' => 'office'],
            ['name' => 'Business Manager', 'code' => 'BM', 'type' => 'office'],
            ['name' => 'Cashier', 'code' => 'CO', 'type' => 'office'],
            ['name' => 'Property Custodian', 'code' => 'PR', 'type' => 'office'],
            ['name' => 'University Enterprise', 'code' => 'UE', 'type' => 'office'],

            // VP-REQA
            ['name' => 'VP-REQA', 'code' => 'VPREQA', 'type' => 'office', 'cluster_kind' => 'vp'],
            ['name' => 'Research and Continuing Education', 'code' => 'RC', 'type' => 'office'],
            ['name' => 'Community Extension / Outreach', 'code' => 'CX', 'type' => 'office'],
            ['name' => 'Quality Assurance', 'code' => 'QA', 'type' => 'office'],
            ['name' => 'International Programs', 'code' => 'IP', 'type' => 'office'],
        ];




        foreach ($offices as $office) {
            Office::updateOrCreate(
                ['code' => $office['code']],
                [
                    'name' => $office['name'],
                    'type' => $office['type'] ?? 'office',
                    'cluster_kind' => $office['cluster_kind'] ?? null,
                ]
            );
        }

        // 2nd pass: assign parent_office_id using office codes
        $parentByCode = [
            // President cluster
            'HR'   => 'PO',
            'SA'   => 'PO',
            'CH'   => 'PO',
            'AA'   => 'PO',

            // VP-Admin cluster
            'PC'   => 'VPAD',
            'MD'   => 'VPAD',
            'SO'   => 'VPAD',
            'SP'   => 'VPAD',
            'SC'   => 'VPAD',
            'SH'   => 'VPAD',
            'BG'   => 'VPAD',
            'MM'   => 'VPAD',
            'WP'   => 'VPAD',
            'IT'   => 'VPAD',

            // VP-Academic Affairs cluster
            'CN'   => 'VPAA',
            'CBA'  => 'VPAA',
            'CTE'  => 'VPAA',
            'HS'   => 'VPAA',
            'ES'   => 'VPAA',
            'PS'   => 'VPAA',
            'GS'   => 'VPAA',
            'CAS'  => 'VPAA',
            'CHTM' => 'VPAA',
            'CCS'  => 'VPAA',
            'CCJE' => 'VPAA',
            'COE'  => 'VPAA',
            'AR'   => 'VPAA',
            'GCC'  => 'VPAA',
            'UL'   => 'VPAA',
            'NSTP' => 'VPAA',

            // VP-Finance cluster
            'AO'   => 'VPFIN',
            'BO'   => 'VPFIN',
            'BM'   => 'VPFIN',
            'CO'   => 'VPFIN',
            'PR'   => 'VPFIN',
            'UE'   => 'VPFIN',

            // VP-REQA cluster
            'RC'   => 'VPREQA',
            'CX'   => 'VPREQA',
            'QA'   => 'VPREQA',
            'IP'   => 'VPREQA',

            // VPs report to President
            'VPAD'   => 'PO',
            'VPAA'   => 'PO',
            'VPFIN'  => 'PO',
            'VPREQA' => 'PO',
        ];


        // Update parent_office_id
        foreach ($parentByCode as $childCode => $parentCode) {
            $child = Office::where('code', $childCode)->first();
            $parent = Office::where('code', $parentCode)->first();

            if ($child && $parent) {
                $child->parent_office_id = $parent->id;
                $child->save();
            }
        }
    }
}
