<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;

class ArchiveExpiredDocuments extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'app:archive-expired-documents';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Automatically archive distributed documents that have passed their retention date.';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $this->info('Starting auto-archive process for expired documents...');

        $expiredVersions = \App\Models\DocumentVersion::query()
            ->where('status', 'Distributed')
            ->whereNotNull('retention_date')
            ->where('retention_date', '<=', now()->toDateString())
            ->whereNull('superseded_at')
            ->whereNull('cancelled_at')
            ->with('document')
            ->get();

        $count = 0;
        foreach ($expiredVersions as $version) {
            $doc = $version->document;

            if ($doc && !$doc->archived_at) {
                $doc->archived_at = now();
                $doc->save();

                // Log the activity
                $logService = new class {
                    use \App\Traits\LogsActivityTrait;
                };
                $logService->logActivity(
                    'document.auto_archived',
                    'Document archived automatically due to retention expiry',
                    null, // System action
                    $doc->owner_office_id,
                    ['retention_date' => $version->retention_date->toDateString()],
                    $doc->id,
                    $version->id
                );

                $count++;
                $this->line("Archived: [{$doc->id}] {$doc->title} (Expired on {$version->retention_date->toDateString()})");
            }
        }

        $this->info("Finished. Total documents archived: {$count}");
    }
}
