<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('template_tags', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique();
            $table->timestamps();
        });

        Schema::create('document_template_tag', function (Blueprint $table) {
            $table->foreignId('document_template_id')
                ->constrained('document_templates')
                ->cascadeOnDelete();
            $table->foreignId('template_tag_id')
                ->constrained('template_tags')
                ->cascadeOnDelete();
            $table->primary(['document_template_id', 'template_tag_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('document_template_tag');
        Schema::dropIfExists('template_tags');
    }
};
