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
        Schema::create('document_versions', function (Blueprint $table) {
            $table->id();

            $table->foreignId('document_id')->constrained('documents')->cascadeOnDelete();
            $table->unsignedInteger('version_number')->default(0);

            $table->string('status', 50)->default('Draft');
            $table->string('workflow_type', 20)->default('qa'); // qa | office
            $table->index(['workflow_type', 'status']);


            $table->string('file_path')->nullable();
            $table->string('preview_path')->nullable();
            $table->string('original_filename')->nullable();

            $table->text('description')->nullable();
            $table->text('revision_reason')->nullable();

            $table->date('effective_date')->nullable();

            $table->timestamp('distributed_at')->nullable();
            $table->timestamp('superseded_at')->nullable();
            $table->timestamp('cancelled_at')->nullable();

            $table->timestamps();

            $table->unique(['document_id', 'version_number']);
            $table->index(['document_id', 'status']);

            // Helps "latest version per document" queries and joins
            $table->index(['document_id', 'version_number']);
            $table->index(['document_id', 'version_number', 'status']);
        });
    }


    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('document_versions');
    }
};
