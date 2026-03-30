<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('document_request_messages', function (Blueprint $table) {
            $table->id();

            $table->unsignedBigInteger('document_request_id');
            $table->foreign('document_request_id')
                ->references('id')->on('document_requests')
                ->cascadeOnDelete();

            $table->unsignedBigInteger('sender_user_id');
            $table->foreign('sender_user_id')
                ->references('id')->on('users')
                ->cascadeOnDelete();

            // 'comment' is the only type for now; room to add 'system' later
            // Thread scoping — both null = batch-level shared thread
            $table->unsignedBigInteger('recipient_id')->nullable();
            $table->foreign('recipient_id')
                ->references('id')->on('document_request_recipients')
                ->cascadeOnDelete();

            $table->unsignedBigInteger('item_id')->nullable();
            $table->foreign('item_id')
                ->references('id')->on('document_request_items')
                ->cascadeOnDelete();

            $table->string('type', 30)->default('comment');
            $table->text('message');

            $table->timestamps();

            $table->index('document_request_id');
            $table->index(['document_request_id', 'recipient_id']);
            $table->index(['document_request_id', 'item_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('document_request_messages');
    }
};
