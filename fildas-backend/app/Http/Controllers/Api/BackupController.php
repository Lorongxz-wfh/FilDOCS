<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Traits\RoleNameTrait;
use App\Models\Document;
use App\Models\DocumentVersion;
use App\Models\User;
use App\Models\ActivityLog;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\StreamedResponse;
use ZipArchive;

class BackupController extends Controller
{
    use RoleNameTrait;

    /**
     * Allowed roles for backup access.
     */
    private function checkBackupAccess(Request $request): void
    {
        $user = $request->user();
        $role = $this->roleNameOf($user);

        if (!in_array($role, ['qa', 'admin', 'sysadmin', 'office_head'], true)) {
            abort(403, 'Unauthorized.');
        }
    }

    /**
     * Parse date range from preset or custom params.
     */
    private function dateRange(Request $request): array
    {
        $preset = $request->query('preset', 'all');

        if ($preset === 'custom') {
            return [
                $request->query('date_from'),
                $request->query('date_to'),
            ];
        }

        $now = now();

        return match ($preset) {
            'today'      => [$now->toDateString(), $now->toDateString()],
            'this_week'  => [$now->startOfWeek()->toDateString(), now()->toDateString()],
            'this_month' => [$now->startOfMonth()->toDateString(), now()->toDateString()],
            default      => [null, null], // 'all'
        };
    }

    /**
     * Build a descriptive filename suffix from date params.
     */
    private function dateSuffix(Request $request): string
    {
        $preset = $request->query('preset', 'all');

        if ($preset === 'all') return 'all-time';
        if ($preset === 'today') return now()->format('Y-m-d');
        if ($preset === 'this_week') return now()->startOfWeek()->format('Y-m-d') . '_to_' . now()->format('Y-m-d');
        if ($preset === 'this_month') return now()->format('Y-m');

        // custom
        $from = $request->query('date_from', 'start');
        $to   = $request->query('date_to', now()->format('Y-m-d'));
        return "{$from}_to_{$to}";
    }

    // ─── Documents CSV ────────────────────────────────────────────────────────

    public function documentsCsv(Request $request): StreamedResponse
    {
        $this->checkBackupAccess($request);
        [$from, $to] = $this->dateRange($request);
        $suffix = $this->dateSuffix($request);

        $query = Document::query()
            ->with(['ownerOffice:id,code,name', 'reviewOffice:id,code,name', 'latestVersion']);

        if ($from) $query->where('documents.created_at', '>=', "{$from} 00:00:00");
        if ($to)   $query->where('documents.created_at', '<=', "{$to} 23:59:59");

        $filename = "fildas-documents-{$suffix}.csv";

        return response()->streamDownload(function () use ($query) {
            $out = fopen('php://output', 'w');
            fprintf($out, chr(0xEF).chr(0xBB).chr(0xBF)); // UTF-8 BOM

            fputcsv($out, [
                'ID', 'Code', 'Title', 'Doc Type', 'Owner Office',
                'Review Office', 'Status', 'Version', 'Created At',
                'Effective Date', 'Distributed At',
            ]);

            $query->orderBy('documents.created_at', 'desc')
                ->chunk(200, function ($docs) use ($out) {
                    foreach ($docs as $doc) {
                        $v = $doc->latestVersion;
                        fputcsv($out, [
                            $doc->id,
                            $doc->code ?? '-',
                            $doc->title,
                            $doc->doctype,
                            $doc->ownerOffice->code ?? '-',
                            $doc->reviewOffice->code ?? '-',
                            $v->status ?? '-',
                            $v->version_number ?? 0,
                            $doc->created_at?->format('Y-m-d H:i'),
                            $v->effective_date ?? '-',
                            $v->distributed_at ?? '-',
                        ]);
                    }
                });

            fclose($out);
        }, $filename, [
            'Content-Type' => 'text/csv',
        ]);
    }

    // ─── Documents ZIP ────────────────────────────────────────────────────────

    public function documentsZip(Request $request, \App\Services\SystemBackupService $service)
    {
        $this->checkBackupAccess($request);
        [$from, $to] = $this->dateRange($request);
        $suffix = $this->dateSuffix($request);
        $saveToSystem = filter_var($request->query('save_to_system', false), FILTER_VALIDATE_BOOLEAN);

        $filename = "fildas-documents-{$suffix}.zip";

        try {
            $tempPath = $service->generateDocumentZip($from, $to);
            \Log::info("Document ZIP generated via Service", ['temp' => $tempPath]);

            if ($saveToSystem) {
                $backupPath = "backups/{$filename}";
                Storage::disk()->put($backupPath, file_get_contents($tempPath));
                @unlink($tempPath);

                return response()->json([
                    'message'  => 'Document backup saved to system list.',
                    'filename' => $filename
                ]);
            }

            return response()->streamDownload(function () use ($tempPath) {
                if (file_exists($tempPath)) {
                    readfile($tempPath);
                    @unlink($tempPath);
                }
            }, $filename, [
                'Content-Type' => 'application/zip',
            ]);

        } catch (\Throwable $e) {
            \Log::error("Backup ZIP failed: 500", [
                'message' => $e->getMessage(),
            ]);
            abort(500, "Backup ZIP failed: " . $e->getMessage());
        }
    }

    // ─── Activity Logs CSV ────────────────────────────────────────────────────

