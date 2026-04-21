<?php

namespace App\Console\Commands;

use App\Models\DocumentTemplate;
use App\Services\ThumbnailService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;

class FixTemplateThumbnails extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'templates:fix-thumbnails {--force : Force regenerate even if thumbnail exists}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Regenerate missing or broken template thumbnails in cloud storage';

    /**
     * Execute the console command.
     */
    public function handle(ThumbnailService $thumbnailService)
    {
        $templates = DocumentTemplate::all();
        $count = $templates->count();
        $this->info("Scanning {$count} templates...");

        $diskName = config('filesystems.default');
        $disk = Storage::disk($diskName);
        $fixed = 0;
        $failed = 0;
        $skipped = 0;

        foreach ($templates as $t) {
            $hasThumbnail = $t->thumbnail_path && $disk->exists($t->thumbnail_path);
            $force = $this->option('force');

            if ($hasThumbnail && !$force) {
                $skipped++;
                continue;
            }

            $this->comment("Processing: {$t->name}...");

            if (!$t->file_path || !$disk->exists($t->file_path)) {
                $this->error("  Original file missing: {$t->file_path}");
                $failed++;
                continue;
            }

            try {
                $newPath = $thumbnailService->generateForTemplate($t->file_path, $t->mime_type, $diskName);
                if ($newPath) {
                    $t->thumbnail_path = $newPath;
                    $t->save();
                    $this->info("  Success: {$newPath}");
                    $fixed++;
                } else {
                    $this->error("  Failed to generate thumbnail.");
                    $failed++;
                }
            } catch (\Throwable $e) {
                $this->error("  Error: " . $e->getMessage());
                $failed++;
            }
        }

        $this->newLine();
        $this->info("Repair Completed!");
        $this->info("Fixed: {$fixed}");
        $this->info("Skipped: {$skipped}");
        $this->info("Failed: {$failed}");
        
        return Command::SUCCESS;
    }
}
