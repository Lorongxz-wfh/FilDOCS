<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\DocumentRequest;
use App\Models\DocumentRequestItem;
use App\Models\Notification;
use App\Models\User;
use App\Services\DocumentRequests\DocumentRequestFileService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DocumentRequestController extends Controller
{
    public function __construct(private DocumentRequestFileService $files) {}

    private function roleName(Request $request): string
    {
        $user = $request->user();
        $raw =
            (optional($user?->role)->name ?? null) ??
            ($user?->role_name ?? null) ??
            ($user?->role ?? null) ??
            '';
        return strtolower(trim((string) $raw));
    }

    private function assertQaOrSysadmin(Request $request): void
    {
        $role = $this->roleName($request);
        if (!in_array($role, ['qa', 'sysadmin', 'admin'], true)) {
            abort(403, 'Forbidden.');
        }
    }

    private function isQaRole(string $role): bool
    {
        return in_array($role, ['qa', 'sysadmin', 'admin'], true);
    }

    // ── Helpers ────────────────────────────────────────────────────────────

    private function buildProgress(int $requestId, string $mode): array
    {
        if ($mode === 'multi_office') {
            $recipients = DB::table('document_request_recipients')
                ->where('request_id', $requestId)
                ->get(['id', 'status']);

            $total     = $recipients->count();
            $submitted = $recipients->whereIn('status', ['submitted', 'accepted', 'rejected'])->count();
            $accepted  = $recipients->where('status', 'accepted')->count();

            return compact('total', 'submitted', 'accepted');
        }

        // multi_doc — progress is per item
        $items = DB::table('document_request_items')
            ->where('request_id', $requestId)
            ->get(['id']);

        $total = $items->count();

        // For multi_doc there's 1 recipient — get their id
        $recipient = DB::table('document_request_recipients')
            ->where('request_id', $requestId)
            ->first(['id']);

        if (!$recipient) return ['total' => $total, 'submitted' => 0, 'accepted' => 0];

        $itemIds = $items->pluck('id')->all();

        // Latest submission per item for this recipient
        $latestStatuses = DB::table('document_request_submissions as s')
            ->whereIn('s.item_id', $itemIds)
            ->where('s.recipient_id', $recipient->id)
            ->orderByDesc('s.attempt_no')
            ->get(['s.item_id', 's.status'])
            ->unique('item_id');

        $submitted = $latestStatuses->whereIn('status', ['submitted', 'accepted', 'rejected'])->count();
        $accepted  = $latestStatuses->where('status', 'accepted')->count();

        return compact('total', 'submitted', 'accepted');
    }

    // ── GET /api/document-requests (QA/Admin) ──────────────────────────────
    public function index(Request $request)
    {
        $this->assertQaOrSysadmin($request);

        $data = $request->validate([
            'status'   => 'nullable|in:open,closed,cancelled',
            'mode'     => 'nullable|in:multi_office,multi_doc',
            'q'        => 'nullable|string|max:100',
            'per_page' => 'nullable|integer|min:1|max:50',
        ]);

        $perPage = (int) ($data['per_page'] ?? 25);

        $q = DB::table('document_requests')->orderByDesc('id');

        if (!empty($data['status'])) $q->where('status', $data['status']);
        if (!empty($data['mode']))   $q->where('mode', $data['mode']);
        if (!empty($data['q'])) {
            $term = trim($data['q']);
            $q->where(function ($qq) use ($term) {
                $qq->where('title', 'like', "%{$term}%")
                    ->orWhere('description', 'like', "%{$term}%");
            });
        }

        $paginated = $q->paginate($perPage);

        // Attach progress to each row
        $items = collect($paginated->items())->map(function ($row) {
            $progress = $this->buildProgress($row->id, $row->mode);
            return array_merge((array) $row, ['progress' => $progress]);
        });

        return response()->json(array_merge(
            $paginated->toArray(),
            ['data' => $items]
        ));
    }

    // ── GET /api/document-requests/inbox (office users) ───────────────────
    public function inbox(Request $request)
    {
        $user     = $request->user();
        $officeId = (int) ($user?->office_id ?? 0);
        if ($officeId <= 0) {
            return response()->json(['message' => 'Your account has no office assigned.'], 422);
        }

        $data    = $request->validate([
            'q'        => 'nullable|string|max:100',
            'per_page' => 'nullable|integer|min:1|max:50',
        ]);
        $perPage = (int) ($data['per_page'] ?? 25);

        $q = DB::table('document_requests as r')
            ->join('document_request_recipients as rr', 'rr.request_id', '=', 'r.id')
            ->where('rr.office_id', $officeId)
            ->orderByDesc('r.id')
            ->select([
                'r.*',
                'rr.id as recipient_id',
                'rr.status as recipient_status',
                'rr.last_submitted_at',
                'rr.last_reviewed_at',
            ]);

        if (!empty($data['q'])) {
            $term = trim($data['q']);
            $q->where(function ($qq) use ($term) {
                $qq->where('r.title', 'like', "%{$term}%")
                    ->orWhere('r.description', 'like', "%{$term}%");
            });
        }

        $paginated = $q->paginate($perPage);

        // Attach progress per row
        $rows = collect($paginated->items())->map(function ($row) {
            $progress = $this->buildProgress($row->id, $row->mode);
            return array_merge((array) $row, ['progress' => $progress]);
        });

        return response()->json(array_merge(
            $paginated->toArray(),
            ['data' => $rows]
        ));
    }

    // ── GET /api/document-requests/{id} ───────────────────────────────────
    public function show(Request $request, int $requestId)
    {
        $user     = $request->user();
        $role     = $this->roleName($request);
        $officeId = (int) ($user?->office_id ?? 0);
        $isQa     = $this->isQaRole($role);

        $row = DB::table('document_requests')->where('id', $requestId)->first();
        if (!$row) return response()->json(['message' => 'Not found'], 404);

        if (!$isQa) {
            if ($officeId <= 0) return response()->json(['message' => 'Forbidden.'], 403);
            $isRecipient = DB::table('document_request_recipients')
                ->where('request_id', $requestId)
                ->where('office_id', $officeId)
                ->exists();
            if (!$isRecipient) return response()->json(['message' => 'Forbidden.'], 403);
        }

        // Recipient
        $recipientQ = DB::table('document_request_recipients as rr')
            ->join('offices as o', 'o.id', '=', 'rr.office_id')
            ->where('rr.request_id', $requestId)
            ->select(['rr.*', 'o.name as office_name', 'o.code as office_code']);

        if (!$isQa) $recipientQ->where('rr.office_id', $officeId);

        // Multi-office: QA sees all recipients with their progress
        if ($isQa && $row->mode === 'multi_office') {
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
            $requestPayload['progress'] = $this->buildProgress($requestId, $row->mode);

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
        $requestPayload['progress']    = $this->buildProgress($requestId, $row->mode);

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
        $this->assertQaOrSysadmin($request);

        $data = $request->validate([
            'title'       => 'required|string|max:180',
            'description' => 'nullable|string',
            'due_at'      => 'nullable|date',
            'mode'        => 'required|in:multi_office,multi_doc',

            // multi_office: multiple offices, one example file
            'office_ids'   => 'required_if:mode,multi_office|array|min:1|max:50',
            'office_ids.*' => 'integer|exists:offices,id',
            'example_file' => 'nullable|file|mimes:pdf,doc,docx,xls,xlsx,ppt,pptx|max:10240',

            // multi_doc: one office, multiple items
            'office_id'    => 'required_if:mode,multi_doc|integer|exists:offices,id',
            'items'        => 'required_if:mode,multi_doc|array|min:1|max:10',
            'items.*.title'       => 'required|string|max:180',
            'items.*.description' => 'nullable|string',
        ]);

        $user = $request->user();

        return DB::transaction(function () use ($request, $data, $user) {
            $now  = now();
            $mode = $data['mode'];

            $requestId = DB::table('document_requests')->insertGetId([
                'title'              => $data['title'],
                'description'        => $data['description'] ?? null,
                'due_at'             => $data['due_at'] ?? null,
                'status'             => 'open',
                'mode'               => $mode,
                'created_by_user_id' => $user->id,
                'created_at'         => $now,
                'updated_at'         => $now,
            ]);

            $officeIds = [];

            if ($mode === 'multi_office') {
                // Optional single example file for the whole request
                if ($request->hasFile('example_file')) {
                    $payload = $this->files->saveRequestExampleFile($requestId, $request->file('example_file'));
                    DB::table('document_requests')->where('id', $requestId)->update([
                        'example_original_filename' => $payload['original_filename'],
                        'example_file_path'         => $payload['file_path'],
                        'example_preview_path'      => $payload['preview_path'],
                        'updated_at'                => now(),
                    ]);
                }

                $officeIds = array_values(array_unique(array_map('intval', $data['office_ids'] ?? [])));
                foreach ($officeIds as $oid) {
                    DB::table('document_request_recipients')->insert([
                        'request_id'       => $requestId,
                        'office_id'        => $oid,
                        'status'           => 'pending',
                        'last_submitted_at' => null,
                        'last_reviewed_at'  => null,
                        'created_at'       => $now,
                        'updated_at'       => $now,
                    ]);
                }
            } else {
                // multi_doc — one recipient office
                $officeId = (int) $data['office_id'];
                $officeIds = [$officeId];

                DB::table('document_request_recipients')->insert([
                    'request_id'       => $requestId,
                    'office_id'        => $officeId,
                    'status'           => 'pending',
                    'last_submitted_at' => null,
                    'last_reviewed_at'  => null,
                    'created_at'       => $now,
                    'updated_at'       => $now,
                ]);

                // Create items — example files uploaded separately after creation
                foreach (($data['items'] ?? []) as $i => $itemData) {
                    DB::table('document_request_items')->insert([
                        'request_id'  => $requestId,
                        'title'       => $itemData['title'],
                        'description' => $itemData['description'] ?? null,
                        'sort_order'  => $i,
                        'created_at'  => $now,
                        'updated_at'  => $now,
                    ]);
                }
            }

            // Activity log
            ActivityLog::create([
                'document_id'         => null,
                'document_version_id' => null,
                'actor_user_id'       => $user->id,
                'actor_office_id'     => $user->office_id,
                'target_office_id'    => null,
                'event'               => 'document_request.created',
                'label'               => 'Created a document request',
                'meta'                => [
                    'document_request_id' => $requestId,
                    'mode'                => $mode,
                    'office_ids'          => $officeIds,
                    'due_at'              => $data['due_at'] ?? null,
                ],
            ]);

            // Notifications
            $users = User::query()
                ->whereIn('office_id', $officeIds)
                ->select(['id', 'office_id'])
                ->get();

            foreach ($users as $u) {
                Notification::create([
                    'user_id'             => $u->id,
                    'document_id'         => null,
                    'document_version_id' => null,
                    'event'               => 'document_request.created',
                    'title'               => 'New document request',
                    'body'                => $data['title'],
                    'meta'                => [
                        'document_request_id' => $requestId,
                        'office_id'           => (int) $u->office_id,
                    ],
                    'read_at' => null,
                ]);
            }

            return response()->json([
                'message' => 'Document request created.',
                'id'      => $requestId,
            ], 201);
        });
    }

    // ── POST /api/document-requests/{request}/recipients/{recipient}/submit
    public function submit(Request $request, int $requestId, int $recipientId)
    {
        $user     = $request->user();
        $officeId = (int) ($user?->office_id ?? 0);
        if ($officeId <= 0) {
            return response()->json(['message' => 'Your account has no office assigned.'], 422);
        }

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
        if ((int) ($recipient->office_id ?? 0) !== $officeId) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        // For multi_doc, item_id is required
        if ($req->mode === 'multi_doc' && empty($data['item_id'])) {
            return response()->json(['message' => 'item_id is required for multi-document requests.'], 422);
        }

        return DB::transaction(function () use ($request, $data, $user, $officeId, $requestId, $recipientId, $req) {
            $now    = now();
            $itemId = isset($data['item_id']) ? (int) $data['item_id'] : null;

            // attempt_no scoped per recipient + item
            $attemptQuery = DB::table('document_request_submissions')
                ->where('recipient_id', $recipientId);
            if ($itemId) $attemptQuery->where('item_id', $itemId);

            $attemptNo = (int) ($attemptQuery->max('attempt_no') ?? 0) + 1;

            $submissionId = DB::table('document_request_submissions')->insertGetId([
                'recipient_id'           => $recipientId,
                'item_id'                => $itemId,
                'attempt_no'             => $attemptNo,
                'submitted_by_user_id'   => $user->id,
                'note'                   => $data['note'] ?? null,
                'status'                 => 'submitted',
                'qa_reviewed_by_user_id' => null,
                'qa_review_note'         => null,
                'reviewed_at'            => null,
                'created_at'             => $now,
                'updated_at'             => $now,
            ]);

            $files = $request->file('files');
            $i = 1;
            foreach ($files as $f) {
                $payload = $this->files->saveSubmissionFile($submissionId, $f, $i);
                DB::table('document_request_submission_files')->insert([
                    'submission_id'     => $submissionId,
                    'original_filename' => $payload['original_filename'],
                    'file_path'         => $payload['file_path'],
                    'preview_path'      => $payload['preview_path'],
                    'mime'              => $payload['mime'],
                    'size_bytes'        => $payload['size_bytes'],
                    'created_at'        => $now,
                    'updated_at'        => $now,
                ]);
                $i++;
            }

            // Update recipient status
            DB::table('document_request_recipients')
                ->where('id', $recipientId)
                ->update([
                    'status'            => 'submitted',
                    'last_submitted_at' => $now,
                    'updated_at'        => $now,
                ]);

            ActivityLog::create([
                'document_id'         => null,
                'document_version_id' => null,
                'actor_user_id'       => $user->id,
                'actor_office_id'     => $officeId,
                'target_office_id'    => null,
                'event'               => 'document_request.submission.submitted',
                'label'               => 'Submitted document request evidence',
                'meta'                => [
                    'document_request_id' => $requestId,
                    'recipient_id'        => $recipientId,
                    'submission_id'       => $submissionId,
                    'item_id'             => $itemId,
                    'attempt_no'          => $attemptNo,
                ],
            ]);

            // Notify QA
            $qaUsers = User::query()
                ->whereHas('role', fn($q) => $q->whereIn('name', ['QA', 'SYSADMIN']))
                ->select(['id', 'office_id'])
                ->get();

            foreach ($qaUsers as $u) {
                Notification::create([
                    'user_id'             => $u->id,
                    'document_id'         => null,
                    'document_version_id' => null,
                    'event'               => 'document_request.submission.submitted',
                    'title'               => 'Document request submission received',
                    'body'                => 'An office submitted evidence for a document request.',
                    'meta'                => [
                        'document_request_id' => $requestId,
                        'recipient_id'        => $recipientId,
                        'submission_id'       => $submissionId,
                        'from_office_id'      => $officeId,
                    ],
                    'read_at' => null,
                ]);
            }

            return response()->json([
                'message'       => 'Submission uploaded.',
                'submission_id' => $submissionId,
            ], 201);
        });
    }

    // ── POST /api/document-request-submissions/{submission}/review ─────────
    public function review(Request $request, int $submissionId)
    {
        $this->assertQaOrSysadmin($request);

        $data = $request->validate([
            'decision' => 'required|in:accepted,rejected',
            'note'     => 'nullable|string|max:2000',
        ]);

        $user = $request->user();
        $now  = now();

        $submission = DB::table('document_request_submissions')->where('id', $submissionId)->first();
        if (!$submission) return response()->json(['message' => 'Not found'], 404);
        if (($submission->status ?? '') !== 'submitted') {
            return response()->json(['message' => 'Submission is not in submitted status.'], 422);
        }

        $recipient  = DB::table('document_request_recipients')->where('id', $submission->recipient_id)->first();
        if (!$recipient) return response()->json(['message' => 'Recipient not found'], 404);

        $requestRow = DB::table('document_requests')->where('id', $recipient->request_id)->first();

        return DB::transaction(function () use ($data, $user, $now, $submissionId, $submission, $recipient, $requestRow) {
            DB::table('document_request_submissions')->where('id', $submissionId)->update([
                'status'                 => $data['decision'],
                'qa_reviewed_by_user_id' => $user->id,
                'qa_review_note'         => $data['note'] ?? null,
                'reviewed_at'            => $now,
                'updated_at'             => $now,
            ]);

            // For multi_office: update recipient status
            // For multi_doc: only update recipient if ALL items accepted
            if ($requestRow->mode === 'multi_office') {
                DB::table('document_request_recipients')->where('id', $recipient->id)->update([
                    'status'            => $data['decision'] === 'accepted' ? 'accepted' : 'rejected',
                    'last_reviewed_at'  => $now,
                    'updated_at'        => $now,
                ]);
            } else {
                // Check if all items have an accepted latest submission
                $items     = DB::table('document_request_items')->where('request_id', $requestRow->id)->get(['id']);
                $itemIds   = $items->pluck('id')->all();
                $allAccepted = true;

                foreach ($itemIds as $itemId) {
                    $latest = DB::table('document_request_submissions')
                        ->where('recipient_id', $recipient->id)
                        ->where('item_id', $itemId)
                        ->orderByDesc('attempt_no')
                        ->value('status');

                    if ($latest !== 'accepted') {
                        $allAccepted = false;
                        break;
                    }
                }

                DB::table('document_request_recipients')->where('id', $recipient->id)->update([
                    'status'           => $allAccepted ? 'accepted' : 'submitted',
                    'last_reviewed_at' => $now,
                    'updated_at'       => $now,
                ]);
            }

            ActivityLog::create([
                'document_id'         => null,
                'document_version_id' => null,
                'actor_user_id'       => $user->id,
                'actor_office_id'     => $user->office_id,
                'target_office_id'    => (int) ($recipient->office_id ?? null),
                'event'               => 'document_request.submission.reviewed',
                'label'               => $data['decision'] === 'accepted'
                    ? 'Accepted document request submission'
                    : 'Rejected document request submission',
                'meta'                => [
                    'document_request_id' => (int) ($recipient->request_id ?? null),
                    'recipient_id'        => (int) $recipient->id,
                    'submission_id'       => (int) $submissionId,
                    'decision'            => $data['decision'],
                ],
            ]);

            // Notify office users
            $users = User::query()
                ->where('office_id', (int) $recipient->office_id)
                ->select(['id', 'office_id'])
                ->get();

            foreach ($users as $u) {
                Notification::create([
                    'user_id'             => $u->id,
                    'document_id'         => null,
                    'document_version_id' => null,
                    'event'               => $data['decision'] === 'accepted'
                        ? 'document_request.submission.accepted'
                        : 'document_request.submission.rejected',
                    'title'               => $data['decision'] === 'accepted'
                        ? 'Document request submission accepted'
                        : 'Document request submission rejected',
                    'body'                => $requestRow?->title ?? 'Document request update',
                    'meta'                => [
                        'document_request_id' => (int) ($recipient->request_id ?? null),
                        'recipient_id'        => (int) $recipient->id,
                        'submission_id'       => (int) $submissionId,
                        'qa_note'             => $data['note'] ?? null,
                    ],
                    'read_at' => null,
                ]);
            }

            return response()->json(['message' => 'Reviewed.'], 200);
        });
    }

    // GET /api/document-requests/{id}/recipients/{recipientId}
    public function showRecipient(Request $request, int $requestId, int $recipientId)
    {
        $user     = $request->user();
        $role     = $this->roleName($request);
        $officeId = (int) ($user?->office_id ?? 0);
        $isQa     = $this->isQaRole($role);

        $row = DB::table('document_requests')->where('id', $requestId)->first();
        if (!$row) return response()->json(['message' => 'Not found'], 404);

        $recipient = DB::table('document_request_recipients as rr')
            ->join('offices as o', 'o.id', '=', 'rr.office_id')
            ->where('rr.id', $recipientId)
            ->where('rr.request_id', $requestId)
            ->select(['rr.*', 'o.name as office_name', 'o.code as office_code'])
            ->first();

        if (!$recipient) return response()->json(['message' => 'Recipient not found'], 404);

        // Office users can only see their own recipient
        if (!$isQa && (int) ($recipient->office_id ?? 0) !== $officeId) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $requestPayload              = (array) $row;
        $requestPayload['office_id']   = (int) ($recipient->office_id ?? 0);
        $requestPayload['office_name'] = $recipient->office_name ?? null;
        $requestPayload['office_code'] = $recipient->office_code ?? null;

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

        return response()->json([
            'request'           => $requestPayload,
            'recipient'         => $recipient,
            'recipients'        => [],
            'items'             => [],
            'latest_submission' => $latestSubmissionPayload,
            'submissions'       => $submissionsPayload,
        ]);
    }

    // GET /api/document-requests/{id}/items/{itemId}
    public function showItem(Request $request, int $requestId, int $itemId)
    {
        $user     = $request->user();
        $role     = $this->roleName($request);
        $officeId = (int) ($user?->office_id ?? 0);
        $isQa     = $this->isQaRole($role);

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

        if (!$isQa) $recipientQ->where('rr.office_id', $officeId);

        $recipient = $recipientQ->first();
        if (!$recipient) return response()->json(['message' => 'Recipient not found'], 404);

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

        return response()->json([
            'request'           => $requestPayload,
            'recipient'         => $recipient,
            'recipients'        => [],
            'items'             => [],
            'item'              => $item,
            'latest_submission' => $latestSubmissionPayload,
            'submissions'       => $submissionsPayload,
        ]);
    }

    // PATCH /api/document-requests/{id}
    public function update(Request $request, int $requestId)
    {
        $this->assertQaOrSysadmin($request);

        $data = $request->validate([
            'title'       => 'sometimes|string|max:180',
            'description' => 'sometimes|nullable|string',
            'due_at'      => 'sometimes|nullable|date',
        ]);

        $row = DB::table('document_requests')->where('id', $requestId)->first();
        if (!$row) return response()->json(['message' => 'Not found.'], 404);

        $payload = array_filter([
            'title'       => $data['title'] ?? null,
            'description' => array_key_exists('description', $data) ? $data['description'] : null,
            'due_at'      => array_key_exists('due_at', $data) ? $data['due_at'] : null,
        ], fn($v, $k) => array_key_exists($k, $data), ARRAY_FILTER_USE_BOTH);

        if (empty($payload)) {
            return response()->json(['message' => 'Nothing to update.'], 422);
        }

        $payload['updated_at'] = now();

        DB::table('document_requests')->where('id', $requestId)->update($payload);

        ActivityLog::create([
            'document_id'         => null,
            'document_version_id' => null,
            'actor_user_id'       => $request->user()->id,
            'actor_office_id'     => $request->user()->office_id,
            'target_office_id'    => null,
            'event'               => 'document_request.updated',
            'label'               => 'Updated document request',
            'meta'                => ['document_request_id' => $requestId, 'fields' => array_keys($payload)],
        ]);

        return response()->json(['message' => 'Updated.', 'id' => $requestId]);
    }

    // PATCH /api/document-request-items/{id}
    public function updateItem(Request $request, int $itemId)
    {
        $this->assertQaOrSysadmin($request);

        $data = $request->validate([
            'title'       => 'sometimes|string|max:180',
            'description' => 'sometimes|nullable|string',
            'due_at'      => 'sometimes|nullable|date',
        ]);

        $item = DB::table('document_request_items')->where('id', $itemId)->first();
        if (!$item) return response()->json(['message' => 'Item not found.'], 404);

        $payload = array_filter([
            'title'       => $data['title'] ?? null,
            'description' => array_key_exists('description', $data) ? $data['description'] : null,
            'due_at'      => array_key_exists('due_at', $data) ? $data['due_at'] : null,
        ], fn($v, $k) => array_key_exists($k, $data), ARRAY_FILTER_USE_BOTH);

        if (empty($payload)) {
            return response()->json(['message' => 'Nothing to update.'], 422);
        }

        $payload['updated_at'] = now();

        DB::table('document_request_items')->where('id', $itemId)->update($payload);

        ActivityLog::create([
            'document_id'         => null,
            'document_version_id' => null,
            'actor_user_id'       => $request->user()->id,
            'actor_office_id'     => $request->user()->office_id,
            'target_office_id'    => null,
            'event'               => 'document_request_item.updated',
            'label'               => 'Updated document request item',
            'meta'                => [
                'item_id'    => $itemId,
                'request_id' => $item->request_id,
                'fields'     => array_keys($payload),
            ],
        ]);

        return response()->json(['message' => 'Updated.', 'id' => $itemId]);
    }

    // PATCH /api/document-requests/{id}/recipients/{recipientId}
    public function updateRecipient(Request $request, int $requestId, int $recipientId)
    {
        $this->assertQaOrSysadmin($request);

        $data = $request->validate([
            'due_at' => 'sometimes|nullable|date',
        ]);

        $recipient = DB::table('document_request_recipients')
            ->where('id', $recipientId)
            ->where('request_id', $requestId)
            ->first();

        if (!$recipient) return response()->json(['message' => 'Recipient not found.'], 404);

        DB::table('document_request_recipients')
            ->where('id', $recipientId)
            ->update([
                'due_at'     => $data['due_at'] ?? null,
                'updated_at' => now(),
            ]);

        ActivityLog::create([
            'document_id'         => null,
            'document_version_id' => null,
            'actor_user_id'       => $request->user()->id,
            'actor_office_id'     => $request->user()->office_id,
            'target_office_id'    => (int) $recipient->office_id,
            'event'               => 'document_request_recipient.updated',
            'label'               => 'Updated recipient due date',
            'meta'                => [
                'recipient_id' => $recipientId,
                'request_id'   => $requestId,
                'due_at'       => $data['due_at'] ?? null,
            ],
        ]);

        return response()->json(['message' => 'Updated.', 'id' => $recipientId]);
    }
}
