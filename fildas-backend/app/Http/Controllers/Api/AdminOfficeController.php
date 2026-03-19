<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Office;
use App\Traits\LogsActivityTrait;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AdminOfficeController extends Controller
{
    use LogsActivityTrait;

    // GET /api/admin/offices?q=&disabled=0|1
    public function index(Request $request)
    {
        $q = trim((string) $request->get('q', ''));
        // status: active (default) | disabled | all
        $status = $request->get('status', 'active');
        $type   = $request->get('type', '');

        $query = Office::query()
            ->with(['parentOffice:id,code,name'])
            ->orderBy('code')
            ->orderBy('name');

        if ($status === 'disabled') {
            $query->onlyTrashed();
        } elseif ($status === 'all') {
            $query->withTrashed();
        }

        if ($type !== '') {
            $query->where('type', $type);
        }

        if ($q !== '') {
            $query->where(function ($w) use ($q) {
                $w->where('name', 'like', "%{$q}%")
                    ->orWhere('code', 'like', "%{$q}%");
            });
        }

        $offices = $query->get([
            'id',
            'name',
            'code',
            'description',
            'type',
            'cluster_kind',
            'parent_office_id',
            'deleted_at',
            'created_at',
            'updated_at'
        ]);

        return response()->json($offices);
    }

    // POST /api/admin/offices
    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'code' => ['required', 'string', 'max:50', Rule::unique('offices', 'code')],
            'description' => ['nullable', 'string'],
            'type' => ['nullable', 'string', 'max:50'],
            'cluster_kind' => ['nullable', Rule::in(['vp', 'president'])],
            'parent_office_id' => ['nullable', 'integer', 'exists:offices,id'],
        ]);

        $code = strtoupper(trim($data['code']));
        $cluster = $data['cluster_kind'] ?? null;

        if ($cluster === 'president') {
            $exists = Office::query()->where('cluster_kind', 'president')->exists();
            if ($exists) {
                return response()->json(['message' => 'Only one President office is allowed.'], 422);
            }
        }

        $office = new Office();
        $office->fill([
            'name' => trim($data['name']),
            'code' => $code,
            'description' => $data['description'] ?? null,
            'type' => $data['type'] ?? 'office',
            'cluster_kind' => $cluster,
            'parent_office_id' => $data['parent_office_id'] ?? null,
        ]);
        $office->save();

        $office->load(['parentOffice:id,code,name']);

        $this->logActivity('office.created', 'Created an office',
            $request->user()->id, $request->user()->office_id,
            ['office_id' => $office->id, 'code' => $office->code, 'name' => $office->name]);

        return response()->json(['office' => $office], 201);
    }

    // PATCH /api/admin/offices/{office}
    public function update(Request $request, Office $office)
    {
        $data = $request->validate([
            'name' => ['nullable', 'string', 'max:255'],
            'code' => ['nullable', 'string', 'max:50', Rule::unique('offices', 'code')->ignore($office->id)],
            'description' => ['nullable', 'string'],
            'type' => ['nullable', 'string', 'max:50'],
            'cluster_kind' => ['nullable', Rule::in(['vp', 'president'])],
            'parent_office_id' => ['nullable', 'integer', 'exists:offices,id'],
        ]);

        if (array_key_exists('parent_office_id', $data) && (int)$data['parent_office_id'] === (int)$office->id) {
            return response()->json(['message' => 'An office cannot be its own parent.'], 422);
        }

        if (array_key_exists('cluster_kind', $data)) {
            $incoming = $data['cluster_kind'] ?? null;

            if ($incoming === 'president') {
                $existsOther = Office::query()
                    ->where('cluster_kind', 'president')
                    ->where('id', '!=', $office->id)
                    ->exists();

                if ($existsOther) {
                    return response()->json(['message' => 'Only one President office is allowed.'], 422);
                }
            }
        }

        $payload = [];

        if (array_key_exists('name', $data)) $payload['name'] = trim((string)$data['name']);
        if (array_key_exists('code', $data)) $payload['code'] = strtoupper(trim((string)$data['code']));
        if (array_key_exists('description', $data)) $payload['description'] = $data['description'];
        if (array_key_exists('type', $data)) $payload['type'] = $data['type'] ?? 'office';
        if (array_key_exists('cluster_kind', $data)) $payload['cluster_kind'] = $data['cluster_kind'];
        if (array_key_exists('parent_office_id', $data)) $payload['parent_office_id'] = $data['parent_office_id'];

        $office->fill($payload);
        $office->save();

        $office->load(['parentOffice:id,code,name']);

        $this->logActivity('office.updated', 'Updated an office',
            $request->user()->id, $request->user()->office_id,
            ['office_id' => $office->id, 'code' => $office->code, 'changed_fields' => array_keys($payload)]);

        return response()->json(['office' => $office]);
    }

    // DELETE /api/admin/offices/{office} (soft delete)
    public function destroy(Request $office_request, Office $office)
    {
        $this->logActivity('office.disabled', 'Disabled an office',
            $office_request->user()->id, $office_request->user()->office_id,
            ['office_id' => $office->id, 'code' => $office->code]);

        $office->delete();
        return response()->json(['message' => 'Office disabled.']);
    }

    // PATCH /api/admin/offices/{office}/restore
    public function restore(Request $request, $office)
    {
        $o = Office::withTrashed()->whereKey($office)->first();
        if (!$o) return response()->json(['message' => 'Office not found.'], 404);

        $o->restore();
        $o->load(['parentOffice:id,code,name']);

        $this->logActivity('office.restored', 'Restored a disabled office',
            $request->user()->id, $request->user()->office_id,
            ['office_id' => $o->id, 'code' => $o->code]);

        return response()->json(['office' => $o]);
    }
}
