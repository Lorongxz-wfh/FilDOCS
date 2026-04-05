<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\SystemStatus;
use App\Models\User;
use App\Mail\SystemHealthAlertMail;
use App\Mail\SystemTestMail;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;

class SystemHealthController extends Controller
{
    public function index()
    {
        $status = SystemStatus::first();

        // 1. Connectivity Checks
        $dbStatus = true;
        try {
            DB::connection()->getPdo();
        } catch (\Exception $e) {
            $dbStatus = false;
        }

        $cacheStatus = true;
        try {
            Cache::put('health_check', true, 5);
            $cacheStatus = Cache::get('health_check') === true;
        } catch (\Exception $e) {
            $cacheStatus = false;
        }

        // 2. Database Size Info
        $dbInfo = $this->getDatabaseSize();

        // 3. Storage Context & Connectivity
        $storageDriver = config('filesystems.default');
        $storageConnected = true;
        $storageBucket = null;
        $storageErrorKind = null;

        if ($storageDriver === 's3' || $storageDriver === 'r2') {
            $storageBucket = config('filesystems.disks.' . $storageDriver . '.bucket') ?? config('filesystems.disks.s3.bucket');
            try {
                // Testing object-level connectivity (Write -> Delete) 
                // allFiles() is often blocked by API tokens that lack "List Bucket" permissions.
                $testPath = '.healthcheck_' . time();
                Storage::disk()->put($testPath, 'health_status:ok');
                if (Storage::disk()->exists($testPath)) {
                    Storage::disk()->delete($testPath);
                    $storageConnected = true;
                }
            } catch (\Exception $e) {
                $storageErrorKind = $e->getMessage();
                \Log::error("SystemHealth: Storage connectivity failed: " . $storageErrorKind);
                $storageConnected = false;
            }
        }

        // 4. Node/System Disk Usage (Removed - confusing for cloud setups)
        $totalSpace = 0;
        $diskPercentage = 0;


        // Active Sessions (last 15 mins)
        $activeSessions = 0;
        try {
            if (config('session.driver') === 'database') {
                $activeSessions = DB::table('sessions')
                    ->where('last_activity', '>=', time() - 900)
                    ->count();
            }
        } catch (\Exception $e) {
        }

        // Check Thresholds & Alert
        if ($status && $totalSpace > 0) {
            $this->checkThresholds($diskPercentage, $status);
        }

        return response()->json([
            'status' => [
                'database' => $dbStatus,
                'database_info' => $dbInfo,
                'cache' => [
                    'active' => $cacheStatus,
                    'driver' => Cache::getDefaultDriver()
                ],
                'storage' => [
                    'driver' => $storageDriver,
                    'connected' => $storageConnected,
                    'bucket' => $storageBucket,
                    'error' => $storageErrorKind ?? null,
                ],
                'mail' => !empty(config('mail.mailers.smtp.host')),
            ],
            'maintenance' => [
                'mode' => $status->maintenance_mode ?? 'off',
                'message' => $status->maintenance_message ?? '',
                'expires_at' => $status->maintenance_expires_at ?? null,
                'starts_at' => ($status && $status->maintenance_starts_at) ? $status->maintenance_starts_at->toIso8601String() : null,
                'is_notified' => $status->is_notified ?? false,
            ],
            'active_sessions' => $activeSessions,
            'server_info' => [
                'php_version' => PHP_VERSION,
                'laravel_version' => app()->version(),
                'server_time' => now()->toIso8601String(),
            ]
        ]);
    }

    public function update(Request $request)
    {
        $validated = $request->validate([
            'mode' => 'required|in:off,soft,hard',
            'message' => 'nullable|string',
        ]);

        $status = SystemStatus::first() ?? new SystemStatus();

        // If turning OFF, clear scheduling
        if ($validated['mode'] === 'off') {
            $status->maintenance_starts_at = null;
            $status->is_notified = false;
            
            // Broadcast cancellation so banners disappear immediately
            broadcast(new \App\Events\MaintenanceCancelled());
        }

        $status->fill([
            'maintenance_mode' => $validated['mode'],
            'maintenance_message' => $validated['message'] ?? ($validated['mode'] !== 'off' ? 'System is currently undergoing maintenance.' : null),
        ]);

        $status->save();

        $this->logActivity($request, 'system.maintenance_updated', "Updated maintenance mode to " . strtoupper($validated['mode']), [
            'Mode' => strtoupper($validated['mode']),
            'Message' => $validated['message'] ?? 'N/A'
        ]);

        return response()->json([
            'message' => 'Maintenance status updated.',
            'status' => $status
        ]);
    }

