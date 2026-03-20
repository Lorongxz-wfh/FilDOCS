<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>Your {{ $appName }} account is ready</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1e293b; -webkit-font-smoothing: antialiased; }
    a { color: inherit; text-decoration: none; }
    img { display: block; border: 0; }

    .wrapper  { max-width: 560px; margin: 32px auto; padding: 0 16px 48px; }
    .card     { background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,.08), 0 4px 16px rgba(0,0,0,.06); }

    /* Header */
    .header        { background: #0f172a; padding: 20px 28px; display: flex; align-items: center; gap: 14px; }
    .header-logo   { width: 44px; height: 44px; border-radius: 50%; overflow: hidden; background: #fff; flex-shrink: 0; display: flex; align-items: center; justify-content: center; }
    .header-logo img { width: 44px; height: 44px; border-radius: 50%; object-fit: cover; }
    .header-title  { color: #f8fafc; font-size: 15px; font-weight: 700; letter-spacing: -0.2px; }
    .header-sub    { color: #64748b; font-size: 11px; margin-top: 2px; }

    /* Banner */
    .banner        { padding: 11px 28px; font-size: 12px; font-weight: 600; letter-spacing: 0.2px; display: flex; align-items: center; gap: 8px; background: #f0fdf4; color: #15803d; border-bottom: 1px solid #bbf7d0; }
    .banner-dot    { width: 7px; height: 7px; border-radius: 50%; background: #22c55e; flex-shrink: 0; }

    /* Body */
    .body      { padding: 28px 28px 24px; }
    .greeting  { font-size: 15px; font-weight: 700; color: #0f172a; margin-bottom: 6px; }
    .message   { font-size: 13px; color: #475569; line-height: 1.65; }

    /* Password block */
    .pw-block   { margin: 20px 0; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 18px; }
    .pw-label   { font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8; margin-bottom: 8px; }
    .pw-code    { font-family: 'Courier New', Courier, monospace; font-size: 20px; font-weight: 700; letter-spacing: 3px; color: #0f172a; background: #e2e8f0; border-radius: 6px; padding: 10px 16px; display: inline-block; }
    .pw-note    { font-size: 11px; color: #94a3b8; margin-top: 10px; }

    /* CTA */
    .cta-wrap { margin: 24px 0 4px; text-align: center; }
    .cta-btn  { display: inline-block; background: #2563eb; color: #ffffff !important; font-size: 13px; font-weight: 600; padding: 11px 28px; border-radius: 8px; text-decoration: none; letter-spacing: 0.1px; }

    /* Divider */
    .divider { border: none; border-top: 1px solid #f1f5f9; margin: 0; }

    /* Footer */
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
        Your account is ready
      </div>

      {{-- Body --}}
      <div class="body">
        <p class="greeting">Hello, {{ $recipientName }}</p>
        <p class="message">
          Your <strong>{{ $appName }}</strong> account has been created by an administrator.
          Use the temporary password below to log in, then update it from <strong>Settings &rarr; Change Password</strong>.
        </p>

        {{-- Password card --}}
        <div class="pw-block">
          <div class="pw-label">Temporary Password</div>
          <span class="pw-code">{{ $tempPassword }}</span>
          <p class="pw-note">For security, please change this password after your first login.</p>
        </div>

        {{-- CTA --}}
        <div class="cta-wrap">
          <a href="{{ $appUrl }}/login" class="cta-btn">Log in to {{ $appName }} &rarr;</a>
        </div>
      </div>

      <hr class="divider" />

      {{-- Footer --}}
      <div class="footer">
        <p>
          If you did not expect this email, please contact your system administrator.<br />
          Do not share your password with anyone.
        </p>
        <p style="margin-top:6px; color:#cbd5e1;">
          &copy; {{ date('Y') }} {{ $appName }}. All rights reserved.
        </p>
      </div>

    </div>
  </div>
</body>
</html>
