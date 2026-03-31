<?php
 
 namespace App\Events;
 
 use Illuminate\Broadcasting\InteractsWithSockets;
 use Illuminate\Broadcasting\PrivateChannel;
 use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
 use Illuminate\Foundation\Events\Dispatchable;
 use Illuminate\Queue\SerializesModels;
 
 class WorkflowUpdated implements ShouldBroadcastNow
 {
     use Dispatchable, InteractsWithSockets, SerializesModels;
 
     public function __construct(
         public readonly int $versionId,
         public readonly array $data = []
     ) {}
 
     public function broadcastOn(): array
     {
         return [new PrivateChannel("document.{$this->versionId}")];
     }
 
     public function broadcastAs(): string
     {
         return 'workflow.updated';
     }
 
     public function broadcastWith(): array
     {
         return $this->data;
     }
 }
