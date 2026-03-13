<?php

namespace App\Services;

final class WorkflowSteps
{
    // ── Phases ─────────────────────────────────────────────────────────────
    const PHASE_DRAFT        = 'draft';
    const PHASE_REVIEW       = 'review';
    const PHASE_APPROVAL     = 'approval';
    const PHASE_FINALIZATION = 'finalization';
    const PHASE_REGISTRATION = 'registration'; // kept for DB compat, maps to finalization

    // ── Shared Statuses ────────────────────────────────────────────────────
    const STATUS_DRAFT       = 'Draft';
    const STATUS_DISTRIBUTED = 'Distributed';
    const STATUS_CANCELLED   = 'Cancelled';

    // ── QA Flow Statuses ───────────────────────────────────────────────────
    const STATUS_QA_OFFICE_REVIEW       = 'For Office Review';
    const STATUS_QA_VP_REVIEW           = 'For VP Review';
    const STATUS_QA_REVIEW_FINAL_CHECK  = 'For QA Review Check';
    const STATUS_QA_OFFICE_APPROVAL     = 'For Office Approval';
    const STATUS_QA_VP_APPROVAL         = 'For VP Approval';
    const STATUS_QA_PRES_APPROVAL       = "For President's Approval";
    const STATUS_QA_APPROVAL_FINAL_CHECK = 'For QA Approval Check';
    const STATUS_QA_REGISTRATION        = 'For Registration';
    const STATUS_QA_DISTRIBUTION        = 'For Distribution';

    // ── Office Flow Statuses ───────────────────────────────────────────────
    const STATUS_OFFICE_DRAFT                = 'Office Draft';
    const STATUS_OFFICE_HEAD_REVIEW          = 'For Office Head Review';
    const STATUS_OFFICE_VP_REVIEW            = 'For VP Review';
    const STATUS_OFFICE_REVIEW_FINAL_CHECK   = 'For Staff Review Check';
    const STATUS_OFFICE_HEAD_APPROVAL        = 'For Office Head Approval';
    const STATUS_OFFICE_VP_APPROVAL          = 'For VP Approval';
    const STATUS_OFFICE_PRES_APPROVAL        = "For President's Approval";
    const STATUS_OFFICE_APPROVAL_FINAL_CHECK = 'For Staff Approval Check';
    const STATUS_OFFICE_REGISTRATION         = 'For Registration';
    const STATUS_OFFICE_DISTRIBUTION         = 'For Distribution';

    // ── Custom Flow Statuses ───────────────────────────────────────────────
    const STATUS_CUSTOM_OFFICE_REVIEW          = 'For Office Review';
    const STATUS_CUSTOM_REVIEW_BACK_TO_OWNER   = 'For Owner Review Check';
    const STATUS_CUSTOM_OFFICE_APPROVAL        = 'For Office Approval';
    const STATUS_CUSTOM_APPROVAL_BACK_TO_OWNER = 'For Owner Approval Check';
    const STATUS_CUSTOM_REGISTRATION           = 'For Registration';
    const STATUS_CUSTOM_DISTRIBUTION           = 'For Distribution';

    // ── QA Flow Steps ──────────────────────────────────────────────────────
    const STEP_QA_DRAFT                = 'draft';
    const STEP_QA_OFFICE_REVIEW        = 'qa_office_review';
    const STEP_QA_VP_REVIEW            = 'qa_vp_review';
    const STEP_QA_REVIEW_FINAL_CHECK   = 'qa_review_final_check';
    const STEP_QA_OFFICE_APPROVAL      = 'qa_office_approval';
    const STEP_QA_VP_APPROVAL          = 'qa_vp_approval';
    const STEP_QA_PRES_APPROVAL        = 'qa_pres_approval';
    const STEP_QA_APPROVAL_FINAL_CHECK = 'qa_approval_final_check';
    const STEP_QA_REGISTRATION         = 'qa_registration';
    const STEP_QA_DISTRIBUTION         = 'qa_distribution';

