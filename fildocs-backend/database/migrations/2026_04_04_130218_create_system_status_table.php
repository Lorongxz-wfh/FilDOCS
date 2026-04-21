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
        Schema::create('system_status', function (Blueprint $table) {
            $table->id();
            $table->enum('maintenance_mode', ['off', 'soft', 'hard'])->default('off');
            $table->text('maintenance_message')->nullable();
            $table->timestamp('maintenance_expires_at')->nullable();
            $table->timestamp('last_disk_alert_at')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('system_status');
    }
};
