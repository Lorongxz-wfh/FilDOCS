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
        Schema::table('system_status', function (Blueprint $table) {
            $table->dateTime('maintenance_starts_at')->nullable()->after('maintenance_expires_at');
            $table->boolean('is_notified')->default(false)->after('maintenance_starts_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('system_status', function (Blueprint $table) {
            $table->dropColumn(['maintenance_starts_at', 'is_notified']);
        });
    }
};
