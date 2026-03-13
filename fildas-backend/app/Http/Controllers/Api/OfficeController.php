<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Office;

class OfficeController extends Controller
{
    public function index()
    {
        $offices = Office::query()
            ->orderBy('name')
            ->get(['id', 'name', 'code', 'type']);

        return response()->json($offices);
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
