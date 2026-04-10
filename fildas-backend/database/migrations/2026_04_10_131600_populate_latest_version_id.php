<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Populate latest_version_id for documents where it is currently null
        // We find the MAX(id) from document_versions for each document.
        DB::statement("
            UPDATE documents 
            SET latest_version_id = (
                SELECT id FROM document_versions 
                WHERE document_versions.document_id = documents.id 
                ORDER BY version_number DESC, id DESC 
                LIMIT 1
            )
            WHERE latest_version_id IS NULL
        ");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // No action needed for reversal as this is a data-only migration
        // that populates a column already existing.
    }
};
