<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('notifications', function (Blueprint $table) {
            $table->id();

            // Recipient
            $table->foreignId('user_id')
                ->constrained('users')
                ->cascadeOnDelete();

            // Optional linkage
            $table->foreignId('document_id')->nullable()
                ->constrained('documents')->nullOnDelete();

            $table->foreignId('document_version_id')->nullable()
                ->constrained('document_versions')->nullOnDelete();

            // What happened
            $table->string('event', 80);       // e.g. workflow.assigned, document.distributed
            $table->string('title', 180);      // short text
            $table->text('body')->nullable();  // longer text
            $table->json('meta')->nullable();  // anything: action, from/to, office ids, etc.

            // Read status
            $table->timestamp('read_at')->nullable();

            $table->timestamps();

            $table->index(['user_id', 'read_at', 'created_at']);
            $table->index(['event', 'created_at']);
            $table->index(['document_id', 'created_at']);
            $table->index(['document_version_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('notifications');
    }
};
