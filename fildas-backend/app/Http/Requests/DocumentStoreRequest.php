<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class DocumentStoreRequest extends FormRequest
{
    public function authorize(): bool
    {
        // Auth is already enforced by auth:sanctum route middleware.
        return true;
    }

    public function rules(): array
    {
        $roleName = $this->user()?->role?->name ? strtolower(trim($this->user()->role->name)) : null;

        return [
            'title' => 'required|string|max:255',
            'doctype' => 'required|string|max:50',

            // Starter flow selector (frontend sends this)
            'workflow_type' => 'nullable|in:qa,office',

            // Routing mode (NEW)
            'routing_mode' => 'nullable|in:default,custom',

            // Custom routing offices (NEW) - ordered, 1..5 items
            // Required only when routing_mode=custom
            'custom_review_office_ids' => 'required_if:routing_mode,custom|array|min:1|max:5',
            'custom_review_office_ids.*' => 'required|integer|distinct|exists:offices,id',

            // Default routing: QA must choose a review office
            'review_office_id' => ($roleName === 'qa')
                ? 'required_if:routing_mode,default|integer|exists:offices,id'
                : 'nullable|integer|exists:offices,id',


            // Admin-only: create on behalf of an office
            'acting_as_office_id' => 'nullable|integer|exists:offices,id',

            'visibility_scope' => 'sometimes|in:office,global',
            'school_year' => 'nullable|string|max:20',
            'semester' => 'nullable|string|max:20',
            'description' => 'nullable|string',
            'effective_date' => 'nullable|date',
            'retention_date' => 'nullable|date|after_or_equal:today',
            'file' => 'nullable|file|mimes:pdf,doc,docx,xls,xlsx,ppt,pptx|max:10240',
        ];
    }

    public function messages(): array
    {
        return [
            'routing_mode.in' => 'Routing mode must be Default or Custom.',
            'custom_review_office_ids.required_if' => 'Please add at least 1 recipient office for Custom flow.',
            'custom_review_office_ids.array' => 'Recipient offices must be a list.',
            'custom_review_office_ids.min' => 'Please add at least 1 recipient office for Custom flow.',
            'custom_review_office_ids.max' => 'Custom flow can only have up to 5 recipient offices.',
            'custom_review_office_ids.*.distinct' => 'Recipient offices must not contain duplicates.',
            'custom_review_office_ids.*.exists' => 'One of the selected recipient offices is invalid.',
            'review_office_id.required_if' => 'Please select a reviewer office for Default QA flow.',
        ];
    }

    /**
     * Optional: normalize inputs so controller gets consistent values.
     */
    protected function prepareForValidation(): void
    {
        if ($this->has('routing_mode')) {
            $this->merge([
                'routing_mode' => strtolower(trim((string) $this->input('routing_mode'))),
            ]);
        }

        if ($this->has('workflow_type')) {
            $this->merge([
                'workflow_type' => strtolower(trim((string) $this->input('workflow_type'))),
            ]);
        }
    }
}
