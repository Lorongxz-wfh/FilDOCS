<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Mail\WorkflowNotificationMail;
use App\Models\ActivityLog;
use App\Models\DocumentRequest;
use App\Models\DocumentRequestItem;
use App\Models\Notification;
use App\Models\User;
use App\Services\DocumentRequests\DocumentRequestFileService;
use App\Services\DocumentRequests\DocumentRequestProgressService;
use App\Services\DocumentRequests\DocumentRequestService;
use App\Repositories\DocumentRequestRepository;
use App\Traits\RoleNameTrait;
use App\Traits\LogsActivityTrait;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;

class DocumentRequestController extends Controller
{
    use RoleNameTrait, LogsActivityTrait;

    public function __construct(
        private DocumentRequestFileService $files,
        private DocumentRequestProgressService $progress,
        private DocumentRequestService $service,
        private DocumentRequestRepository $repository,
    ) {}

    // ── GET /api/document-requests/stats ───────────────────────────────────
    public function stats(Request $request)
    {
        $user     = $request->user();
        $role     = $this->roleName($request);
        $isQa     = $this->isQaOrAdmin($role);
        $officeId = (int) ($user?->office_id ?? 0);

        $params = $request->validate([
            'date_from' => 'nullable|date',
            'date_to'   => 'nullable|date',
        ]);

        if (!$isQa && $officeId <= 0) {
            return response()->json(['message' => 'Your account has no office assigned.'], 422);
        }

        // Active Requests: All requests where I am the creator OR a recipient (open status)
        $activeQuery = DB::table('document_requests as r')
            ->where('r.status', 'open');

        if (!empty($params['date_from'])) $activeQuery->whereDate('r.created_at', '>=', $params['date_from']);
        if (!empty($params['date_to']))   $activeQuery->whereDate('r.created_at', '<=', $params['date_to']);

        if (!$isQa) {
            $activeQuery->where(function ($q) use ($user, $officeId) {
                // If I created it, it stays active until the batch is closed/cancelled
                $q->where('r.created_by_user_id', $user->id)
                  // If I received it, it stays active only if I haven't finished it yet
                  ->orWhereExists(function ($sub) use ($officeId) {
                      $sub->select(DB::raw(1))
                          ->from('document_request_recipients as rr')
                          ->whereColumn('rr.request_id', 'r.id')
                          ->where('rr.office_id', $officeId)
                          ->whereNotIn('rr.status', ['accepted', 'cancelled']);
                  });
            });
        }

        $activeCount = $activeQuery->count();

        // Action Required:
        // 1. Incoming: My office is a recipient and status is pending or rejected
        $incomingAction = 0;
        if ($officeId > 0) {
            $incomingActionQuery = DB::table('document_request_recipients as rr')
                ->join('document_requests as r', 'r.id', '=', 'rr.request_id')
                ->where('r.status', 'open')
                ->where('rr.office_id', $officeId)
                ->whereIn('rr.status', ['pending', 'rejected']);
            
            if (!empty($params['date_from'])) $incomingActionQuery->whereDate('r.created_at', '>=', $params['date_from']);
            if (!empty($params['date_to']))   $incomingActionQuery->whereDate('r.created_at', '<=', $params['date_to']);
            
            $incomingAction = $incomingActionQuery->count();
        }

        // 2. Outgoing: I am the creator and at least one recipient has a 'submitted' status
        $outgoingActionQuery = DB::table('document_requests as r')
            ->where('r.status', 'open')
            ->where('r.created_by_user_id', $user->id)
            ->whereExists(function ($sub) {
                $sub->select(DB::raw(1))
                    ->from('document_request_recipients as rr')
                    ->whereColumn('rr.request_id', 'r.id')
                    ->where('rr.status', 'submitted');
            });

        if (!empty($params['date_from'])) $outgoingActionQuery->whereDate('r.created_at', '>=', $params['date_from']);
        if (!empty($params['date_to']))   $outgoingActionQuery->whereDate('r.created_at', '<=', $params['date_to']);
        
        $outgoingAction = $outgoingActionQuery->count();

        return response()->json([
            'active' => $activeCount,
            'action_required' => $incomingAction + $outgoingAction,
            'incoming_action' => $incomingAction,
            'outgoing_action' => $outgoingAction,
        ]);
    }


