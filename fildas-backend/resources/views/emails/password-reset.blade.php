<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>Reset your {{ $appName }} password</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1e293b; -webkit-font-smoothing: antialiased; }
    a { color: inherit; text-decoration: none; }
    img { display: block; border: 0; }

    .wrapper  { max-width: 560px; margin: 32px auto; padding: 0 16px 48px; }
    .card     { background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,.08), 0 4px 16px rgba(0,0,0,.06); }

    .header        { background: #0f172a; padding: 20px 28px; display: flex; align-items: center; gap: 14px; }
    .header-logo   { width: 44px; height: 44px; border-radius: 50%; overflow: hidden; background: #fff; flex-shrink: 0; display: flex; align-items: center; justify-content: center; }
    .header-logo img { width: 44px; height: 44px; border-radius: 50%; object-fit: cover; }
    .header-title  { color: #f8fafc; font-size: 15px; font-weight: 700; letter-spacing: -0.2px; }
    .header-sub    { color: #64748b; font-size: 11px; margin-top: 2px; }

    .banner        { padding: 11px 28px; font-size: 12px; font-weight: 600; letter-spacing: 0.2px; display: flex; align-items: center; gap: 8px; background: #fef3c7; color: #92400e; border-bottom: 1px solid #fde68a; }
    .banner-dot    { width: 7px; height: 7px; border-radius: 50%; background: #f59e0b; flex-shrink: 0; }

    .body      { padding: 28px 28px 24px; }
    .greeting  { font-size: 15px; font-weight: 700; color: #0f172a; margin-bottom: 6px; }
    .message   { font-size: 13px; color: #475569; line-height: 1.65; }

    .cta-wrap { margin: 24px 0 4px; text-align: center; }
    .cta-btn  { display: inline-block; background: #2563eb; color: #ffffff !important; font-size: 13px; font-weight: 600; padding: 11px 28px; border-radius: 8px; text-decoration: none; letter-spacing: 0.1px; }

    .info-block { margin: 20px 0 0; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 18px; }
    .info-text  { font-size: 12px; color: #64748b; line-height: 1.6; }
    .info-text strong { color: #475569; }

    .divider { border: none; border-top: 1px solid #f1f5f9; margin: 0; }

    .footer   { padding: 18px 28px; text-align: center; }
    .footer p { font-size: 11px; color: #94a3b8; line-height: 1.6; }
    .footer a { color: #64748b; text-decoration: underline; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="card">

      {{-- Header --}}
      <div class="header">
        <div class="header-logo">
          <img src="{{ $appUrl }}/favicon.png" alt="{{ $appName }} logo" />
        </div>
        <div>
          <div class="header-title">{{ $appName }}</div>
          <div class="header-sub">Document Workflow System</div>
        </div>
      </div>

      {{-- Banner --}}
      <div class="banner">
        <span class="banner-dot"></span>
        Password Reset Request
      </div>

      {{-- Body --}}
      <div class="body">
        <p class="greeting">Hello, {{ $recipientName }}</p>
        <p class="message">
          We received a request to reset the password for your <strong>{{ $appName }}</strong> account.
          Click the button below to set a new password.
        </p>

        <div class="cta-wrap">
          <a href="{{ $resetUrl }}" class="cta-btn">Reset Password &rarr;</a>
        </div>

        <div class="info-block">
          <p class="info-text">
            This link will expire in <strong>{{ $expiresInMinutes }} minutes</strong>.
            If you did not request a password reset, you can safely ignore this email &mdash; your password will remain unchanged.
          </p>
        </div>
      </div>

      <hr class="divider" />

      {{-- Footer --}}
      <div class="footer">
        <p>
          If you're having trouble clicking the button, copy and paste this URL into your browser:<br />
          <a href="{{ $resetUrl }}" style="word-break: break-all;">{{ $resetUrl }}</a>
        </p>
        <p style="margin-top:6px; color:#cbd5e1;">
          &copy; {{ date('Y') }} {{ $appName }}. All rights reserved.
        </p>
      </div>

    </div>
  </div>
</body>
</html>
