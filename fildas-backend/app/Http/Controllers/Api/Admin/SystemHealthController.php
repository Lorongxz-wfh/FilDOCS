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

class SystemHealthController extends Controller
{
    public function index()
    {
        $status = SystemStatus::first();
        
        // Connectivity Checks
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

        // Disk Usage - Wrapped in safety check for restricted container environments (e.g., Render)
        $totalSpace = 0;
        $freeSpace = 0;
        $usedSpace = 0;
        $diskPercentage = 0;
        
        try {
            $diskPath = base_path();
            // Some environments may disable these functions or the path might not be accessible
            if (function_exists('disk_total_space') && @disk_total_space($diskPath) !== false) {
                $totalSpace = disk_total_space($diskPath);
                $freeSpace = disk_free_space($diskPath);
                $usedSpace = max(0, $totalSpace - $freeSpace);
                $diskPercentage = $totalSpace > 0 ? round(($usedSpace / $totalSpace) * 100, 2) : 0;
            }
        } catch (\Exception $e) {
            // Silently fail disk check to prevent 500 error
        }

        // Active Sessions (last 15 mins) - Safety check for session driver
        $activeSessions = 0;
        try {
            if (config('session.driver') === 'database') {
                $activeSessions = DB::table('sessions')
                    ->where('last_activity', '>=', time() - 900)
                    ->count();
            }
        } catch (\Exception $e) {
            // Silently fail session count to prevent 500 error
        }

        // Check Thresholds & Alert - Only if status and disk data are valid
        if ($status && $totalSpace > 0) {
            $this->checkThresholds($diskPercentage, $status);
        }

        return response()->json([
            'status' => [
                'database' => $dbStatus,
                'cache' => $cacheStatus,
                'storage' => [
                    'total' => $totalSpace,
                    'free' => $freeSpace,
                    'used' => $usedSpace,
                    'percentage' => $diskPercentage,
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
        }

        $status->fill([
            'maintenance_mode' => $validated['mode'],
            'maintenance_message' => $validated['message'],
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
        $status->maintenance_message = $validated['message'] ?? 'System will be undergoing maintenance.';
        $status->is_notified = true;
        
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

        $lines = [];
        $fp = fopen($logPath, "r");
        fseek($fp, 0, SEEK_END);
        $pos = ftell($fp);
        $count = 0;

        while ($pos > 0 && $count < 100) {
            fseek($fp, $pos--);
            $char = fgetc($fp);
            if ($char == "\n") {
                $line = fgets($fp);
                if ($line) {
                    array_unshift($lines, trim($line));
                    $count++;
                }
                fseek($fp, $pos);
            }
        }
        fclose($fp);

        return response()->json(['logs' => implode("\n", $lines)]);
    }

    public function diagnostics()
    {
        $results = [
            'db_latency' => 0,
            'cache_io' => false,
            'storage_io' => false,
            'pusher' => false,
            'timestamp' => now()->toIso8601String()
        ];

        // 1. DB Latency (execute tiny query)
        $start = microtime(true);
        DB::select('SELECT 1');
        $results['db_latency'] = round((microtime(true) - $start) * 1000, 2);

        // 2. Cache IO (Deep)
        try {
            $testKey = 'diag_cache_' . time();
            Cache::put($testKey, 'PASSED', 10);
            $results['cache_io'] = Cache::get($testKey) === 'PASSED';
            Cache::forget($testKey);
        } catch (\Exception $e) {}

        // 3. Storage IO (Write -> Read -> Delete)
        try {
            $testFile = storage_path('app/diag_test_' . time() . '.txt');
            file_put_contents($testFile, 'DIAG_PASSED');
            if (file_get_contents($testFile) === 'DIAG_PASSED') {
                unlink($testFile);
                $results['storage_io'] = true;
            }
        } catch (\Exception $e) {}

        // 4. Pusher Config
        $broadcastDriver = config('broadcasting.default');
        if ($broadcastDriver === 'pusher') {
            $results['pusher'] = !empty(config('broadcasting.connections.pusher.key')) && 
                                !empty(config('broadcasting.connections.pusher.secret')) && 
                                !empty(config('broadcasting.connections.pusher.app_id'));
        } else if ($broadcastDriver === 'reverb') {
            $results['pusher'] = !empty(config('broadcasting.connections.reverb.key'));
        }

        $this->logActivity(request(), 'system.diagnostics_run', "Performed manual system diagnostics", [
            'DB Latency' => $results['db_latency'] . 'ms',
            'Storage IO' => $results['storage_io'] ? 'PASSED' : 'FAILED',
            'Cache IO' => $results['cache_io'] ? 'PASSED' : 'FAILED',
            'Broadcasting' => $results['pusher'] ? 'CONFIGURED' : 'UNCONFIGURED'
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
                $admins = User::whereHas('role', function($q) {
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
        if (!$user) return;

        \App\Models\ActivityLog::create([
            'actor_user_id'   => $user->id,
            'actor_office_id' => $user->office_id ?? null,
            'event'           => $event,
            'label'           => $label,
            'meta'            => $meta,
        ]);
    }
}
