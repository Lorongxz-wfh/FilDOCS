<?php
/**
 * FilDAS NUCLEAR UNLOCK: EMERGENCY SIGNAL ERASURE
 * Visit this file in your browser to forcefully clear all restoration locks.
 */

error_reporting(E_ALL);
ini_set('display_errors', 1);

echo "<h1>FilDAS System Unlock</h1>";
echo "<p>Initializing deep signal purification...</p>";

$possibleSignals = [
    __DIR__ . '/../storage/app/restore.json',
    __DIR__ . '/../storage/app/restoration.lock',
    __DIR__ . '/../storage/app/backups/_restore_signal.json',
    __DIR__ . '/../storage/app/_restore_signal.json',
    __DIR__ . '/restore.json',
    __DIR__ . '/_restore_signal.json',
    'C:/Users/Lorongxz/Computer Science Files/FilDASv2/fildas-backend/storage/app/restore.json',
    'C:/Users/Lorongxz/Computer Science Files/FilDASv2/fildas-backend/storage/app/restoration.lock'
];

$clearedCount = 0;
foreach ($possibleSignals as $path) {
    echo "Checking: <code>$path</code> ... ";
    if (file_exists($path)) {
        if (@unlink($path)) {
            echo "<b style='color:green'>ERASED</b><br>";
            $clearedCount++;
        } else {
            echo "<b style='color:red'>FAILED (Permission?)</b><br>";
        }
    } else {
        echo "<span style='color:gray'>NOT FOUND</span><br>";
    }
}

echo "<h3>Total Purged: $clearedCount items.</h3>";
echo "<p>Your UI should now be unlocked. Please refresh the Backup page.</p>";
echo "<a href='/admin/system/backups' style='display:inline-block; padding:10px 20px; background:#3b82f6; color:white; text-decoration:none; border-radius:5px; font-weight:bold; margin-top:20px;'>RETURN TO BACKUP REGISTRY</a>";
