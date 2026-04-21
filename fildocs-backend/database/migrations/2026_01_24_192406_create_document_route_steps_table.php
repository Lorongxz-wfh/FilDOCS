<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('document_route_steps', function (Blueprint $table) {
            $table->id();

            $table->foreignId('document_version_id')
                ->constrained('document_versions')
                ->cascadeOnDelete();

            // For now: store the custom “review routing list”.
            // Later we can extend to approval routing too.
            $table->enum('phase', ['review', 'approval'])->default('review');

            $table->unsignedTinyInteger('step_order'); // 1..5
            $table->foreignId('office_id')->constrained('offices')->cascadeOnDelete();

            $table->timestamps();

            $table->unique(['document_version_id', 'phase', 'step_order'], 'drs_version_phase_order_unique');

            // Prevent duplicates in the custom list for a phase (defense-in-depth)
            $table->unique(['document_version_id', 'phase', 'office_id'], 'drs_version_phase_office_unique');

            $table->index(['document_version_id', 'phase']);
            $table->index(['office_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('document_route_steps');
    }
};