    // ── Office Flow Steps ──────────────────────────────────────────────────
    const STEP_OFFICE_DRAFT                = 'office_draft';
    const STEP_OFFICE_HEAD_REVIEW          = 'office_head_review';
    const STEP_OFFICE_VP_REVIEW            = 'office_vp_review';
    const STEP_OFFICE_REVIEW_FINAL_CHECK   = 'office_review_final_check';
    const STEP_OFFICE_HEAD_APPROVAL        = 'office_head_approval';
    const STEP_OFFICE_VP_APPROVAL          = 'office_vp_approval';
    const STEP_OFFICE_PRES_APPROVAL        = 'office_pres_approval';
    const STEP_OFFICE_APPROVAL_FINAL_CHECK = 'office_approval_final_check';
    const STEP_OFFICE_REGISTRATION         = 'office_registration';
    const STEP_OFFICE_DISTRIBUTION         = 'office_distribution';

    // ── Custom Flow Steps ──────────────────────────────────────────────────
    const STEP_CUSTOM_DRAFT                    = 'draft';
    const STEP_CUSTOM_OFFICE_REVIEW            = 'custom_office_review';
    const STEP_CUSTOM_REVIEW_BACK_TO_OWNER     = 'custom_review_back_to_owner';
    const STEP_CUSTOM_OFFICE_APPROVAL          = 'custom_office_approval';
    const STEP_CUSTOM_APPROVAL_BACK_TO_OWNER   = 'custom_approval_back_to_owner';
    const STEP_CUSTOM_REGISTRATION             = 'custom_registration';
    const STEP_CUSTOM_DISTRIBUTION             = 'custom_distribution';

    // ── Shared Steps ───────────────────────────────────────────────────────
    const STEP_DISTRIBUTED = 'distributed';

    // ── Actions ────────────────────────────────────────────────────────────

    // Universal
    const ACTION_REJECT          = 'REJECT';
    const ACTION_CANCEL_DOCUMENT = 'CANCEL_DOCUMENT';

    // QA flow
    const ACTION_QA_SEND_TO_OFFICE_REVIEW       = 'QA_SEND_TO_OFFICE_REVIEW';
    const ACTION_QA_OFFICE_FORWARD_TO_VP        = 'QA_OFFICE_FORWARD_TO_VP';
    const ACTION_QA_OFFICE_RETURN_TO_QA         = 'QA_OFFICE_RETURN_TO_QA';
    const ACTION_QA_VP_SEND_BACK_TO_QA          = 'QA_VP_SEND_BACK_TO_QA';
    const ACTION_QA_START_OFFICE_APPROVAL       = 'QA_START_OFFICE_APPROVAL';
    const ACTION_QA_OFFICE_FORWARD_TO_VP_APPR   = 'QA_OFFICE_FORWARD_TO_VP_APPROVAL';
    const ACTION_QA_VP_FORWARD_TO_PRESIDENT     = 'QA_VP_FORWARD_TO_PRESIDENT';
    const ACTION_QA_PRESIDENT_APPROVE           = 'QA_PRESIDENT_APPROVE';
    const ACTION_QA_START_FINALIZATION          = 'QA_START_FINALIZATION';
    const ACTION_QA_REGISTER                    = 'QA_REGISTER';
    const ACTION_QA_DISTRIBUTE                  = 'QA_DISTRIBUTE';

    // Office flow
    const ACTION_OFFICE_SEND_TO_HEAD              = 'OFFICE_SEND_TO_HEAD';
    const ACTION_OFFICE_HEAD_FORWARD_TO_VP        = 'OFFICE_HEAD_FORWARD_TO_VP';
    const ACTION_OFFICE_HEAD_RETURN_TO_STAFF      = 'OFFICE_HEAD_RETURN_TO_STAFF';
    const ACTION_OFFICE_VP_SEND_BACK_TO_STAFF     = 'OFFICE_VP_SEND_BACK_TO_STAFF';
    const ACTION_OFFICE_START_APPROVAL            = 'OFFICE_START_APPROVAL';
    const ACTION_OFFICE_HEAD_FORWARD_TO_VP_APPR   = 'OFFICE_HEAD_FORWARD_TO_VP_APPROVAL';
    const ACTION_OFFICE_VP_FORWARD_TO_PRESIDENT   = 'OFFICE_VP_FORWARD_TO_PRESIDENT';
    const ACTION_OFFICE_PRESIDENT_APPROVE         = 'OFFICE_PRESIDENT_APPROVE';
    const ACTION_OFFICE_START_FINALIZATION        = 'OFFICE_START_FINALIZATION';
    const ACTION_OFFICE_REGISTER                  = 'OFFICE_REGISTER';
    const ACTION_OFFICE_DISTRIBUTE                = 'OFFICE_DISTRIBUTE';