    // ── GET /api/document-requests (QA/Admin) ──────────────────────────────
    public function index(Request $request)
    {
        $user     = $request->user();
        $role     = $this->roleName($request);
        $isQa     = $this->isQaOrAdmin($role);
        $officeId = (int) ($user?->office_id ?? 0);

        if (!$isQa && $officeId <= 0) {
            return response()->json(['message' => 'Your account has no office assigned.'], 422);
        }

        $data = $request->validate([
            'status'    => 'nullable|in:open,closed,cancelled',
            'mode'      => 'nullable|in:multi_office,multi_doc',
            'q'         => 'nullable|string|max:100',
            'per_page'  => 'nullable|integer|min:1|max:50',
            'office_id' => 'nullable|integer',
            'direction' => 'nullable|in:all,incoming,outgoing',
            'sort_by'   => 'nullable|string|in:id,title,created_at,due_at',
            'sort_dir'  => 'nullable|in:asc,desc',
            'date_from' => 'nullable|date',
            'date_to'   => 'nullable|date',
        ]);

        $perPage = (int) ($data['per_page'] ?? 25);
        $sortMap = [
            'id'         => 'r.id',
            'title'      => 'r.title',
            'created_at' => 'r.created_at',
            'due_at'     => 'r.due_at'
        ];
        $actualSort = $sortMap[$data['sort_by'] ?? 'created_at'] ?? 'r.created_at';
        $sortDir    = $data['sort_dir'] ?? 'desc';

        try {
            \Log::info("DocumentRequestController@index start", ['user_id' => $user?->id, 'filters' => $data]);

            $q = DB::table('document_requests as r')
                ->leftJoin('users as u_cre', 'u_cre.id', '=', 'r.created_by_user_id')
                ->leftJoin('offices as o_cre', 'o_cre.id', '=', 'u_cre.office_id')
                ->orderBy($actualSort, $sortDir)
                ->select([
                    'r.id', 'r.title', 'r.description', 'r.status', 'r.mode', 'r.due_at', 'r.created_at', 'r.created_by_user_id',
                    DB::raw("CONCAT(u_cre.first_name, ' ', u_cre.last_name) as creator_user_name"),
                    'o_cre.name as creator_office_name',
                    'o_cre.code as creator_office_code',
                ]);

            if (!$isQa) {
                $q->where(function ($query) use ($user, $officeId) {
                    // I created it (outgoing)
                    $query->where('r.created_by_user_id', (int)$user->id)
                          // I received it (incoming) AND I haven't finished it
                          ->orWhereExists(function ($sub) use ($officeId) {
                              $sub->select(DB::raw(1))
                                  ->from('document_request_recipients as rr_access')
                                  ->whereColumn('rr_access.request_id', 'r.id')
                                  ->where('rr_access.office_id', $officeId)
                                  ->when(request('status') === 'open', function($sq) {
                                      $sq->whereNotIn('rr_access.status', ['accepted', 'cancelled']);
                                  });
                          });
                });
            }

            if (!empty($data['status'])) $q->where('r.status', $data['status']);
            if (!empty($data['mode']))   $q->where('r.mode', $data['mode']);
            if (!empty($data['date_from'])) $q->whereDate('r.created_at', '>=', $data['date_from']);
            if (!empty($data['date_to']))   $q->whereDate('r.created_at', '<=', $data['date_to']);
            if (!empty($data['office_id'])) {
                $fOfficeId = (int) $data['office_id'];
                $q->where(function ($qq) use ($fOfficeId) {
                    $qq->where('u_cre.office_id', $fOfficeId)
                       ->orWhereExists(function ($sub) use ($fOfficeId) {
                           $sub->select(DB::raw(1))
                               ->from('document_request_recipients as rr_filter')
                               ->whereColumn('rr_filter.request_id', 'r.id')
                               ->where('rr_filter.office_id', $fOfficeId);
                       });
                });
            }

            if (!empty($data['direction']) && $data['direction'] !== 'all') {
                if ($data['direction'] === 'outgoing') {
                    $q->where('r.created_by_user_id', (int)$user->id);
                } else {
                    $q->where('r.created_by_user_id', '!=', (int)$user->id);
                }
            }

            if (!empty($data['q'])) {
                $term = trim($data['q']);
                $q->where(function ($qq) use ($term) {
                    $qq->where('r.title', 'like', "%{$term}%")
                        ->orWhere('r.description', 'like', "%{$term}%");
                });
            }

            $isAll = empty($data['direction']) || $data['direction'] === 'all';
            $paginated = $q->paginate($perPage);

            $items = collect($paginated->items())->map(function ($row) use ($user, $isQa, $isAll) {
                try {
                    $requestId = (int) $row->id;
                    $mode = $row->mode ?? 'multi_office';
                    
                    $prog = ['total' => 0, 'submitted' => 0, 'accepted' => 0];
                    try {
                        $prog = $this->progress->buildProgress($requestId, $mode);
                    } catch (\Throwable $pe) {}

                    $recipients = [];
                    try {
                        $recipients = DB::table('document_request_recipients as rr')
                            ->join('offices as o', 'o.id', '=', 'rr.office_id')
                            ->where('rr.request_id', $requestId)
                            ->select(['o.code', 'o.name'])
                            ->get();
                    } catch (\Throwable $re) {}

                    $isMine = (int)$row->created_by_user_id === (int)$user->id;
                    $recCodes = collect($recipients)->pluck('code')->unique()->implode(',');
                    $recNames = collect($recipients)->pluck('name')->unique()->implode(', ');

                    // For QA/Admin, show more context in the "office" column if in "All" view
                    $displayCodeResource = $row->creator_office_code ?: 'System';
                    $displayText = $displayCodeResource;
                    
                    if ($isQa && $isAll) {
                         $displayText = $displayCodeResource . " → " . (strlen($recCodes) > 15 ? substr($recCodes, 0, 15) . "..." : ($recCodes ?: 'None'));
                    } else if ($isMine) {
                         $displayText = $recCodes ?: 'None';
                    }

                    return [
                        'id'                     => $requestId,
                        'title'                  => $row->title,
                        'description'            => $row->description,
                        'status'                 => $row->status,
                        'mode'                   => $mode,
                        'due_at'                 => $row->due_at,
                        'created_at'             => $row->created_at,
                        'created_by_user_id'     => (int) $row->created_by_user_id,
                        'creator_user_name'      => $row->creator_user_name,
                        'creator_office_name'    => $row->creator_office_name,
                        'creator_office_code'    => $row->creator_office_code,
                        'creator_label'          => $isMine ? 'YOU' : ($row->creator_office_code ?: 'System'),
                        'direction'              => $isMine ? 'outgoing' : 'incoming',
                        'progress'               => $prog,
                        'office_code'            => $displayText,
                        'office_name'            => $isMine ? $recNames : $row->creator_office_name,
                        'recipient_offices_code' => $recCodes,
                        'recipient_offices_name' => $recNames,
                        'can_act'                => $isMine ? DB::table('document_request_recipients')->where('request_id', $requestId)->where('status', 'submitted')->exists() : false,
                    ];
                } catch (\Throwable $e) {
                    \Log::warning("Skipping bad request row ID: " . ($row->id ?? 'unknown') . " - " . $e->getMessage());
                    return null;
                }
            })->filter()->values();

            $response = $paginated->toArray();
            $response['data'] = $items->all();

            return response()->json($response);

        } catch (\Exception $e) {
            \Log::error("DocumentRequestController@index fatal: " . $e->getMessage(), [
                'file'    => $e->getFile(),
                'line'    => $e->getLine(),
                'user_id' => $user?->id,
                'sql'     => method_exists($e, 'getSql') ? $e->getSql() : 'N/A'
            ]);
            return response()->json([
                'message' => 'Failed to load requests matching the filter.',
                'error'   => (config('app.debug')) ? $e->getMessage() : 'Internal Server Error'
            ], 500);
        }
    }


    // ── GET /api/document-requests/recipients (flat individual recipients) ─
    public function indexRecipients(Request $request)
    {
        $user     = $request->user();
        $role     = $this->roleName($request);
        $isQa     = $this->isQaOrAdmin($role);
        $officeId = (int) ($user?->office_id ?? 0);

        if (!$isQa && $officeId <= 0) {
            return response()->json(['message' => 'Your account has no office assigned.'], 422);
        }

        $data = $request->validate([
            'q'              => 'nullable|string|max:100',
            'status'         => 'nullable|in:pending,submitted,accepted,rejected',
            'request_status' => 'nullable|in:open,closed,cancelled',
            'per_page'       => 'nullable|integer|min:1|max:50',
            'page'           => 'nullable|integer|min:1',
            'office_id'      => 'nullable|integer',
        ]);

        $perPage = (int) ($data['per_page'] ?? 25);

        $q = DB::table('document_request_recipients as rr')
            ->join('document_requests as r', 'r.id', '=', 'rr.request_id')
            ->join('offices as o', 'o.id', '=', 'rr.office_id')
            ->orderByDesc('rr.id')
            ->select([
                'rr.id as recipient_id',
                'rr.request_id',
                'rr.office_id',
                'rr.status as recipient_status',
                'rr.last_submitted_at',
                'rr.last_reviewed_at',
                'r.title as batch_title',
                'r.description as batch_description',
                'r.mode as batch_mode',
                'r.status as batch_status',
                'r.due_at',
                'r.created_at',
                'o.name as office_name',
                'o.code as office_code',
            ]);

        if (!$isQa) {
            $q->where('rr.office_id', $officeId);
        }

        if (!empty($data['q'])) {
            $term = trim($data['q']);
            $q->where(function ($qq) use ($term) {
                $qq->where('r.title', 'like', "%{$term}%")
                   ->orWhere('r.description', 'like', "%{$term}%");
            });
        }

        if (!empty($data['status'])) {
            $q->where('rr.status', $data['status']);
        }

        if (!empty($data['office_id'])) {
            $q->where('rr.office_id', (int) $data['office_id']);
        }

        if (!empty($data['request_status'])) {
            $q->where('r.status', $data['request_status']);
        }

        return response()->json($q->paginate($perPage));
    }

