<?php
$context = stream_context_create([
    'http' => [
        'method' => 'GET',
        'header' => "Accept: application/json\r\n",
        'ignore_errors' => true
    ]
]);
$result = file_get_contents('http://127.0.0.1:8001/api/system/backups-test', false, $context);
echo "RESPONSE:\n" . $result . "\n";