    /**
     * Schedule maintenance in the future.
     */
    public function schedule(Request $request)
    {
        $validated = $request->validate([
            'minutes' => 'required|integer|min:1|max:1440',
            'message' => 'nullable|string',
            'mode' => 'required|in:soft,hard'
        ]);

        $startsAt = now()->addMinutes($validated['minutes']);

        $status = SystemStatus::first() ?? new SystemStatus();
        $status->maintenance_starts_at = $startsAt;
        $status->maintenance_message = $validated['message'] ?? 'System maintenance is scheduled. Please save your work.';
        $status->is_notified = true;
        $status->maintenance_mode = $validated['mode']; 

        // When scheduled, we force the mode initially to 'off' or keep current, 
        // the middleware will handle the transition once the time arrives.
        $status->save();

        $this->logActivity($request, 'system.maintenance_scheduled', "Scheduled maintenance in {$validated['minutes']} minutes", [
            'Minutes' => $validated['minutes'],
            'Expected Start' => $startsAt->toDateTimeString(),
            'Lock Mode' => strtoupper($validated['mode']),
            'Message' => $validated['message'] ?? 'N/A'
        ]);

        // Broadcast to all users
        broadcast(new \App\Events\MaintenanceScheduled(
            $startsAt->toIso8601String(),
            $status->maintenance_message
        ));

        return response()->json([
            'message' => "Maintenance scheduled in {$validated['minutes']} minutes.",
            'starts_at' => $startsAt->toIso8601String()
        ]);
    }

    /**
     * Cancel a scheduled maintenance.
     */
    public function cancel()
    {
        $status = SystemStatus::first();
        if ($status) {
            $status->maintenance_starts_at = null;
            $status->is_notified = false;
            $status->save();

            $this->logActivity(request(), 'system.maintenance_cancelled', "Cancelled scheduled maintenance");
        }

        broadcast(new \App\Events\MaintenanceCancelled());

        return response()->json(['message' => 'Scheduled maintenance cancelled.']);
    }

    public function logs()
    {
        $logPath = storage_path('logs/laravel.log');
        if (!file_exists($logPath)) {
            return response()->json(['logs' => 'Log file not found.']);
        }

        // ── Optimized Tail implementation (Chunked) ──
        $lines = [];
        $fp = fopen($logPath, "r");
        $chunkSize = 4096;
        fseek($fp, 0, SEEK_END);
        $pos = ftell($fp);
        $buffer = '';

        while ($pos > 0 && count($lines) < 100) {
            $readSize = min($pos, $chunkSize);
            $pos -= $readSize;
            fseek($fp, $pos);
            $chunk = fread($fp, $readSize);
            $buffer = $chunk . $buffer;

            // split into lines and count back from end
            $currentLines = explode("\n", $buffer);
            if (count($currentLines) > 100) {
                $lines = array_slice($currentLines, -100);
                break;
            }
            $lines = $currentLines;
        }
        fclose($fp);

        return response()->json(['logs' => implode("\n", array_filter($lines))]);
    }

    public function diagnostics()
    {
        $results = [
            'db_latency' => 0,
            'cache_io' => false,
            'storage_io' => false,
            'pusher' => false,
            'broadcasting_driver' => config('broadcasting.default'),
            'timestamp' => now()->toIso8601String()
        ];

        // 1. DB Latency (execute tiny query)
        try {
            $start = microtime(true);
            DB::select('SELECT 1');
            $results['db_latency'] = round((microtime(true) - $start) * 1000, 2);
        } catch (\Exception $e) {
        }

        // 2. Cache IO (Deep)
        try {
            $testKey = 'diag_cache_' . time();
            Cache::put($testKey, 'PASSED', 10);
            $results['cache_io'] = Cache::get($testKey) === 'PASSED';
            Cache::forget($testKey);
        } catch (\Exception $e) {
        }

        // 3. Storage IO (Write -> Read -> Delete)
        try {
            $testPath = 'diag_test_' . time() . '.txt';
            Storage::disk()->put($testPath, 'DIAG_PASSED');
            
            if (Storage::disk()->exists($testPath)) {
                if (Storage::disk()->get($testPath) === 'DIAG_PASSED') {
                    Storage::disk()->delete($testPath);
                    $results['storage_io'] = true;
                }
            }
        } catch (\Exception $e) {
            \Log::error("Diagnostics Storage IO error: " . $e->getMessage());
        }

        // 4. Broadcasting check based on driver
        $driver = $results['broadcasting_driver'];
        if ($driver === 'pusher') {
            $results['pusher'] = !empty(config('broadcasting.connections.pusher.key')) &&
                !empty(config('broadcasting.connections.pusher.secret')) &&
                !empty(config('broadcasting.connections.pusher.app_id'));
        } else if ($driver === 'reverb') {
            $results['pusher'] = !empty(config('broadcasting.connections.reverb.key'));
        } else if ($driver === 'log' || $driver === 'null') {
            // Log/Null drivers are effectively always 'configured' correctly
            $results['pusher'] = true;
        }

        $this->logActivity(request(), 'system.diagnostics_run', "Performed manual system diagnostics", [
            'DB Latency' => $results['db_latency'] . 'ms',
            'Storage IO' => $results['storage_io'] ? 'PASSED' : 'FAILED',
            'Cache IO' => $results['cache_io'] ? 'PASSED' : 'FAILED',
            'Broadcasting' => $results['pusher'] ? 'CONFIGURED (' . strtoupper($driver) . ')' : 'UNCONFIGURED'
        ]);

        return response()->json($results);
    }