    // ── GET /api/document-requests/individual (flat items + recipients) ────
    public function indexIndividual(Request $request)
    {
        $user     = $request->user();
        $role     = $this->roleName($request);
        $isQa     = $this->isQaOrAdmin($role);
        $officeId = (int) ($user?->office_id ?? 0);

        if (!$isQa && $officeId <= 0) {
            return response()->json(['message' => 'Your account has no office assigned.'], 422);
        }

        $data = $request->validate([
            'q'              => 'nullable|string|max:100',
            'status'         => 'nullable|in:pending,submitted,accepted,rejected',
            'request_status' => 'nullable|in:open,closed,cancelled',
            'per_page'       => 'nullable|integer|min:1|max:50',
            'page'           => 'nullable|integer|min:1',
            'direction'      => 'nullable|in:all,incoming,outgoing',
            'office_id'      => 'nullable|integer',
        ]);

        $perPage = (int) ($data['per_page'] ?? 25);
        $page    = max(1, (int) ($data['page'] ?? 1));

        return response()->json($this->repository->getIndividualRequests(
            filters:  $data,
            perPage:  $perPage,
            page:     $page,
            isQa:     $isQa,
            officeId: $officeId,
            userId:   $user->id
        ));
    }

    // ── GET /api/document-requests/inbox (office users) ───────────────────
    public function inbox(Request $request)
    {
        $user     = $request->user();
        $role     = $this->roleName($request);
        $isAdmin  = in_array($role, ['admin', 'sysadmin'], true);
        $officeId = (int) ($user?->office_id ?? 0);

        if (!$isAdmin && $officeId <= 0) {
            return response()->json(['message' => 'Your account has no office assigned.'], 422);
        }

        $data = $request->validate([
            'q'         => 'nullable|string|max:100',
            'status'    => 'nullable|in:open,closed,cancelled',
            'per_page'  => 'nullable|integer|min:1|max:50',
            'office_id' => 'nullable|integer',
            'direction' => 'nullable|in:all,incoming,outgoing',
            'sort_by'   => 'nullable|string|in:id,title,created_at,due_at',
            'sort_dir'  => 'nullable|in:asc,desc',
        ]);
        $perPage = (int) ($data['per_page'] ?? 25);
        $sortMap = [
            'id'         => 'r.id',
            'title'      => 'r.title',
            'created_at' => 'r.created_at',
            'due_at'     => 'r.due_at'
        ];
        $actualSort = $sortMap[$data['sort_by'] ?? 'created_at'] ?? 'r.created_at';
        $sortDir    = $data['sort_dir'] ?? 'desc';

        try {
            if ($isAdmin) {
                // Admin: see all requests globally
                $q = DB::table('document_requests as r')
                    ->leftJoin('users as u_cre', 'u_cre.id', '=', 'r.created_by_user_id')
                    ->leftJoin('offices as o_cre', 'o_cre.id', '=', 'u_cre.office_id')
                    ->orderBy($actualSort, $sortDir)
                    ->select([
                        'r.*',
                        'o_cre.code as creator_office_code',
                        'o_cre.name as creator_office_name',
                    ]);
            } else {
                $q = DB::table('document_requests as r')
                    ->join('document_request_recipients as rr', 'rr.request_id', '=', 'r.id')
                    ->leftJoin('users as u_cre', 'u_cre.id', '=', 'r.created_by_user_id')
                    ->leftJoin('offices as o_cre', 'o_cre.id', '=', 'u_cre.office_id')
                    ->where('rr.office_id', $officeId)
                    ->orderBy($actualSort, $sortDir)
                    ->select([
                        'r.*',
                        'rr.id as recipient_id',
                        'rr.status as recipient_status',
                        'rr.last_submitted_at',
                        'rr.last_reviewed_at',
                        'o_cre.code as creator_office_code',
                        'o_cre.name as creator_office_name',
                    ]);
            }

            if (!empty($data['status'])) {
                $q->where('r.status', $data['status']);
                if ($data['status'] === 'open' && !$isAdmin) {
                    // For recipients, 'open' should only mean things they haven't finished
                    $q->whereNotIn('rr.status', ['accepted', 'cancelled']);
                }
            }
            if (!empty($data['direction']) && $data['direction'] !== 'all') {
                if ($data['direction'] === 'outgoing') {
                    $q->where('r.created_by_user_id', (int)$user->id);
                } else {
                    $q->where('r.created_by_user_id', '!=', (int)$user->id);
                }
            }
            if (!empty($data['office_id'])) {
                $fOfficeId = (int) $data['office_id'];
                $q->where(function ($qq) use ($fOfficeId) {
                    $qq->where('u_cre.office_id', $fOfficeId)
                       ->orWhereExists(function ($sub) use ($fOfficeId) {
                           $sub->select(DB::raw(1))
                               ->from('document_request_recipients as rr_filter')
                               ->whereColumn('rr_filter.request_id', 'r.id')
                               ->where('rr_filter.office_id', $fOfficeId);
                       });
                });
            }

            if (!empty($data['q'])) {
                $term = trim($data['q']);
                $q->where(function ($qq) use ($term) {
                    $qq->where('r.title', 'like', "%{$term}%")
                        ->orWhere('r.description', 'like', "%{$term}%");
                });
            }

            $paginated = $q->paginate($perPage);

            // Attach progress per row
            $rows = collect($paginated->items())->map(function ($row) use ($user) {
                $progress = null;
                try {
                    $progress = $this->progress->buildProgress((int)$row->id, $row->mode ?? 'multi_office');
                } catch (\Throwable $e) {
                    \Log::warning("Inbox Progress Error on req #{$row->id}: " . $e->getMessage());
                    $progress = ['total'=>0,'submitted'=>0,'accepted'=>0];
                }

                $direction = ((int)($row->created_by_user_id ?? 0) === (int)$user->id) ? 'outgoing' : 'incoming';
                
                return array_merge((array) $row, [
                    'progress'    => $progress,
                    'direction'   => $direction,
                    'office_code' => $row->creator_office_code,
                    'office_name' => $row->creator_office_name,
                    'can_act'     => $direction === 'outgoing' 
                        ? DB::table('document_request_recipients')->where('request_id', (int)$row->id)->where('status', 'submitted')->exists()
                        : in_array($row->recipient_status ?? 'pending', ['pending', 'rejected']),
                ]);
            });

            return response()->json(array_merge(
                $paginated->toArray(),
                ['data' => $rows->all()]
            ));
            
        } catch (\Throwable $e) {
            \Log::error("DocumentRequestController@inbox fatal: " . $e->getMessage());
            return response()->json(['message' => 'Failed to load inbox.', 'error' => $e->getMessage()], 500);
        }
    }