    // Custom flow
    const ACTION_CUSTOM_FORWARD            = 'CUSTOM_FORWARD';
    const ACTION_CUSTOM_START_APPROVAL     = 'CUSTOM_START_APPROVAL';
    const ACTION_CUSTOM_START_FINALIZATION = 'CUSTOM_START_FINALIZATION';
    const ACTION_CUSTOM_REGISTER           = 'CUSTOM_REGISTER';
    const ACTION_CUSTOM_DISTRIBUTE         = 'CUSTOM_DISTRIBUTE';

    // ── Helpers ────────────────────────────────────────────────────────────

    public static function phaseForStep(string $step): string
    {
        return match ($step) {
            // Draft
            self::STEP_QA_DRAFT,
            self::STEP_OFFICE_DRAFT,
            self::STEP_CUSTOM_DRAFT                  => self::PHASE_DRAFT,

            // Review
            self::STEP_QA_OFFICE_REVIEW,
            self::STEP_QA_VP_REVIEW,
            self::STEP_QA_REVIEW_FINAL_CHECK,
            self::STEP_OFFICE_HEAD_REVIEW,
            self::STEP_OFFICE_VP_REVIEW,
            self::STEP_OFFICE_REVIEW_FINAL_CHECK,
            self::STEP_CUSTOM_OFFICE_REVIEW,
            self::STEP_CUSTOM_REVIEW_BACK_TO_OWNER   => self::PHASE_REVIEW,

            // Approval
            self::STEP_QA_OFFICE_APPROVAL,
            self::STEP_QA_VP_APPROVAL,
            self::STEP_QA_PRES_APPROVAL,
            self::STEP_QA_APPROVAL_FINAL_CHECK,
            self::STEP_OFFICE_HEAD_APPROVAL,
            self::STEP_OFFICE_VP_APPROVAL,
            self::STEP_OFFICE_PRES_APPROVAL,
            self::STEP_OFFICE_APPROVAL_FINAL_CHECK,
            self::STEP_CUSTOM_OFFICE_APPROVAL,
            self::STEP_CUSTOM_APPROVAL_BACK_TO_OWNER => self::PHASE_APPROVAL,

            // Finalization
            self::STEP_QA_REGISTRATION,
            self::STEP_QA_DISTRIBUTION,
            self::STEP_OFFICE_REGISTRATION,
            self::STEP_OFFICE_DISTRIBUTION,
            self::STEP_CUSTOM_REGISTRATION,
            self::STEP_CUSTOM_DISTRIBUTION,
            self::STEP_DISTRIBUTED                   => self::PHASE_FINALIZATION,

            default => self::PHASE_REVIEW,
        };
    }

