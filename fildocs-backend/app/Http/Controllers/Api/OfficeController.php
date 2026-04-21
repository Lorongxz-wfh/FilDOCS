<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Office;

class OfficeController extends Controller
{
    public function index(\Illuminate\Http\Request $request)
    {
        $allowedSorts = ['name', 'code', 'type'];
        $sortBy  = in_array($request->query('sort_by'), $allowedSorts, true)
            ? $request->query('sort_by') : 'name';
        $sortDir = $request->query('sort_dir') === 'asc' ? 'asc' : 'desc';

        // Office list page uses pagination; simple list calls (dropdowns etc.) do not
        $perPage = (int) $request->query('per_page', 0);

        $query = Office::query()
            ->orderBy($sortBy, $sortDir);

        if ($perPage > 0) {
            return response()->json(
                $query->paginate($perPage, ['id', 'name', 'code', 'type'])
            );
        }

        return response()->json(
            $query->get(['id', 'name', 'code', 'type'])
        );
    }

    public function users(Office $office)
    {
        $users = \App\Models\User::query()
            ->where('office_id', $office->id)
            ->whereNull('disabled_at')
            ->whereNull('deleted_at')
            ->with('role')
            ->orderBy('last_name')
            ->get(['id', 'first_name', 'middle_name', 'last_name', 'suffix', 'profile_photo_path', 'role_id', 'office_id']);

        return response()->json($users);
    }
}
