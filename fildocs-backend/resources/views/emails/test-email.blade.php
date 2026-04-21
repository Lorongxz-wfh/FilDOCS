<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: sans-serif; line-height: 1.6; color: #334155; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; }
        .header { background: #0ea5e9; color: white; padding: 15px; border-radius: 6px 6px 0 0; text-align: center; }
        .content { padding: 20px; background: #fff; }
        .footer { font-size: 12px; color: #94a3b8; text-align: center; margin-top: 20px; }
        .success-box { background: #f0fdf4; border: 1px solid #dcfce7; padding: 15px; border-radius: 6px; color: #166534; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>SMTP Configuration Test</h2>
        </div>
        <div class="content">
            <p>Hello {{ $adminName }},</p>
            <p>This is a manual SMTP verification email triggered from the FilDOCS System Health Hub.</p>
            <div class="success-box">
                <strong>Connection Successful:</strong> Your mail server is correctly configured to send system notifications and workflow alerts.
            </div>
            <p style="margin-top: 20px; font-size: 13px; color: #64748b;">
                Sent at: {{ $sentAt }}
            </p>
        </div>
        <div class="footer">
            <p>&copy; {{ date('Y') }} FilDOCS Document Workflow System</p>
        </div>
    </div>
</body>
</html>
