<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('workflow_tasks', function (Blueprint $table) {
            $table->id();

            $table->foreignId('document_version_id')->constrained('document_versions')->cascadeOnDelete();

            $table->enum('phase', ['draft', 'review', 'approval', 'finalization', 'registration']);
            $table->string('step', 50);

            $table->foreignId('assigned_office_id')->nullable()->constrained('offices')->nullOnDelete();
            $table->foreignId('assigned_role_id')->nullable()->constrained('roles')->nullOnDelete();
            $table->foreignId('assigned_user_id')->nullable()->constrained('users')->nullOnDelete();

            $table->enum('status', ['open', 'completed', 'returned', 'rejected', 'cancelled', 'reopened'])->default('open');

            $table->timestamp('opened_at')->nullable();
            $table->timestamp('completed_at')->nullable();

            $table->timestamps();
            $table->index(['status', 'phase', 'step']);
            $table->index(['assigned_office_id', 'assigned_role_id']);

            // Critical for "tasks for version" and join performance
            $table->index(['document_version_id', 'status']);
            $table->index(['assigned_office_id', 'status']);
        });
    }


    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('workflow_tasks');
    }
};
