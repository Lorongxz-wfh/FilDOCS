<?php

namespace App\Policies;

use App\Models\User;
use App\Models\WorkflowTask;
use Illuminate\Auth\Access\Response;

class WorkflowTaskPolicy
{
    public function view(User $user, WorkflowTask $task)
    {
        if (!$user->office_id) {
            return Response::deny('Your account has no office assigned.');
        }

        // Allow viewing tasks assigned to your office (or unassigned tasks if you decide)
        if ($task->assigned_office_id && (int) $task->assigned_office_id !== (int) $user->office_id) {
            return Response::deny('Forbidden.');
        }

        return Response::allow();
    }

    public function act(User $user, WorkflowTask $task)
    {
        if (!$user->office_id) {
            return Response::deny('Your account has no office assigned.');
        }

        if ($task->status !== 'open') {
            return Response::deny('Task is not open.');
        }

        if (!$task->assigned_office_id) {
            return Response::deny('Task is not assigned to any office.');
        }

        if ((int) $task->assigned_office_id !== (int) $user->office_id) {
            return Response::deny('Not allowed for your office.');
        }

        // Office steps must be acted on by Office Head only
        if (in_array($task->step, ['office_review', 'office_approval'], true)) {
            $roleName = strtolower(trim((string) ($user->role?->name ?? '')));
            if ($roleName !== 'office_head') {
                return Response::deny('Only Office Head can act on this step.');
            }
        }


        // Optional stricter checks (you already have these columns)
        if ($task->assigned_role_id && (int) $task->assigned_role_id !== (int) $user->role_id) {
            return Response::deny('Not allowed for your role.');
        }

        if ($task->assigned_user_id && (int) $task->assigned_user_id !== (int) $user->id) {
            return Response::deny('Not allowed for your user.');
        }

        return Response::allow();
    }
}
