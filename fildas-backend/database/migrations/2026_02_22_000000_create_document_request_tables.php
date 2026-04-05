<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('document_requests', function (Blueprint $table) {
            $table->id();

            $table->string('title', 180);
            $table->text('description')->nullable();
            $table->dateTime('due_at')->nullable();

            $table->enum('status', ['open', 'closed', 'cancelled'])->default('open');

            // Optional example/guide file attached by QA
            $table->string('example_original_filename')->nullable();
            $table->string('example_file_path')->nullable();
            $table->string('example_preview_path')->nullable();

            $table->foreignId('created_by_user_id')->nullable()->constrained('users')->nullOnDelete();

            $table->enum('mode', ['multi_office', 'multi_doc'])->default('multi_office');

            $table->json('meta')->nullable();

            $table->timestamps();

            $table->index(['status']);
            $table->index(['due_at']);
            $table->index(['created_by_user_id']);
        });

        Schema::create('document_request_recipients', function (Blueprint $table) {
            $table->id();

            $table->foreignId('request_id')->constrained('document_requests')->cascadeOnDelete();
            $table->foreignId('office_id')->constrained('offices')->restrictOnDelete();

            $table->enum('status', ['pending', 'submitted', 'accepted', 'rejected', 'cancelled'])->default('pending');
            $table->dateTime('due_at')->nullable();
            $table->dateTime('last_submitted_at')->nullable();
            $table->dateTime('last_reviewed_at')->nullable();

            $table->json('meta')->nullable();

            $table->timestamps();

            $table->unique(['request_id', 'office_id'], 'drr_request_office_unique');
            $table->index(['office_id', 'status']);
            $table->index(['request_id', 'status']);
        });

        Schema::create('document_request_items', function (Blueprint $table) {
            $table->id();

            $table->foreignId('request_id')
                ->constrained('document_requests')
                ->cascadeOnDelete();

            $table->string('title', 180);
            $table->text('description')->nullable();
            $table->dateTime('due_at')->nullable();

            $table->string('example_original_filename')->nullable();
            $table->string('example_file_path')->nullable();
            $table->string('example_preview_path')->nullable();

            $table->unsignedInteger('sort_order')->default(0);

            $table->timestamps();

            $table->index(['request_id', 'sort_order']);
        });

        Schema::create('document_request_submissions', function (Blueprint $table) {
            $table->id();

            $table->foreignId('recipient_id')->constrained('document_request_recipients')->cascadeOnDelete();

            $table->foreignId('item_id')
                ->nullable()
                ->constrained('document_request_items')
                ->nullOnDelete();

            // Each office can submit multiple attempts over time
            $table->unsignedInteger('attempt_no')->default(1);

            $table->foreignId('submitted_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->text('note')->nullable();

            $table->enum('status', ['submitted', 'accepted', 'rejected'])->default('submitted');

            $table->foreignId('qa_reviewed_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->text('qa_review_note')->nullable();
            $table->dateTime('reviewed_at')->nullable();

            $table->json('meta')->nullable();

            $table->timestamps();

            $table->unique(['recipient_id', 'attempt_no'], 'drs_recipient_attempt_unique');
            $table->index(['recipient_id', 'status']);
            $table->index(['status']);
        });

        Schema::create('document_request_submission_files', function (Blueprint $table) {
            $table->id();

            $table->foreignId('submission_id')->constrained('document_request_submissions')->cascadeOnDelete();

            $table->string('original_filename');
            $table->string('file_path');
            $table->string('preview_path')->nullable();

            $table->string('mime')->nullable();
            $table->unsignedBigInteger('size_bytes')->nullable();

            $table->json('meta')->nullable();

            $table->timestamps();

            $table->index(['submission_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('document_request_submission_files');
        Schema::dropIfExists('document_request_submissions');
        Schema::dropIfExists('document_request_items');
        Schema::dropIfExists('document_request_recipients');
        Schema::dropIfExists('document_requests');
    }
};
