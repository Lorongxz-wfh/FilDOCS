<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Expand workflow_tasks.phase enum to include 'draft' and 'finalization'
        DB::statement("ALTER TABLE workflow_tasks MODIFY COLUMN phase ENUM('draft','review','approval','registration','finalization') NOT NULL");

        // 2. Add cancelled_at to document_versions if not present
        if (!Schema::hasColumn('document_versions', 'cancelled_at')) {
            Schema::table('document_versions', function (Blueprint $table) {
                $table->timestamp('cancelled_at')->nullable()->after('superseded_at');
            });
        }

        // 3. Rename any existing qa_final_check tasks to qa_review_final_check
        // so old data doesn't break (best-effort, only affects dev/test data)
        DB::table('workflow_tasks')
            ->where('step', 'qa_final_check')
            ->update(['step' => 'qa_review_final_check']);

        // 4. Rename office_final_check → office_review_final_check
        DB::table('workflow_tasks')
            ->where('step', 'office_final_check')
            ->update(['step' => 'office_review_final_check']);
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE workflow_tasks MODIFY COLUMN phase ENUM('review','approval','registration') NOT NULL");

        DB::table('workflow_tasks')
            ->where('step', 'qa_review_final_check')
            ->update(['step' => 'qa_final_check']);

        DB::table('workflow_tasks')
            ->where('step', 'office_review_final_check')
            ->update(['step' => 'office_final_check']);

        if (Schema::hasColumn('document_versions', 'cancelled_at')) {
            Schema::table('document_versions', function (Blueprint $table) {
                $table->dropColumn('cancelled_at');
            });
        }
    }
};
