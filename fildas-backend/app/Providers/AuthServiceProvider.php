<?php

namespace App\Providers;

use App\Models\WorkflowTask;
use App\Policies\WorkflowTaskPolicy;

use App\Models\DocumentVersion;
use App\Policies\DocumentVersionPolicy;
use Illuminate\Foundation\Support\Providers\AuthServiceProvider as ServiceProvider;
use Illuminate\Support\Facades\Log;



class AuthServiceProvider extends ServiceProvider
{
    protected $policies = [
        WorkflowTask::class => WorkflowTaskPolicy::class,
        DocumentVersion::class => DocumentVersionPolicy::class,
        \App\Models\DocumentTemplate::class => \App\Policies\DocumentTemplatePolicy::class,
    ];

    public function boot(): void
    {
        $this->registerPolicies();
    }
}
