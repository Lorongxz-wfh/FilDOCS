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

    public function documentsZip(Request $request): StreamedResponse
    {
        $this->checkBackupAccess($request);
        [$from, $to] = $this->dateRange($request);
        $suffix = $this->dateSuffix($request);

        $query = DocumentVersion::query()
            ->whereNotNull('file_path')
            ->where('file_path', '!=', '')
            ->with(['document:id,title,code,owner_office_id', 'document.ownerOffice:id,code']);

        if ($from) $query->where('document_versions.created_at', '>=', "{$from} 00:00:00");
        if ($to)   $query->where('document_versions.created_at', '<=', "{$to} 23:59:59");

        $filename = "fildas-documents-{$suffix}.zip";
        $tempPath = storage_path("app/temp/{$filename}");

        // Ensure temp directory exists
        if (!is_dir(dirname($tempPath))) {
            mkdir(dirname($tempPath), 0755, true);
        }

        if (!class_exists('ZipArchive')) {
            abort(500, 'PHP Zip extension is not installed. Please contact administrator.');
        }

        set_time_limit(0); // Prevent timeout for large backups

        $zip = new ZipArchive();
        if ($zip->open($tempPath, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
            abort(500, "Could not create temporary ZIP file at {$tempPath}.");
        }

        $filesAdded = 0;

        // 1. Regular Documents
        $query->orderBy('document_versions.created_at', 'desc')
            ->chunk(100, function ($versions) use ($zip, &$filesAdded) {
                foreach ($versions as $v) {
                    $found = $this->findFileAcrossDisks($v->file_path);
                    
                    if (!$found) {
                        // Resilient Fallback: maybe it's renamed to "original.ext" in the same folder?
                        $dir = dirname($v->file_path);
                        $ext = pathinfo($v->file_path, PATHINFO_EXTENSION);
                        $fallback = "{$dir}/original.{$ext}";
                        $found = $this->findFileAcrossDisks($fallback);
                    }

                    if (!$found) {
                        \Log::warning("Backup ZIP: Document file not found in any disk", ['id' => $v->id, 'path' => $v->file_path]);
                        continue;
                    }

                    $officeCode = $v->document?->ownerOffice?->code ?? 'Unknown';
                    $docCode    = $v->document?->code ?? "doc-{$v->document_id}";
                    $vNum       = $v->version_number;
                    $ext        = pathinfo($v->original_filename ?? $v->file_path, PATHINFO_EXTENSION) ?: 'pdf';
                    $date       = $v->created_at?->format('Y-m-d') ?? 'Unknown Date';

                    $entryName = "{$officeCode}/Created Documents/{$date}/{$docCode}_v{$vNum}.{$ext}";
                    $zip->addFile($found['abs_path'], $entryName);
                    $filesAdded++;
                }
            });

        // 2. Document Request Files
        $reqQuery = \App\Models\DocumentRequestSubmissionFile::query()
            ->whereNotNull('file_path')
            ->where('file_path', '!=', '')
            ->with([
                'submission.recipient.office:id,code',
                'submission.recipient.request:id,title',
                'submission.item:id,title'
            ]);

        if ($from) $reqQuery->where('document_request_submission_files.created_at', '>=', "{$from} 00:00:00");
        if ($to)   $reqQuery->where('document_request_submission_files.created_at', '<=', "{$to} 23:59:59");

        $reqQuery->orderBy('document_request_submission_files.created_at', 'desc')
            ->chunk(100, function ($files) use ($zip, &$filesAdded) {
                foreach ($files as $f) {
                    $found = $this->findFileAcrossDisks($f->file_path);

                    if (!$found) {
                        $dir = dirname($f->file_path);
                        $ext = pathinfo($f->file_path, PATHINFO_EXTENSION);
                        $fallback = "{$dir}/original.{$ext}";
                        $found = $this->findFileAcrossDisks($fallback);
                    }

                    if (!$found) {
                        \Log::warning("Backup ZIP: Request file not found in any disk", ['id' => $f->id, 'path' => $f->file_path]);
                        continue;
                    }

                    $officeCode = $f->submission?->recipient?->office?->code ?? 'Unknown';
                    $date       = $f->created_at?->format('Y-m-d') ?? 'Unknown Date';

                    // Sanitize titles for filesystem safety
                    $safeReqTitle  = preg_replace('/[^A-Za-z0-9_\- ]/', '', $f->submission?->recipient?->request?->title ?? "Req-{$f->submission_id}");
                    $safeItemTitle = preg_replace('/[^A-Za-z0-9_\- ]/', '', $f->submission?->item?->title ?? "Item-{$f->id}");
                    $safeReqTitle  = substr(trim($safeReqTitle), 0, 50);
                    $safeItemTitle = substr(trim($safeItemTitle), 0, 50);
                    
                    $ext      = pathinfo($f->original_filename ?? $f->file_path, PATHINFO_EXTENSION) ?: 'pdf';
                    $fileName = "{$safeReqTitle} - {$safeItemTitle}.{$ext}";

                    $entryName = "{$officeCode}/Document Requests/{$date}/{$fileName}";
                    $zip->addFile($found['abs_path'], $entryName);
                    $filesAdded++;
                }
            });

        if ($filesAdded === 0) {
            $zip->addFromString('readme.txt', 'No document files found in the specified range across local or public storage.');
        }

        $zip->close();

        return response()->streamDownload(function () use ($tempPath) {
            readfile($tempPath);
            @unlink($tempPath);
        }, $filename, [
            'Content-Type' => 'application/zip',
        ]);
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
        
        $reqFileQuery = \App\Models\DocumentRequestSubmissionFile::query()->whereNotNull('file_path')->where('file_path', '!=', '');
        if ($from) $reqFileQuery->where('created_at', '>=', "{$from} 00:00:00");
        if ($to)   $reqFileQuery->where('created_at', '<=', "{$to} 23:59:59");

        $activityQuery = ActivityLog::query();
        if ($from) $activityQuery->where('created_at', '>=', "{$from} 00:00:00");
        if ($to)   $activityQuery->where('created_at', '<=', "{$to} 23:59:59");

        return response()->json([
            'documents'  => $docQuery->count(),
            'files'      => $versionQuery->count() + $reqFileQuery->count(),
            'activities' => $activityQuery->count(),
            'users'      => User::whereNull('deleted_at')->count(),
        ]);
    }
}
