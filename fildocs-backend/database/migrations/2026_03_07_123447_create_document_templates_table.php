<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('document_templates', function (Blueprint $table) {
            $table->id();

            $table->string('name');                         // display name
            $table->text('description')->nullable();

            $table->string('original_filename');            // e.g. "SOP Template.docx"
            $table->string('file_path');                    // storage path
            $table->unsignedBigInteger('file_size');
            $table->string('thumbnail_path')->nullable();        // bytes
            $table->string('mime_type', 100);

            // Who uploaded
            $table->foreignId('uploaded_by')
                ->constrained('users')
                ->cascadeOnDelete();

            // Scope: null = global (Admin/QA), otherwise restricted to this office
            $table->foreignId('office_id')
                ->nullable()
                ->constrained('offices')
                ->nullOnDelete();

            $table->softDeletes();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('document_templates');
    }
};
