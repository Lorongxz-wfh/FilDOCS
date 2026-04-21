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
        Schema::create('documents', function (Blueprint $table) {
            $table->id();

            $table->string('title');
            $table->string('doctype', 50);

            $table->text('description')->nullable();

            $table->foreignId('owner_office_id')->constrained('offices')->restrictOnDelete();

            // Office chosen by QA for review/approval routing (NOT ownership)
            $table->foreignId('review_office_id')->nullable()->constrained('offices')->nullOnDelete();

            $table->enum('visibility_scope', ['office', 'global'])->default('office');


            $table->string('code', 100)->nullable()->unique();
            $table->string('reserved_code', 100)->nullable();

            $table->string('school_year', 20)->nullable();
            $table->string('semester', 20)->nullable();

            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();

            $table->timestamp('archived_at')->nullable();
            $table->softDeletes();
            $table->timestamps();

            $table->index(['owner_office_id', 'doctype']);
            $table->index(['review_office_id']);
            $table->index(['school_year', 'semester']);
            $table->index(['visibility_scope']);
        });
        Schema::create('document_counters', function (Blueprint $table) {
            $table->id();

            $table->foreignId('office_id')
                ->constrained('offices')
                ->restrictOnDelete();

            $table->string('doctype', 50);

            // Next sequence number to use (1-based)
            $table->unsignedInteger('next_seq')->default(1);

            $table->timestamps();

            $table->unique(['office_id', 'doctype'], 'document_counters_office_doctype_unique');
        });
    }


    /**
     * Reverse the migrations.
     */
    public function down(): void
    {

        Schema::dropIfExists('documents');
        Schema::dropIfExists('document_counters');
    }
};