    // ── GET /api/document-requests/{id} ───────────────────────────────────
    public function show(Request $request, int $requestId)
    {
        $user     = $request->user();
        $role     = $this->roleName($request);
        $officeId = (int) ($user?->office_id ?? 0);
        $isQa     = $this->isQaOrAdmin($role);

        $row = DB::table('document_requests')->where('id', $requestId)->first();
        if (!$row) return response()->json(['message' => 'Not found'], 404);

        $isCreator = (int)($row->created_by_user_id ?? 0) === $user->id;

        if (!$isQa) {
            if ($officeId <= 0) return response()->json(['message' => 'Forbidden.'], 403);
            
            $isRecipient = DB::table('document_request_recipients')
                ->where('request_id', $requestId)
                ->where('office_id', $officeId)
                ->exists();
            
            if (!$isRecipient && !$isCreator) {
                return response()->json(['message' => 'Forbidden.'], 403);
            }
        }

        // Recipient
        $recipientQ = DB::table('document_request_recipients as rr')
            ->join('offices as o', 'o.id', '=', 'rr.office_id')
            ->where('rr.request_id', $requestId)
            ->select(['rr.*', 'o.name as office_name', 'o.code as office_code']);

        if (!$isQa && !$isCreator) {
            $recipientQ->where('rr.office_id', $officeId);
        }

        // Multi-office: QA or Creator sees all recipients with their progress
        if (($isQa || $isCreator) && $row->mode === 'multi_office') {
            $recipients = $recipientQ->get();


            $recipientsPayload = $recipients->map(function ($r) {
                $latest = DB::table('document_request_submissions')
                    ->where('recipient_id', $r->id)
                    ->orderByDesc('attempt_no')
                    ->first();

                return array_merge((array) $r, [
                    'latest_submission_status' => $latest?->status ?? null,
                    'latest_submission_at'     => $latest?->created_at ?? null,
                ]);
            });

            $requestPayload            = (array) $row;
            $requestPayload['progress'] = $this->progress->buildProgress($requestId, $row->mode);

            if ($row->template_id) {
                $requestPayload['template'] = DB::table('document_templates')
                    ->where('id', $row->template_id)
                    ->select(['id', 'name', 'original_filename', 'file_path'])
                    ->first();
            } else {
                $requestPayload['template'] = null;
            }

            return response()->json([
                'request'    => $requestPayload,
                'recipients' => $recipientsPayload,
                'items'      => [],
                'recipient'  => null,
                'latest_submission'  => null,
                'submissions'        => [],
            ]);
        }

        // Single recipient view (office user or QA viewing one recipient)
        $recipient = $recipientQ->first();
        if (!$recipient) return response()->json(['message' => 'Recipient not found'], 404);

        $requestPayload              = (array) $row;
        $requestPayload['office_id']   = (int) ($recipient->office_id ?? 0);
        $requestPayload['office_name'] = $recipient->office_name ?? null;
        $requestPayload['office_code'] = $recipient->office_code ?? null;
        $requestPayload['progress']    = $this->progress->buildProgress($requestId, $row->mode);

        if ($row->template_id) {
            $requestPayload['template'] = DB::table('document_templates')
                ->where('id', $row->template_id)
                ->select(['id', 'name', 'original_filename', 'file_path'])
                ->first();
        } else {
            $requestPayload['template'] = null;
        }

        // Items for multi_doc mode
        $itemsPayload = [];
        if ($row->mode === 'multi_doc') {
            $items = DB::table('document_request_items')
                ->where('request_id', $requestId)
                ->orderBy('sort_order')
                ->get();

            $itemsPayload = $items->map(function ($item) use ($recipient) {
                $latest = DB::table('document_request_submissions')
                    ->where('item_id', $item->id)
                    ->where('recipient_id', $recipient->id)
                    ->orderByDesc('attempt_no')
                    ->first();

                $files = [];
                if ($latest) {
                    $files = DB::table('document_request_submission_files')
                        ->where('submission_id', $latest->id)
                        ->orderBy('id')
                        ->get()
                        ->map(fn($f) => [
                            'id'                => (int) $f->id,
                            'original_filename' => $f->original_filename,
                            'file_path'         => $f->file_path,
                            'preview_path'      => $f->preview_path,
                            'mime'              => $f->mime,
                            'size_bytes'        => (int) ($f->size_bytes ?? 0),
                            'created_at'        => $f->created_at,
                        ])
                        ->values()
                        ->all();
                }

                return [
                    'id'                       => (int) $item->id,
                    'title'                    => $item->title,
                    'description'              => $item->description,
                    'example_original_filename' => $item->example_original_filename,
                    'example_file_path'        => $item->example_file_path,
                    'example_preview_path'     => $item->example_preview_path,
                    'template_id'              => $item->template_id,
                    'template'                 => $item->template_id ? DB::table('document_templates')
                                                    ->where('id', $item->template_id)
                                                    ->select(['id', 'name', 'original_filename', 'file_path'])
                                                    ->first() : null,
                    'sort_order'               => (int) $item->sort_order,
                    'latest_submission'        => $latest ? [
                        'id'                    => (int) $latest->id,
                        'status'                => $latest->status,
                        'attempt_no'            => (int) $latest->attempt_no,
                        'note'                  => $latest->note,
                        'qa_review_note'        => $latest->qa_review_note,
                        'reviewed_at'           => $latest->reviewed_at,
                        'created_at'            => $latest->created_at,
                        'files'                 => $files,
                    ] : null,
                ];
            })->values()->all();
        }

        // Submissions for multi_office (single recipient view)
        $submissionsPayload    = [];
        $latestSubmissionPayload = null;

        if ($row->mode === 'multi_office') {
            $submissions = DB::table('document_request_submissions as s')
                ->where('s.recipient_id', (int) $recipient->id)
                ->orderByDesc('s.attempt_no')
                ->limit(10)
                ->get();

            $submissionIds = $submissions->pluck('id')->map(fn($v) => (int) $v)->values();
            $filesBySubmission = collect();

            if ($submissionIds->count() > 0) {
                $filesBySubmission = DB::table('document_request_submission_files')
                    ->whereIn('submission_id', $submissionIds->all())
                    ->orderBy('id')
                    ->get()
                    ->groupBy('submission_id');
            }

            $submissionsPayload = $submissions->map(function ($s) use ($filesBySubmission) {
                $files = ($filesBySubmission[(int) $s->id] ?? collect())
                    ->map(fn($f) => [
                        'id'                => (int) $f->id,
                        'original_filename' => $f->original_filename,
                        'file_path'         => $f->file_path,
                        'preview_path'      => $f->preview_path,
                        'mime'              => $f->mime,
                        'size_bytes'        => (int) ($f->size_bytes ?? 0),
                        'created_at'        => $f->created_at,
                    ])->values();

                return [
                    'id'                     => (int) $s->id,
                    'recipient_id'           => (int) $s->recipient_id,
                    'attempt_no'             => (int) ($s->attempt_no ?? 0),
                    'status'                 => $s->status,
                    'note'                   => $s->note,
                    'submitted_by_user_id'   => (int) ($s->submitted_by_user_id ?? 0),
                    'qa_reviewed_by_user_id' => $s->qa_reviewed_by_user_id ? (int) $s->qa_reviewed_by_user_id : null,
                    'qa_review_note'         => $s->qa_review_note,
                    'reviewed_at'            => $s->reviewed_at,
                    'created_at'             => $s->created_at,
                    'updated_at'             => $s->updated_at,
                    'files'                  => $files,
                ];
            })->values()->all();

            if (!empty($submissionsPayload)) {
                $latestSubmissionPayload = $submissionsPayload[0];
            }
        }

        return response()->json([
            'request'           => $requestPayload,
            'recipient'         => $recipient,
            'recipients'        => [],
            'items'             => $itemsPayload,
            'latest_submission' => $latestSubmissionPayload,
            'submissions'       => $submissionsPayload,
        ]);
    }