    public function activityCsv(Request $request): StreamedResponse
    {
        $this->checkBackupAccess($request);
        [$from, $to] = $this->dateRange($request);
        $suffix = $this->dateSuffix($request);

        $query = ActivityLog::query()
            ->with([
                'actorUser:id,first_name,last_name',
                'actorOffice:id,code,name',
                'document:id,title,code',
            ]);

        if ($from) $query->where('activity_logs.created_at', '>=', "{$from} 00:00:00");
        if ($to)   $query->where('activity_logs.created_at', '<=', "{$to} 23:59:59");

        $filename = "fildas-activity-{$suffix}.csv";

        return response()->streamDownload(function () use ($query) {
            $out = fopen('php://output', 'w');
            fprintf($out, chr(0xEF).chr(0xBB).chr(0xBF)); // UTF-8 BOM

            fputcsv($out, [
                'ID', 'Event', 'Label', 'Actor', 'Office',
                'Document', 'Document Code', 'Timestamp',
            ]);

            $query->orderBy('activity_logs.created_at', 'desc')
                ->chunk(500, function ($logs) use ($out) {
                    foreach ($logs as $log) {
                        $actorName = trim(($log->actorUser?->first_name ?? '') . ' ' . ($log->actorUser?->last_name ?? '')) ?: '-';
                        fputcsv($out, [
                            $log->id,
                            $log->event,
                            $log->label ?? '-',
                            $actorName,
                            $log->actorOffice?->code ?? '-',
                            $log->document?->title ?? '-',
                            $log->document?->code ?? '-',
                            $log->created_at?->format('Y-m-d H:i:s'),
                        ]);
                    }
                });

            fclose($out);
        }, $filename, [
            'Content-Type' => 'text/csv',
        ]);
    }

    // ─── Users CSV ────────────────────────────────────────────────────────────

    public function usersCsv(Request $request): StreamedResponse
    {
        $this->checkBackupAccess($request);
        $suffix = now()->format('Y-m-d');

        $query = User::query()
            ->whereNull('deleted_at')
            ->with(['role:id,name', 'office:id,code,name']);

        $filename = "fildas-users-{$suffix}.csv";

        return response()->streamDownload(function () use ($query) {
            $out = fopen('php://output', 'w');
            fprintf($out, chr(0xEF).chr(0xBB).chr(0xBF)); // UTF-8 BOM

            fputcsv($out, [
                'ID', 'First Name', 'Last Name', 'Email', 'Role',
                'Office', 'Status', 'Last Active', 'Created At',
            ]);

            $query->orderBy('last_name')->chunk(200, function ($users) use ($out) {
                foreach ($users as $user) {
                    fputcsv($out, [
                        $user->id,
                        $user->first_name,
                        $user->last_name,
                        $user->email,
                        $user->role?->name ?? '-',
                        $user->office?->code ?? '-',
                        $user->disabled_at ? 'Disabled' : 'Active',
                        $user->last_active_at?->format('Y-m-d H:i') ?? '-',
                        $user->created_at?->format('Y-m-d'),
                    ]);
                }
            });

            fclose($out);
        }, $filename, [
            'Content-Type' => 'text/csv',
        ]);
    }

    /**
     * Resilient file lookup across potential disks.
     */
    private function findFileAcrossDisks(?string $path): ?array
    {
        if (!$path) return null;

        $disks = ['local', 'public', 's3'];

        foreach ($disks as $diskName) {
            try {
                $disk = Storage::disk($diskName);
                if ($disk->exists($path)) {
                    return [
                        'disk'     => $diskName,
                        'abs_path' => $disk->path($path),
                    ];
                }
            } catch (\Throwable $e) {
                continue;
            }
        }

        return null;
    }

    // ─── Summary counts (for the UI cards) ────────────────────────────────────

    public function summary(Request $request)
    {
        $this->checkBackupAccess($request);
        [$from, $to] = $this->dateRange($request);

        $docQuery = Document::query();
        if ($from) $docQuery->where('created_at', '>=', "{$from} 00:00:00");
        if ($to)   $docQuery->where('created_at', '<=', "{$to} 23:59:59");

        $versionQuery = DocumentVersion::query()->whereNotNull('file_path')->where('file_path', '!=', '');
        if ($from) $versionQuery->where('created_at', '>=', "{$from} 00:00:00");
        if ($to)   $versionQuery->where('created_at', '<=', "{$to} 23:59:59");
        
        $templateQuery = \App\Models\DocumentTemplate::query()->whereNotNull('file_path')->where('file_path', '!=', '');
        // Note: templates usually don't filter by date range for full backup context, but we can if needed
        
        $reqFileQuery = \App\Models\DocumentRequestSubmissionFile::query()->whereNotNull('file_path')->where('file_path', '!=', '');
        if ($from) $reqFileQuery->where('created_at', '>=', "{$from} 00:00:00");
        if ($to)   $reqFileQuery->where('created_at', '<=', "{$to} 23:59:59");

        $identityCount = User::whereNotNull('profile_photo_path')
            ->where('profile_photo_path', 'NOT LIKE', 'data:%')
            ->count() + 
            User::whereNotNull('signature_path')
            ->where('signature_path', 'NOT LIKE', 'data:%')
            ->count();

        $activityQuery = ActivityLog::query();
        if ($from) $activityQuery->where('created_at', '>=', "{$from} 00:00:00");
        if ($to)   $activityQuery->where('created_at', '<=', "{$to} 23:59:59");

        return response()->json([
            'documents'  => $docQuery->count(),
            'files'      => $versionQuery->count() + $templateQuery->count() + $reqFileQuery->count() + $identityCount,
            'activities' => $activityQuery->count(),
            'users'      => User::whereNull('deleted_at')->count(),
        ]);
    }
}
