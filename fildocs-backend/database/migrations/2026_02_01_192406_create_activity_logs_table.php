<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('activity_logs', function (Blueprint $table) {
            $table->id();

            $table->foreignId('document_id')->nullable()
                ->constrained('documents')->nullOnDelete();

            $table->foreignId('document_version_id')->nullable()
                ->constrained('document_versions')->nullOnDelete();

            $table->foreignId('actor_user_id')->nullable()
                ->constrained('users')->nullOnDelete();

            $table->foreignId('actor_office_id')->nullable()
                ->constrained('offices')->nullOnDelete();

            $table->foreignId('target_office_id')->nullable()
                ->constrained('offices')->nullOnDelete();

            // Stable code (filterable)
            $table->string('event', 80);

            // Human readable message
            $table->string('label', 255);

            // Extra info (action code, from/to status, user agent, etc.)
            $table->json('meta')->nullable();

            $table->timestamps();

            $table->index(['event', 'created_at']);
            $table->index(['document_id', 'created_at']);
            $table->index(['document_version_id', 'created_at']);
            $table->index(['actor_user_id', 'created_at']);
            $table->index(['actor_office_id', 'created_at']);
            $table->index(['target_office_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('activity_logs');
    }
};