    // ── POST /api/document-requests ───────────────────────────────────────
    public function store(Request $request)
    {
        $role = $this->roleName($request);
        if (!$this->isQaOrAdmin($role) && !in_array($role, ['office_staff', 'office_head', 'vpaa', 'vpad', 'vpf', 'vpr', 'president'], true)) {
            abort(403, 'Forbidden.');
        }

        $data = $request->validate([
            'title'       => 'required|string|max:180',
            'description' => 'nullable|string',
            'due_at'      => 'nullable|date',
            'mode'        => 'required|in:multi_office,multi_doc',

            'office_ids'   => 'required_if:mode,multi_office|array|min:1|max:50',
            'office_ids.*' => 'integer|exists:offices,id',
            'example_file' => 'nullable|file|mimes:pdf,doc,docx,xls,xlsx,ppt,pptx|max:10240',
            'template_id'  => 'nullable|integer|exists:document_templates,id',

            'office_id'    => 'required_if:mode,multi_doc|integer|exists:offices,id',
            'items'        => 'required_if:mode,multi_doc|array|min:1|max:10',
            'items.*.title'       => 'required|string|max:180',
            'items.*.description' => 'nullable|string',
            'items.*.template_id' => 'nullable|integer|exists:document_templates,id',
        ]);

        $user = $request->user();
        $myOfficeId = (int) ($user->office_id ?? 0);
        
        if ($myOfficeId > 0) {
            if ($data['mode'] === 'multi_office') {
                if (in_array($myOfficeId, array_map('intval', $data['office_ids']), true)) {
                    return response()->json(['message' => 'You cannot request documents from your own office.'], 422);
                }
            } else {
                if ((int)$data['office_id'] === $myOfficeId) {
                    return response()->json(['message' => 'You cannot request documents from your own office.'], 422);
                }
            }
        }

        $requestId = $this->service->createRequest(
            data:        $data,
            actor:       $request->user(),
            exampleFile: $request->file('example_file')
        );

        return response()->json([
            'message' => 'Document request created.',
            'id'      => $requestId,
        ], 201);
    }

    // ── POST /api/document-requests/{request}/recipients/{recipient}/submit
    public function submit(Request $request, int $requestId, int $recipientId)
    {
        $user       = $request->user();
        $role       = $this->roleName($request);
        $myOfficeId = (int) ($user?->office_id ?? 0);
        $isQa       = $this->isQaOrAdmin($role);
        $isAdmin    = $role === 'admin';

        $data = $request->validate([
            'note'     => 'nullable|string|max:2000',
            'item_id'  => 'nullable|integer|exists:document_request_items,id',
            'files'    => 'required|array|min:1|max:5',
            'files.*'  => 'file|mimes:pdf,doc,docx,xls,xlsx,ppt,pptx|max:10240',
        ]);

        $req = DB::table('document_requests')->where('id', $requestId)->first();
        if (!$req) return response()->json(['message' => 'Not found'], 404);
        if (($req->status ?? '') !== 'open') {
            return response()->json(['message' => 'Request is not open.'], 422);
        }
        $recipient = DB::table('document_request_recipients')
            ->where('id', $recipientId)
            ->where('request_id', $requestId)
            ->first();

        if (!$recipient) return response()->json(['message' => 'Recipient not found'], 404);

        // Authorization:
        // 1. User belongs to recipient office
        // 2. User is QA/Admin and recipient is the QA office
        // 3. User is Admin (all-access for rescue/dev)
        $recipientOfficeId = (int) ($recipient->office_id ?? 0);
        $isRecipientMember = ($myOfficeId > 0 && $myOfficeId === $recipientOfficeId);

        $qaOfficeId = Cache::remember('office_id:QA', 3600, function () {
            return DB::table('offices')->where('code', 'QA')->value('id');
        });
        $isQaFulfillingQaRequest = ($isQa && $recipientOfficeId === (int)$qaOfficeId);

        $canSubmit = $isRecipientMember || $isQaFulfillingQaRequest || $isAdmin;

        if (!$canSubmit) {
            return response()->json(['message' => 'Forbidden. Only the requested office can submit files.'], 403);
        }

        if ($req->mode === 'multi_doc' && empty($data['item_id'])) {
            return response()->json(['message' => 'item_id is required for multi-document requests.'], 422);
        }

        $submissionId = $this->service->submitSubmission(
            requestId:     $requestId,
            recipientId:   $recipientId,
            data:          $data,
            actor:         $user,
            uploadedFiles: $request->file('files')
        );

        return response()->json([
            'message'       => 'Submission uploaded.',
            'submission_id' => $submissionId,
        ], 201);
    }

    // ── POST /api/document-request-submissions/{submission}/review ─────────
    public function review(Request $request, int $submissionId)
    {
        $user = $request->user();
        $role = $this->roleName($request);
        $isQa = $this->isQaOrAdmin($role);
        $isAdmin = $role === 'admin';

        $submission = DB::table('document_request_submissions')->where('id', $submissionId)->first();
        if (!$submission) return response()->json(['message' => 'Submission not found'], 404);

        $requestId = DB::table('document_request_recipients')->where('id', $submission->recipient_id)->value('request_id');
        $docRequest = DB::table('document_requests')->where('id', $requestId)->first();
        if (!$docRequest) return response()->json(['message' => 'Request not found'], 404);

        // Authorization:
        // 1. User is the specific requester (creator)
        // 2. User belongs to the same office as the requester
        // 3. Admin (all-access)
        
        $creatorOfficeId = DB::table('users')->where('id', $docRequest->created_by_user_id)->value('office_id');
        $myOfficeId = (int) ($user?->office_id ?? 0);
        
        $isCreatorUser = ($user->id === (int)$docRequest->created_by_user_id);
        $isCreatorOffice = ($myOfficeId > 0 && $myOfficeId === (int)$creatorOfficeId);
        $recipientOfficeId = DB::table('document_request_recipients')->where('id', $submission->recipient_id)->value('office_id');
        $isRecipientOffice = ($myOfficeId > 0 && $myOfficeId === (int)$recipientOfficeId);

        if ($isRecipientOffice && !$isAdmin) {
             return response()->json(['message' => 'Forbidden. Recipient cannot review their own submission.'], 403);
        }

        if (!$isCreatorUser && !$isCreatorOffice && !$isQa) {
            return response()->json(['message' => 'Forbidden. Only the requester office or QA can review submissions.'], 403);
        }

        $data = $request->validate([
            'decision' => 'required|in:accepted,rejected',
            'note'     => 'nullable|string|max:2000',
        ]);

        $this->service->reviewSubmission(
            submissionId: $submissionId,
            data:         $data,
            actor:        $request->user()
        );

        return response()->json(['message' => 'Reviewed.'], 200);
    }

