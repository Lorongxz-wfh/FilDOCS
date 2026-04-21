<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\Office;
use App\Models\Document;
use App\Models\DocumentRequest;
use App\Models\DocumentTemplate;
use App\Traits\LogsActivityTrait;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use PragmaRX\Google2FA\Google2FA;

class TrashController extends Controller
{
    use LogsActivityTrait;

    protected $modelMap = [
        'users'     => User::class,
        'offices'   => Office::class,
        'templates' => DocumentTemplate::class,
        'requests'  => DocumentRequest::class,
        'documents' => Document::class,
    ];

    /**
     * List soft-deleted items by type.
     */
    public function index(Request $request, $type)
    {
        if (!isset($this->modelMap[$type])) {
            return response()->json(['message' => 'Invalid trash type.'], 400);
        }

        $modelClass = $this->modelMap[$type];
        $query = $modelClass::onlyTrashed();

        // Basic search if applicable
        if ($request->filled('q')) {
            $q = $request->q;
            if ($type === 'users') {
                $query->where(function($sq) use ($q) {
                    $sq->where('first_name', 'like', "%$q%")
                       ->orWhere('last_name', 'like', "%$q%")
                       ->orWhere('email', 'like', "%$q%");
                });
            } elseif ($type === 'offices') {
                $query->where('name', 'like', "%$q%")->orWhere('code', 'like', "%$q%");
            } else {
                $query->where('title', 'like', "%$q%");
            }
        }

        $items = $query->orderBy('deleted_at', 'desc')->paginate(15);

        return response()->json($items);
    }

    /**
     * Verify password and 2FA for high-impact actions.
     */
    public function verify(Request $request)
    {
        $request->validate([
            'password' => 'required|string',
            'code'     => 'nullable|string', // 2FA code
        ]);

        $user = $request->user();

        if (!Hash::check($request->password, $user->password)) {
            return response()->json(['message' => 'Incorrect password.'], 422);
        }

        if ($user->two_factor_confirmed_at) {
            if (!$request->code) {
                return response()->json(['message' => '2FA code required.'], 422);
            }
            $google2fa = new Google2FA();
            if (!$google2fa->verifyKey($user->two_factor_secret, $request->code)) {
                return response()->json(['message' => 'Invalid 2FA code.'], 422);
            }
        }

        // Return a short-lived success indicator or just 200
        return response()->json(['message' => 'Security verified.']);
    }

    /**
     * Restore a soft-deleted item.
     */
    public function restore(Request $request, $type, $id)
    {
        // Require security verification
        $vResponse = $this->verify($request);
        if ($vResponse->getStatusCode() !== 200) return $vResponse;

        if (!isset($this->modelMap[$type])) {
            return response()->json(['message' => 'Invalid trash type.'], 400);
        }

        $item = $this->modelMap[$type]::onlyTrashed()->find($id);

        if (!$item) {
            return response()->json(['message' => 'Item not found or already restored.'], 404);
        }

        $item->restore();

        $this->logActivity("admin.trash.restore", "Restored $type: " . ($item->name ?? $item->title ?? $id), $id, null, ['type' => $type]);

        return response()->json(['message' => 'Item restored successfully.']);
    }

    /**
     * Permanently delete a soft-deleted item.
     */
    public function purge(Request $request, $type, $id)
    {
        // Require security verification
        $vResponse = $this->verify($request);
        if ($vResponse->getStatusCode() !== 200) return $vResponse;

        if (!isset($this->modelMap[$type])) {
            return response()->json(['message' => 'Invalid trash type.'], 400);
        }

        $item = $this->modelMap[$type]::onlyTrashed()->find($id);

        if (!$item) {
            return response()->json(['message' => 'Item not found in trash.'], 404);
        }

        $name = $item->name ?? $item->title ?? $id;
        $item->forceDelete();

        $this->logActivity("admin.trash.purge", "Permanently deleted $type: $name", $id, null, ['type' => $type]);

        return response()->json(['message' => 'Item permanently deleted.']);
    }
}
