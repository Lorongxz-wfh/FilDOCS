<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: sans-serif; line-height: 1.6; color: #334155; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; }
        .header { background: #ef4444; color: white; padding: 15px; border-radius: 6px 6px 0 0; text-align: center; }
        .content { padding: 20px; background: #fff; }
        .footer { font-size: 12px; color: #94a3b8; text-align: center; margin-top: 20px; }
        .alert-box { background: #fef2f2; border: 1px solid #fee2e2; padding: 15px; border-radius: 6px; color: #991b1b; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>Critical System Alert</h2>
        </div>
        <div class="content">
            <p>Hello Administrator,</p>
            <p>This is an automated health alert from FilDOCS.</p>
            <div class="alert-box">
                <strong>Disk Space Critical:</strong> The system drive is currently at <strong>{{ round($diskPercentage, 1) }}%</strong> usage.
            </div>
            <p>Please log in to the <strong>System Health Hub</strong> to investigate and clear disk space to prevent system instability.</p>
            <p style="margin-top: 30px;">
                <a href="{{ config('app.url') }}/admin/system-health" style="background: #1e293b; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Health Hub</a>
            </p>
        </div>
        <div class="footer">
            <p>&copy; {{ date('Y') }} FilDOCS Document Workflow System</p>
        </div>
    </div>
</body>
</html>