    // GET /api/document-requests/{id}/recipients/{recipientId}
    public function showRecipient(Request $request, int $requestId, int $recipientId)
    {
        $user     = $request->user();
        $role     = $this->roleName($request);
        $officeId = (int) ($user?->office_id ?? 0);
        $isQa     = $this->isQaOrAdmin($role);

        $row = DB::table('document_requests')->where('id', $requestId)->first();
        if (!$row) return response()->json(['message' => 'Not found'], 404);

        $recipient = DB::table('document_request_recipients as rr')
            ->join('offices as o', 'o.id', '=', 'rr.office_id')
            ->where('rr.id', $recipientId)
            ->where('rr.request_id', $requestId)
            ->select(['rr.*', 'o.name as office_name', 'o.code as office_code'])
            ->first();

        if (!$recipient) return response()->json(['message' => 'Recipient not found'], 404);

        $isCreator = (int)($row->created_by_user_id ?? 0) === $user->id;

        // Office users can only see their own recipient (unless they are the creator of the whole batch)
        if (!$isQa && (int) ($recipient->office_id ?? 0) !== $officeId && !$isCreator) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $requestPayload              = (array) $row;
        $requestPayload['office_id']   = (int) ($recipient->office_id ?? 0);
        $requestPayload['office_name'] = $recipient->office_name ?? null;
        $requestPayload['office_code'] = $recipient->office_code ?? null;

        if ($row->template_id) {
            $requestPayload['template'] = DB::table('document_templates')
                ->where('id', $row->template_id)
                ->select(['id', 'name', 'original_filename', 'file_path'])
                ->first();
        } else {
            $requestPayload['template'] = null;
        }

        // Submissions for this recipient (multi_office only)
        $submissions = DB::table('document_request_submissions as s')
            ->where('s.recipient_id', $recipientId)
            ->whereNull('s.item_id')
            ->orderByDesc('s.attempt_no')
            ->limit(10)
            ->get();

        $submissionIds = $submissions->pluck('id')->map(fn($v) => (int) $v)->values();
        $filesBySubmission = collect();

        if ($submissionIds->count() > 0) {
            $filesBySubmission = DB::table('document_request_submission_files')
                ->whereIn('submission_id', $submissionIds->all())
                ->orderBy('id')
                ->get()
                ->groupBy('submission_id');
        }

        $submissionsPayload = $submissions->map(function ($s) use ($filesBySubmission) {
            $files = ($filesBySubmission[(int) $s->id] ?? collect())
                ->map(fn($f) => [
                    'id'                => (int) $f->id,
                    'original_filename' => $f->original_filename,
                    'file_path'         => $f->file_path,
                    'preview_path'      => $f->preview_path,
                    'mime'              => $f->mime,
                    'size_bytes'        => (int) ($f->size_bytes ?? 0),
                    'created_at'        => $f->created_at,
                ])->values();

            return [
                'id'                     => (int) $s->id,
                'recipient_id'           => (int) $s->recipient_id,
                'item_id'                => null,
                'attempt_no'             => (int) ($s->attempt_no ?? 0),
                'status'                 => $s->status,
                'note'                   => $s->note,
                'submitted_by_user_id'   => (int) ($s->submitted_by_user_id ?? 0),
                'qa_reviewed_by_user_id' => $s->qa_reviewed_by_user_id ? (int) $s->qa_reviewed_by_user_id : null,
                'qa_review_note'         => $s->qa_review_note,
                'reviewed_at'            => $s->reviewed_at,
                'created_at'             => $s->created_at,
                'updated_at'             => $s->updated_at,
                'files'                  => $files,
            ];
        })->values()->all();

        $latestSubmissionPayload = !empty($submissionsPayload) ? $submissionsPayload[0] : null;
        $acceptedSubmissionPayload = collect($submissionsPayload)->firstWhere('status', 'accepted');

        return response()->json([
            'request'             => $requestPayload,
            'recipient'           => $recipient,
            'recipients'          => [],
            'items'               => [],
            'latest_submission'   => $latestSubmissionPayload,
            'accepted_submission' => $acceptedSubmissionPayload,
            'submissions'         => $submissionsPayload,
        ]);
    }

