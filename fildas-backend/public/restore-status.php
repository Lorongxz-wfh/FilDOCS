<?php
/**
 * FilDAS LIFEBOAT: RAW DATABASE MONITOR
 * This script bypasses the Laravel framework to remain 100% stable.
 * It queries the shielded cache table directly for high-reliability tracking.
 */

error_reporting(0);
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

// 1. Resolve Credentials (Handle Render DATABASE_URL or Standard Laravel Vars)
$dbUrl = getenv('DATABASE_URL');
$host = getenv('DB_HOST') ?: 'localhost';
$port = getenv('DB_PORT') ?: '5432';
$db   = getenv('DB_DATABASE') ?: 'fildas_db';
$user = getenv('DB_USERNAME') ?: 'root';
$pass = getenv('DB_PASSWORD') ?: '';

if ($dbUrl) {
    $parts = parse_url($dbUrl);
    $host = $parts['host'] ?? $host;
    $port = $parts['port'] ?? $port;
    $db   = ltrim($parts['path'] ?? '', '/') ?: $db;
    $user = $parts['user'] ?? $user;
    $pass = $parts['pass'] ?? $pass;
}

try {
    // 2. Connect via Raw PDO (No Framework Overhead)
    $dsn = "pgsql:host=$host;port=$port;dbname=$db";
    $pdo = new PDO($dsn, $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_TIMEOUT => 2
    ]);

    // 3. Query the Shielded Cache Table for the Heartbeat
    $stmt = $pdo->prepare("SELECT value FROM cache WHERE key = :key LIMIT 1");
    // Standard Laravel cache key logic
    $searchKey = 'fildas_cache' . 'system_restore_status';
    
    $stmt->execute(['key' => $searchKey]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$row) {
        $stmt->execute(['key' => 'system_restore_status']);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
    }

    if ($row) {
        $val = $row['value'];
        // Extract JSON from Laravel serialization
        if (preg_match('/\{"status".*?\}/', $val, $matches)) {
            echo $matches[0];
            exit;
        }
        echo $val;
        exit;
    }

    // 4. Fallback: Secondary check for the local signal file
    $signalFile = __DIR__ . '/_restore_signal.json';
    if (file_exists($signalFile)) {
        echo file_get_contents($signalFile);
        exit;
    }

    echo json_encode(['status' => 'idle', 'message' => 'Waiting for engine...', 'progress' => 0]);

} catch (\Throwable $e) {
    // If DB is unreachable (wiping/syncing), we are definitely running.
    echo json_encode([
        'status' => 'running',
        'message' => 'Database Syncing (Shielded)...',
        'progress' => 10
    ]);
}
