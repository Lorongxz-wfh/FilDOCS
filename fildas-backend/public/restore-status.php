<?php
/**
 * FilDAS LIFEBOAT: RAW DATABASE MONITOR (v3)
 * This script bypasses the Laravel framework for 100% stability.
 */

error_reporting(0);
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

// 1. Physical Proof (Source of Truth)
$signalFile = __DIR__ . '/_restore_signal.json';
$lockFile = __DIR__ . '/../storage/app/restoration.lock';

if (file_exists($signalFile)) {
    echo file_get_contents($signalFile);
    exit;
}

$isPhysicallyRunning = file_exists($lockFile);

// 2. Resolve Credentials
$dbUrl = getenv('DATABASE_URL');
$driver = getenv('DB_CONNECTION') ?: 'mysql'; // Default to mysql locally
$host = getenv('DB_HOST') ?: '127.0.0.1';
$port = getenv('DB_PORT') ?: ($driver === 'pgsql' ? '5432' : '3306');
$db   = getenv('DB_DATABASE') ?: 'fildas_db';
$user = getenv('DB_USERNAME') ?: 'root';
$pass = getenv('DB_PASSWORD') ?: '';

if ($dbUrl) {
    $parts = parse_url($dbUrl);
    $driver = ($parts['scheme'] === 'postgres' || $parts['scheme'] === 'pgsql') ? 'pgsql' : 'mysql';
    $host = $parts['host'] ?? $host;
    $port = $parts['port'] ?? $port;
    $db   = ltrim($parts['path'] ?? '', '/') ?: $db;
    $user = $parts['user'] ?? $user;
    $pass = $parts['pass'] ?? $pass;
}

try {
    // 3. Connect via Raw PDO (Driver Aware)
    if ($driver === 'pgsql') {
        $dsn = "pgsql:host=$host;port=$port;dbname=$db";
    } else {
        $dsn = "mysql:host=$host;port=$port;dbname=$db;charset=utf8mb4";
    }
    
    $pdo = new PDO($dsn, $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_TIMEOUT => 2
    ]);

    // 4. Query the Heartbeat Key
    $stmt = $pdo->prepare("SELECT value FROM cache WHERE key = :key LIMIT 1");
    $stmt->execute(['key' => 'system_restore_status']);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($row) {
        $val = $row['value'];
        if (strpos($val, '{"') === 0) {
            echo $val;
            exit;
        }
    }

    // Only return running if we have physical proof
    if ($isPhysicallyRunning) {
        echo json_encode(['status' => 'running', 'message' => 'Engine initializing...', 'progress' => 5]);
        exit;
    }

    echo json_encode(['status' => 'idle', 'message' => 'Waiting for engine...', 'progress' => 0]);

} catch (\Throwable $e) {
    // If DB is unreachable, we ONLY show running if the physical lock exists
    if ($isPhysicallyRunning) {
        echo json_encode(['status' => 'running', 'message' => 'Database Syncing...', 'progress' => 10]);
    } else {
        echo json_encode(['status' => 'idle', 'message' => 'Ready.', 'progress' => 0]);
    }
}