    // GET /api/document-requests/{id}/items/{itemId}
    public function showItem(Request $request, int $requestId, int $itemId)
    {
        $user     = $request->user();
        $role     = $this->roleName($request);
        $officeId = (int) ($user?->office_id ?? 0);
        $isQa     = $this->isQaOrAdmin($role);

        $row = DB::table('document_requests')->where('id', $requestId)->first();
        if (!$row) return response()->json(['message' => 'Not found'], 404);

        $item = DB::table('document_request_items')
            ->where('id', $itemId)
            ->where('request_id', $requestId)
            ->first();

        if (!$item) return response()->json(['message' => 'Item not found'], 404);

        // Get the recipient for this request
        $recipientQ = DB::table('document_request_recipients as rr')
            ->join('offices as o', 'o.id', '=', 'rr.office_id')
            ->where('rr.request_id', $requestId)
            ->select(['rr.*', 'o.name as office_name', 'o.code as office_code']);

        $isCreator = (int)($row->created_by_user_id ?? 0) === $user->id;
        $recipient = $recipientQ->first();

        if (!$recipient) return response()->json(['message' => 'Recipient not found'], 404);

        if (!$isQa && (int) ($recipient->office_id ?? 0) !== $officeId && !$isCreator) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $requestPayload              = (array) $row;
        $requestPayload['office_id']   = (int) ($recipient->office_id ?? 0);
        $requestPayload['office_name'] = $recipient->office_name ?? null;
        $requestPayload['office_code'] = $recipient->office_code ?? null;

        // For multi_doc individual view:
        // - example file comes from the item, not the request
        $requestPayload['example_original_filename'] = $item->example_original_filename;
        $requestPayload['example_file_path']         = $item->example_file_path;
        $requestPayload['example_preview_path']      = $item->example_preview_path;
        $requestPayload['item_title']                = $item->title;
        $requestPayload['item_description']          = $item->description;

        // Load root request template if any
        if ($row->template_id) {
            $requestPayload['template'] = DB::table('document_templates')
                ->where('id', $row->template_id)
                ->select(['id', 'name', 'original_filename', 'file_path'])
                ->first();
        } else {
            $requestPayload['template'] = null;
        }

        // Override with item template if specific template is set for this items
        if ($item->template_id) {
            $requestPayload['template'] = DB::table('document_templates')
                ->where('id', $item->template_id)
                ->select(['id', 'name', 'original_filename', 'file_path'])
                ->first();
        }

        // Submissions for this recipient + item
        $submissions = DB::table('document_request_submissions as s')
            ->where('s.recipient_id', (int) $recipient->id)
            ->where('s.item_id', $itemId)
            ->orderByDesc('s.attempt_no')
            ->limit(10)
            ->get();

        $submissionIds = $submissions->pluck('id')->map(fn($v) => (int) $v)->values();
        $filesBySubmission = collect();

        if ($submissionIds->count() > 0) {
            $filesBySubmission = DB::table('document_request_submission_files')
                ->whereIn('submission_id', $submissionIds->all())
                ->orderBy('id')
                ->get()
                ->groupBy('submission_id');
        }

        $submissionsPayload = $submissions->map(function ($s) use ($filesBySubmission, $itemId) {
            $files = ($filesBySubmission[(int) $s->id] ?? collect())
                ->map(fn($f) => [
                    'id'                => (int) $f->id,
                    'original_filename' => $f->original_filename,
                    'file_path'         => $f->file_path,
                    'preview_path'      => $f->preview_path,
                    'mime'              => $f->mime,
                    'size_bytes'        => (int) ($f->size_bytes ?? 0),
                    'created_at'        => $f->created_at,
                ])->values();

            return [
                'id'                     => (int) $s->id,
                'recipient_id'           => (int) $s->recipient_id,
                'item_id'                => $itemId,
                'attempt_no'             => (int) ($s->attempt_no ?? 0),
                'status'                 => $s->status,
                'note'                   => $s->note,
                'submitted_by_user_id'   => (int) ($s->submitted_by_user_id ?? 0),
                'qa_reviewed_by_user_id' => $s->qa_reviewed_by_user_id ? (int) $s->qa_reviewed_by_user_id : null,
                'qa_review_note'         => $s->qa_review_note,
                'reviewed_at'            => $s->reviewed_at,
                'created_at'             => $s->created_at,
                'updated_at'             => $s->updated_at,
                'files'                  => $files,
            ];
        })->values()->all();

        $latestSubmissionPayload = !empty($submissionsPayload) ? $submissionsPayload[0] : null;
        $acceptedSubmissionPayload = collect($submissionsPayload)->firstWhere('status', 'accepted');

        return response()->json([
            'request'             => $requestPayload,
            'recipient'           => $recipient,
            'recipients'          => [],
            'items'               => [],
            'item'                => $item,
            'latest_submission'   => $latestSubmissionPayload,
            'accepted_submission' => $acceptedSubmissionPayload,
            'submissions'         => $submissionsPayload,
        ]);
    }

    // PATCH /api/document-requests/{id}
    public function update(Request $request, int $requestId)
    {
        $user = $request->user();
        $role = $this->roleName($request);
        $isQa = $this->isQaOrAdmin($role);

        $row = DB::table('document_requests')->where('id', $requestId)->first();
        if (!$row) return response()->json(['message' => 'Not found.'], 404);

        if (!$isQa && (int)$row->created_by_user_id !== $user->id) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $payload = [];
        $changes = [];
        foreach (['title', 'description', 'due_at'] as $f) {
            if ($request->has($f)) {
                $old = $row->{$f};
                $new = $data[$f] ?? null;
                if ((string)$old !== (string)($new ?? '')) {
                    $payload[$f] = $new;
                    $changes[] = ['field' => $f, 'old' => $old, 'new' => $new];
                }
            }
        }

        if (empty($payload)) {
            return response()->json(['message' => 'Nothing to update.'], 200);
        }

        $payload['updated_at'] = now();

        DB::table('document_requests')->where('id', $requestId)->update($payload);

        $this->logActivity('document_request.updated', 'Updated document request details', $request->user()->id, $request->user()->office_id, [
            'document_request_id' => $requestId,
            'changes' => $changes,
        ]);

        try {
            broadcast(new \App\Events\WorkspaceChanged('request'));
        } catch (\Throwable) {}

        return response()->json(['message' => 'Updated.', 'id' => $requestId]);
    }

    // PATCH /api/document-request-items/{id}
    public function updateItem(Request $request, int $itemId)
    {
        $user = $request->user();
        $role = $this->roleName($request);
        $isQa = $this->isQaOrAdmin($role);

        $item = DB::table('document_request_items')->where('id', $itemId)->first();
        if (!$item) return response()->json(['message' => 'Item not found.'], 404);

        if (!$isQa) {
            $req = DB::table('document_requests')->where('id', $item->request_id)->first();
            if (!$req || (int)$req->created_by_user_id !== $user->id) {
                return response()->json(['message' => 'Forbidden.'], 403);
            }
        }

        $data = $request->validate([
            'title'       => 'sometimes|string|max:180',
            'description' => 'sometimes|nullable|string',
            'due_at'      => 'sometimes|nullable|date',
        ]);

        $payload = [];
        $changes = [];
        foreach (['title', 'description', 'due_at'] as $f) {
            if ($request->has($f)) {
                $old = $item->{$f};
                $new = $data[$f] ?? null;
                if ((string)$old !== (string)($new ?? '')) {
                    $payload[$f] = $new;
                    $changes[] = ['field' => $f, 'old' => $old, 'new' => $new];
                }
            }
        }

        if (empty($payload)) {
            return response()->json(['message' => 'Nothing to update.'], 200);
        }

        $payload['updated_at'] = now();

        DB::table('document_request_items')->where('id', $itemId)->update($payload);

        $this->logActivity('document_request_item.updated', 'Updated document request item', $request->user()->id, $request->user()->office_id, [
            'item_id'    => $itemId,
            'request_id' => $item->request_id,
            'changes'    => $changes,
        ]);

        return response()->json(['message' => 'Updated.', 'id' => $itemId]);
    }

    // PATCH /api/document-requests/{id}/recipients/{recipientId}
    public function updateRecipient(Request $request, int $requestId, int $recipientId)
    {
        $user = $request->user();
        $role = $this->roleName($request);
        $isQa = $this->isQaOrAdmin($role);

        if (!$isQa) {
            $req = DB::table('document_requests')->where('id', $requestId)->first();
            if (!$req || (int)$req->created_by_user_id !== (int)$user->id) {
                return response()->json(['message' => 'Forbidden.'], 403);
            }
        }

        $data = $request->validate([
            'due_at' => 'sometimes|nullable|date',
        ]);

        $recipient = DB::table('document_request_recipients')
            ->where('id', $recipientId)
            ->where('request_id', $requestId)
            ->first();

        if (!$recipient) return response()->json(['message' => 'Recipient not found.'], 404);

        $oldDue = $recipient->due_at;
        $newDue = $data['due_at'] ?? null;

        if ((string)$oldDue === (string)($newDue ?? '')) {
            return response()->json(['message' => 'Nothing to update.'], 200);
        }

        DB::table('document_request_recipients')
            ->where('id', $recipientId)
            ->update([
                'due_at'     => $newDue,
                'updated_at' => now(),
            ]);

        $this->logActivity('document_request_recipient.updated', 'Updated recipient due date', $request->user()->id, $request->user()->office_id, [
            'recipient_id' => $recipientId,
            'request_id'   => $requestId,
            'changes'      => [['field' => 'due_at', 'old' => $oldDue, 'new' => $newDue]],
        ], null, null, (int) $recipient->office_id);

        return response()->json(['message' => 'Updated.', 'id' => $recipientId]);
    }

