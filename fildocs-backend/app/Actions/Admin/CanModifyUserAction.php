<?php

namespace App\Actions\Admin;

use App\Models\User;
use App\Models\WorkflowTask;

class CanModifyUserAction
{
    public function assertCanDisableOrDelete(User $actor, User $target): void
    {
        if ($actor->id === $target->id) {
            abort(422, 'You cannot disable or delete your own account.');
        }

        $hasOpenTasks = WorkflowTask::query()
            ->where('assigned_user_id', $target->id)
            ->where('status', 'open')
            ->exists();

        if ($hasOpenTasks) {
            abort(422, 'User has open workflow tasks. Finish/reassign tasks first.');
        }
    }
}