    public function sendTestMail(Request $request)
    {
        try {
            Mail::to($request->user()->email)->send(new SystemTestMail($request->user()->full_name, now()->toDateTimeString()));

            $this->logActivity($request, 'system.test_mail_sent', "Sent system test email to " . $request->user()->email);

            return response()->json(['message' => 'Test email sent successfully to your account.']);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Email failed: ' . $e->getMessage()], 500);
        }
    }

    protected function checkThresholds($diskPercentage, $status)
    {
        // Alert if disk > 90% (less than 10% free) AND we haven't alerted in the last 24 hours
        if ($diskPercentage >= 90) {
            $lastAlert = $status->last_disk_alert_at;

            if (!$lastAlert || $lastAlert->diffInHours(now()) >= 24) {
                $admins = User::whereHas('role', function ($q) {
                    $q->whereIn('name', ['Admin', 'SysAdmin']);
                })->get();

                foreach ($admins as $admin) {
                    Mail::to($admin->email)->send(new SystemHealthAlertMail($diskPercentage));
                }

                $status->update(['last_disk_alert_at' => now()]);
                Log::warning("Disk space threshold exceeded: {$diskPercentage}%. Alerts sent to admins.");
            }
        }
    }

    private function logActivity($request, string $event, string $label, array $meta = []): void
    {
        $user = $request instanceof Request ? $request->user() : auth()->user();
        if (!$user)
            return;

        \App\Models\ActivityLog::create([
            'actor_user_id' => $user->id,
            'actor_office_id' => $user->office_id ?? null,
            'event' => $event,
            'label' => $label,
            'meta' => $meta,
        ]);
    }

    private function getDatabaseSize(): array
    {
        $connection = config('database.default');
        $driver = config("database.connections.{$connection}.driver");
        $sizeBytes = 0;
        $formatted = '0 B';

        try {
            if ($driver === 'pgsql') {
                $res = DB::select("SELECT pg_database_size(current_database()) as size");
                $sizeBytes = $res[0]->size ?? 0;
            } else if ($driver === 'mysql') {
                $res = DB::select("SELECT SUM(data_length + index_length) AS size FROM information_schema.TABLES WHERE table_schema = DATABASE()");
                $sizeBytes = $res[0]->size ?? 0;
            }

            $formatted = $this->formatBytes($sizeBytes);
        } catch (\Exception $e) {
        }

        return [
            'bytes' => $sizeBytes,
            'formatted' => $formatted,
            'driver' => $driver
        ];
    }

    private function formatBytes($bytes, $precision = 2): string
    {
        $units = ['B', 'KB', 'MB', 'GB', 'TB'];
        $bytes = max($bytes, 0);
        $pow = floor(($bytes ? log($bytes) : 0) / log(1024));
        $pow = min($pow, count($units) - 1);
        $bytes /= (1 << (10 * $pow));

        return round($bytes, $precision) . ' ' . $units[$pow];
    }

    /**
     * Publicly accessible maintenance status for the banner.
     * Does not require admin middleware.
     */
    public function maintenance()
    {
        $status = SystemStatus::first();

        return response()->json([
            'maintenance' => [
                'mode' => $status->maintenance_mode ?? 'off',
                'message' => $status->maintenance_message ?? '',
                'expires_at' => $status->maintenance_expires_at ?? null,
                'starts_at' => ($status && $status->maintenance_starts_at) ? $status->maintenance_starts_at->toIso8601String() : null,
            ]
        ]);
    }
}