    // PATCH /api/document-requests/{id}/status
    public function updateStatus(Request $request, int $requestId)
    {
        $user = $request->user();
        $role = $this->roleName($request);
        $isQa = $this->isQaOrAdmin($role);

        $req = DB::table('document_requests')->where('id', $requestId)->first();
        if (!$req) return response()->json(['message' => 'Not found.'], 404);

        if (!$isQa && (int)$req->created_by_user_id !== (int)$user->id) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $data = $request->validate([
            'status' => 'required|in:closed,cancelled',
            'reason' => 'nullable|string|max:500',
        ]);

        $row = DB::table('document_requests')->where('id', $requestId)->first();
        if (!$row) return response()->json(['message' => 'Not found.'], 404);

        if ($data['status'] === 'cancelled') {
            $hasAccepted = DB::table('document_request_recipients')
                ->where('request_id', $requestId)
                ->where('status', 'accepted')
                ->exists();

            if ($hasAccepted) {
                return response()->json([
                    'message' => 'Cannot cancel this request because some items have already been accepted. Please close it instead.'
                ], 422);
            }
        }

        $now = now();
        DB::table('document_requests')->where('id', $requestId)->update([
            'status'     => $data['status'],
            'updated_at' => $now,
        ]);

        if ($data['status'] === 'cancelled') {
            DB::table('document_request_recipients')
                ->where('request_id', $requestId)
                ->update(['status' => 'cancelled', 'updated_at' => $now]);
        }

        $event = $data['status'] === 'closed' ? 'document_request.closed' : 'document_request.cancelled';
        $label = $data['status'] === 'closed' ? 'Closed document request' : 'Cancelled document request';

        $this->logActivity($event, $label, $request->user()->id, $request->user()->office_id, [
            'document_request_id' => $requestId,
            'reason'              => $data['reason'] ?? null,
        ]);

        // Insert system message so participants see the status change
        DB::table('document_request_messages')->insert([
            'document_request_id' => $requestId,
            'sender_user_id'      => $request->user()->id,
            'type'                => 'system',
            'message'             => $label . ($data['reason'] ? ': ' . $data['reason'] : ''),
            'created_at'          => $now,
            'updated_at'          => $now,
        ]);

        // Notify recipient offices on close/cancel
        $recipientOfficeIds = DB::table('document_request_recipients')
            ->where('request_id', $requestId)
            ->pluck('office_id')
            ->all();

        if (!empty($recipientOfficeIds)) {
            $actor     = $request->user();
            $actorName = trim(($actor->first_name ?? '') . ' ' . ($actor->last_name ?? '')) ?: 'QA';
            $frontendUrl = rtrim(env('FRONTEND_URL', config('app.url')), '/');
            $statusLabel = ucfirst($data['status']);
            $notifTitle  = 'Document request ' . $data['status'];
            $notifBody   = ($row->title ?? 'A document request') . ' has been ' . $data['status'] . ($data['reason'] ? ': ' . $data['reason'] : '') . ' by ' . $actorName . '.';

            $users = User::whereIn('office_id', $recipientOfficeIds)
                ->select(['id', 'first_name', 'last_name', 'email', 'email_doc_updates'])
                ->get();

            foreach ($users as $u) {
                // 1. Create Inbox Notification
                Notification::create([
                    'user_id'             => $u->id,
                    'document_id'         => null,
                    'document_version_id' => null,
                    'event'               => $event,
                    'title'               => $notifTitle,
                    'body'                => ($row->title ?? 'A document request') . ' has been ' . $data['status'],
                    'meta'                => [
                        'document_request_id' => $requestId,
                        'reason'              => $data['reason'] ?? null,
                    ],
                    'read_at' => null,
                ]);

                // 2. Queue Email
                if (!(bool) ($u->email_doc_updates ?? true) || !$u->email) continue;
                try {
                    Mail::to($u->email)->queue(new \App\Mail\WorkflowNotificationMail(
                        recipientName: trim($u->first_name . ' ' . $u->last_name) ?: $u->email,
                        notifTitle: $notifTitle,
                        notifBody: $notifBody,
                        documentTitle: $row->title ?? 'Document Request',
                        documentStatus: $statusLabel,
                        isReject: $data['status'] === 'cancelled',
                        actorName: $actorName,
                        documentId: null,
                        appUrl: $frontendUrl,
                        appName: config('app.name', 'FilDOCS'),
                        overrideLinkUrl: $frontendUrl . '/document-requests/' . $requestId,
                        cardLabel: 'Document Request',
                    ));
                } catch (\Throwable) {
                }
            }
        }

        try {
            broadcast(new \App\Events\WorkspaceChanged('request'));
        } catch (\Throwable) {}

        return response()->json(['message' => ucfirst($data['status']) . '.', 'id' => $requestId]);
    }

    /**
     * Get offices that have active document requests (for filtering).
     */
    public function activeOffices(Request $request)
    {
        $senderOfficeIds = DB::table('document_requests as dr')
            ->join('users as u', 'u.id', '=', 'dr.created_by_user_id')
            ->whereNotNull('u.office_id')
            ->distinct()
            ->pluck('u.office_id');

        $recipientOfficeIds = DB::table('document_request_recipients')
            ->distinct()
            ->pluck('office_id');

        $allActiveIds = $senderOfficeIds->concat($recipientOfficeIds)->unique()->filter()->values();

        $offices = DB::table('offices')
            ->whereIn('id', $allActiveIds)
            ->whereNull('deleted_at')
            ->orderBy('name', 'asc')
            ->get(['id', 'name', 'code', 'type']);

        return response()->json($offices);
    }

    public function destroy(DocumentRequest $request)
    {
        $user = auth()->user();
        if (!in_array($user?->role?->name, ['Admin', 'SysAdmin'], true)) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $id = $request->id;
        $title = $request->title;

        $request->delete();

        // Manual log entry (trait is used in controller)
        \App\Models\ActivityLog::create([
            'user_id' => $user->id,
            'office_id' => $user->office_id,
            'event' => 'document_request.deleted',
            'description' => 'Deleted document request',
            'meta' => ['id' => $id, 'title' => $title],
        ]);

        try {
            broadcast(new \App\Events\WorkspaceChanged('request'));
        } catch (\Throwable) {}

        return response()->json(['message' => 'Document Request deleted.']);
    }
}
