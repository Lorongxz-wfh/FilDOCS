<?php

namespace App\Policies;

use App\Models\DocumentTemplate;
use App\Models\User;

class DocumentTemplatePolicy
{
    // ── View ─────────────────────────────────────────────────

    /**
     * Any authenticated user can list templates.
     * Filtering by office is handled in the controller query, not here.
     */
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, DocumentTemplate $template): bool
    {
        return $this->canSee($user, $template);
    }

    // ── Create ───────────────────────────────────────────────

    public function create(User $user): bool
    {
        return true; // all authenticated users can upload
    }

    // ── Delete ───────────────────────────────────────────────

    /**
     * Admin  → can delete any template.
     * Others → can only delete their own uploads.
     */
    public function delete(User $user, DocumentTemplate $template): bool
    {
        if ($this->isAdmin($user)) {
            return true;
        }

        return $template->uploaded_by === $user->id;
    }

    // ── Download ─────────────────────────────────────────────

    public function download(User $user, DocumentTemplate $template): bool
    {
        return $this->canSee($user, $template);
    }

    // ── Private helpers ──────────────────────────────────────

    /**
     * A user can see a template if:
     *   - they are Admin/SysAdmin/QA (Management), OR
     *   - it is global (office_id = null), OR
     *   - it belongs to the user's own office, OR
     *   - it is shared as an example in a document request they can access
     */
    private function canSee(User $user, DocumentTemplate $template): bool
    {
        // 1. Management can see all templates (read-only by default)
        if ($this->isManagement($user)) {
            return true;
        }

        // 2. Global templates are for everyone
        if ($template->isGlobal()) {
            return true;
        }

        // 3. User's own office
        if ((int) $template->office_id === (int) $user->office_id) {
            return true;
        }

        // 4. Shared context: Is this template used as an example in a request 
        // that the current user is authorized to view?
        return \Illuminate\Support\Facades\DB::table('document_requests as dr')
            ->leftJoin('document_request_recipients as r', 'r.request_id', '=', 'dr.id')
            ->leftJoin('document_request_items as di', 'di.request_id', '=', 'dr.id')
            ->where(function ($query) use ($template) {
                $query->where('dr.template_id', $template->id)
                      ->orWhere('di.template_id', $template->id);
            })
            ->where(function ($query) use ($user) {
                // User is creator OR their office is a recipient
                $query->where('dr.created_by_user_id', $user->id)
                      ->orWhere('r.office_id', (int) ($user->office_id ?? 0));
            })
            ->exists();
    }

    private function isManagement(User $user): bool
    {
        $role = strtolower((string) ($user->role?->name ?? $user->role ?? ''));
        return in_array($role, ['admin', 'sysadmin', 'qa'], true);
    }

    private function isAdmin(User $user): bool
    {
        $role = strtolower((string) ($user->role?->name ?? $user->role ?? ''));
        return $role === 'admin';
    }
}
