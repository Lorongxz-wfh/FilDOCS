<?php

namespace Database\Factories;

use App\Models\DocumentVersion;
use App\Models\Office;
use App\Models\WorkflowTask;
use Illuminate\Database\Eloquent\Factories\Factory;

class WorkflowTaskFactory extends Factory
{
    protected $model = WorkflowTask::class;

    public function definition(): array
    {
        return [
            'document_version_id' => DocumentVersion::factory(),
            'assigned_office_id'  => Office::factory(),
            'phase'               => 'review',
            'step'                => 'qa_office_review',
            'status'              => 'open',
            'opened_at'           => now(),
        ];
    }
}
