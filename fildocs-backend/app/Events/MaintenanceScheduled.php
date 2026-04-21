<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class MaintenanceScheduled implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public string $startsAt,
        public string $message
    ) {}

    public function broadcastOn(): array
    {
        return [
            new Channel('system-status'),
        ];
    }

    public function broadcastAs(): string
    {
        return 'maintenance.scheduled';
    }
}
