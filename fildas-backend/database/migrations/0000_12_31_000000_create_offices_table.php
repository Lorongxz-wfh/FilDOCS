<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (!Schema::hasTable('offices')) {
            Schema::create('offices', function (Blueprint $table) {
                $table->id();
                $table->string('name');        // e.g. "President Office"
                $table->string('code')->unique();  // e.g. "PO"
                $table->text('description')->nullable();

                // Classification
                $table->string('type')->default('office'); // 'office' | 'department'

                // Cluster marker for workflow routing (code/name can change safely)
                $table->string('cluster_kind')->nullable(); // null | 'vp' | 'president'
                $table->index(['cluster_kind']);

                // Org hierarchy: which office this office reports to (dept -> VP, VP -> President)
                $table->foreignId('parent_office_id')
                    ->nullable()
                    ->constrained('offices')
                    ->nullOnDelete();

                $table->index(['parent_office_id']);

                $table->timestamps();
                $table->softDeletes();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('offices');
    }
};
