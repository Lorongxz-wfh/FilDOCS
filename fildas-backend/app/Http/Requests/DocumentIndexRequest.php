<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class DocumentIndexRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'per_page' => 'nullable|integer|min:1|max:100',

            // filters
            'q' => 'nullable|string|max:100',
            'status' => 'nullable|string|max:50',
            'doctype' => 'nullable|string|max:50',
            'visibility_scope' => 'nullable|in:office,global',

            // frontend filter
            'scope' => 'nullable|in:all,owned,shared,assigned',

            // date range filter
            'date_from' => 'nullable|date_format:Y-m-d',
            'date_to'   => 'nullable|date_format:Y-m-d',

            // legacy / optional
            'owner_office_id' => 'nullable|integer|exists:offices,id',
            'office_id' => 'nullable|integer|exists:offices,id',
        ];
    }
}
