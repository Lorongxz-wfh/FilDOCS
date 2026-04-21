<?php

namespace App\Console\Commands;

use App\Models\DocumentTemplate;
use App\Services\ThumbnailService;
use Illuminate\Console\Command;

class BackfillTemplateThumbnails extends Command
{
    protected $signature = 'templates:backfill-thumbnails';
    protected $description = 'Generate thumbnails for templates that are missing one';

    public function handle(ThumbnailService $thumbnailService): void
    {
        $templates = DocumentTemplate::whereNull('thumbnail_path')->get();

        if ($templates->isEmpty()) {
            $this->info('No templates need backfilling.');
            return;
        }

        $this->info("Found {$templates->count()} template(s) to process...");

        foreach ($templates as $template) {
            $this->line("Processing: {$template->name} (ID {$template->id})");

            $thumb = $thumbnailService->generateForTemplate(
                $template->file_path,
                $template->mime_type
            );

            if ($thumb) {
                $template->thumbnail_path = $thumb;
                $template->save();
                $this->info("  ✓ Thumbnail: {$thumb}");
            } else {
                $this->warn("  ✗ Failed to generate thumbnail.");
            }
        }

        $this->info('Done.');
    }
}
