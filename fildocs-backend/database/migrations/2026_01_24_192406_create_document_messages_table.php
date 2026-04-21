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
        Schema::create('document_messages', function (Blueprint $table) {
            $table->id();

            $table->foreignId('document_version_id')->constrained('document_versions')->cascadeOnDelete();
            $table->foreignId('sender_user_id')->constrained('users')->restrictOnDelete();

            $table->enum('type', ['comment', 'return_note', 'reject_note', 'approval_note', 'system'])->default('comment');
            $table->text('message');

            $table->timestamps();

            $table->index(['document_version_id', 'created_at']);
        });
    }


    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('document_messages');
    }
};