    public static function statusForStep(string $flow, string $step, ?string $officeCode = null): string
    {
        if ($flow === 'custom') {
            return match ($step) {
                self::STEP_CUSTOM_DRAFT                    => self::STATUS_DRAFT,
                self::STEP_CUSTOM_OFFICE_REVIEW            => $officeCode ? "For {$officeCode} Review" : self::STATUS_CUSTOM_OFFICE_REVIEW,
                self::STEP_CUSTOM_REVIEW_BACK_TO_OWNER     => self::STATUS_CUSTOM_REVIEW_BACK_TO_OWNER,
                self::STEP_CUSTOM_OFFICE_APPROVAL          => $officeCode ? "For {$officeCode} Approval" : self::STATUS_CUSTOM_OFFICE_APPROVAL,
                self::STEP_CUSTOM_APPROVAL_BACK_TO_OWNER   => self::STATUS_CUSTOM_APPROVAL_BACK_TO_OWNER,
                self::STEP_CUSTOM_REGISTRATION             => self::STATUS_CUSTOM_REGISTRATION,
                self::STEP_CUSTOM_DISTRIBUTION             => self::STATUS_CUSTOM_DISTRIBUTION,
                self::STEP_DISTRIBUTED                     => self::STATUS_DISTRIBUTED,
                default                                    => self::STATUS_DRAFT,
            };
        }

        if ($flow === 'office') {
            return match ($step) {
                self::STEP_OFFICE_DRAFT                => self::STATUS_OFFICE_DRAFT,
                self::STEP_OFFICE_HEAD_REVIEW          => self::STATUS_OFFICE_HEAD_REVIEW,
                self::STEP_OFFICE_VP_REVIEW            => self::STATUS_OFFICE_VP_REVIEW,
                self::STEP_OFFICE_REVIEW_FINAL_CHECK   => self::STATUS_OFFICE_REVIEW_FINAL_CHECK,
                self::STEP_OFFICE_HEAD_APPROVAL        => self::STATUS_OFFICE_HEAD_APPROVAL,
                self::STEP_OFFICE_VP_APPROVAL          => self::STATUS_OFFICE_VP_APPROVAL,
                self::STEP_OFFICE_PRES_APPROVAL        => self::STATUS_OFFICE_PRES_APPROVAL,
                self::STEP_OFFICE_APPROVAL_FINAL_CHECK => self::STATUS_OFFICE_APPROVAL_FINAL_CHECK,
                self::STEP_OFFICE_REGISTRATION         => self::STATUS_OFFICE_REGISTRATION,
                self::STEP_OFFICE_DISTRIBUTION         => self::STATUS_OFFICE_DISTRIBUTION,
                self::STEP_DISTRIBUTED                 => self::STATUS_DISTRIBUTED,
                default                                => self::STATUS_OFFICE_DRAFT,
            };
        }

        // QA flow (default)
        return match ($step) {
            self::STEP_QA_DRAFT                => self::STATUS_DRAFT,
            self::STEP_QA_OFFICE_REVIEW        => self::STATUS_QA_OFFICE_REVIEW,
            self::STEP_QA_VP_REVIEW            => self::STATUS_QA_VP_REVIEW,
            self::STEP_QA_REVIEW_FINAL_CHECK   => self::STATUS_QA_REVIEW_FINAL_CHECK,
            self::STEP_QA_OFFICE_APPROVAL      => self::STATUS_QA_OFFICE_APPROVAL,
            self::STEP_QA_VP_APPROVAL          => self::STATUS_QA_VP_APPROVAL,
            self::STEP_QA_PRES_APPROVAL        => self::STATUS_QA_PRES_APPROVAL,
            self::STEP_QA_APPROVAL_FINAL_CHECK => self::STATUS_QA_APPROVAL_FINAL_CHECK,
            self::STEP_QA_REGISTRATION         => self::STATUS_QA_REGISTRATION,
            self::STEP_QA_DISTRIBUTION         => self::STATUS_QA_DISTRIBUTION,
            self::STEP_DISTRIBUTED             => self::STATUS_DISTRIBUTED,
            default                            => self::STATUS_DRAFT,
        };
    }

    /** Draft steps — cancel not allowed here (use Delete Draft instead) */
    public static function isDraftStep(string $step): bool
    {
        return in_array($step, [
            self::STEP_QA_DRAFT,
            self::STEP_OFFICE_DRAFT,
            self::STEP_CUSTOM_DRAFT,
        ], true);
    }

    /** Finalization steps — cancel not allowed */
    public static function isFinalizationStep(string $step): bool
    {
        return in_array($step, [
            self::STEP_QA_REGISTRATION,
            self::STEP_QA_DISTRIBUTION,
            self::STEP_OFFICE_REGISTRATION,
            self::STEP_OFFICE_DISTRIBUTION,
            self::STEP_CUSTOM_REGISTRATION,
            self::STEP_CUSTOM_DISTRIBUTION,
            self::STEP_DISTRIBUTED,
        ], true);
    }
}
