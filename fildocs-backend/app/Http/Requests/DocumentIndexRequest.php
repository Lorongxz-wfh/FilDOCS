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
            'q' => 'nullable|string',
            'status' => 'nullable|string',
            'doctype' => 'nullable|string',
            
            // date range
            'date_from' => 'nullable|date',
            'date_to' => 'nullable|date',

            // pagination
            'page' => 'nullable|integer|min:1',
            'per_page' => 'nullable|integer|min:1|max:100',

            // legacy / optional
            'owner_office_id' => 'nullable|integer|exists:offices,id',
            'assigned_office_id' => 'nullable|integer|exists:offices,id',
            'office_id' => 'nullable|integer|exists:offices,id',

            // workflow / library filters
            'phase' => 'nullable|string',
            'version_number' => 'nullable|integer',
            'space' => 'nullable|string|in:all,workqueue,library,archive',
            'scope' => 'nullable|string|in:all,owned,shared,assigned,participant',

            // sorting
            'sort_by' => 'nullable|string|in:title,created_at,code,updated_at,distributed_at',
            'sort_dir' => 'nullable|string|in:asc,desc',
        ];
    }
}
