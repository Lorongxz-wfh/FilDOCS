<?php
 
 namespace App\Events;
 
 use Illuminate\Broadcasting\InteractsWithSockets;
 use Illuminate\Broadcasting\PrivateChannel;
 use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
 use Illuminate\Foundation\Events\Dispatchable;
 use Illuminate\Queue\SerializesModels;
 
 class WorkspaceChanged implements ShouldBroadcastNow
 {
     use Dispatchable, InteractsWithSockets, SerializesModels;
 
     public function __construct(
         public readonly string $source = 'system'
     ) {}
 
     public function broadcastOn(): array
     {
         return [new PrivateChannel('workspace')];
     }
 
     public function broadcastAs(): string
     {
         return 'workspace.changed';
     }
 
     public function broadcastWith(): array
     {
         return ['source' => $this->source];
     }
 }
