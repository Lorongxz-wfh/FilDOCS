<?php

namespace App\Console\Commands\Admin;

use Illuminate\Console\Command;

class UnlockRestore extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'restore:unlock';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Command description';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $lockFile = storage_path('app/restoration.lock');
        $publicSignal = public_path('_restore_signal.json');
        $sharedSignal = storage_path('app/backups/_restore_signal.json');

        if (file_exists($lockFile)) @unlink($lockFile);
        if (file_exists($publicSignal)) @unlink($publicSignal);
        if (file_exists($sharedSignal)) @unlink($sharedSignal);

        $this->info('Restoration locks and signals cleared.');
    }
}
