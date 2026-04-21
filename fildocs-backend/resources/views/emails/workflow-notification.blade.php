<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>{{ $notifTitle }}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1e293b; -webkit-font-smoothing: antialiased; }
    a { color: inherit; text-decoration: none; }
    img { display: block; border: 0; }

    .wrapper  { max-width: 560px; margin: 32px auto; padding: 0 16px 48px; }
    .card     { background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,.08), 0 4px 16px rgba(0,0,0,.06); }

    /* Header */
    .header        { background: #0f172a; padding: 20px 28px; display: flex; align-items: center; gap: 20px; }
    .header-logo   { width: 44px; height: 44px; border-radius: 50%; overflow: hidden; background: #fff; flex-shrink: 0; display: flex; align-items: center; justify-content: center; }
    .header-logo img { width: 44px; height: 44px; border-radius: 50%; object-fit: cover; }
    .header-title  { color: #f8fafc; font-size: 15px; font-weight: 700; letter-spacing: -0.2px; line-height: 1.3; }
    .header-sub    { color: #64748b; font-size: 11px; margin-top: 2px; }

    /* Status banner */
    .banner          { padding: 11px 28px; font-size: 12px; font-weight: 600; letter-spacing: 0.2px; display: flex; align-items: center; gap: 8px; }
    .banner-action   { background: #eff6ff; color: #1d4ed8; border-bottom: 1px solid #bfdbfe; }
    .banner-reject   { background: #fff1f2; color: #be123c;  border-bottom: 1px solid #fecdd3; }
    .banner-dot      { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
    .dot-action      { background: #3b82f6; }
    .dot-reject      { background: #f43f5e; }

    /* Body */
    .body      { padding: 28px 28px 24px; }
    .greeting  { font-size: 15px; font-weight: 700; color: #0f172a; margin-bottom: 6px; }
    .message   { font-size: 13px; color: #475569; line-height: 1.65; }

    /* Document card */
    .doc-card   { margin: 20px 0; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 18px; }
    .doc-label  { font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8; margin-bottom: 5px; }
    .doc-title  { font-size: 14px; font-weight: 700; color: #0f172a; line-height: 1.4; }
    .doc-meta   { margin-top: 10px; }
    .doc-badge  { display: inline-flex; align-items: center; border-radius: 999px; padding: 3px 10px; font-size: 11px; font-weight: 600; }
    .badge-action { background: #dbeafe; color: #1d4ed8; }
    .badge-reject { background: #ffe4e6; color: #be123c; }

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
          <div class="header-sub">Document Operations and Control System</div>
        </div>
      </div>

      {{-- Status banner --}}
      @if($isReject)
        <div class="banner banner-reject">
          <span class="banner-dot dot-reject"></span>
          Revision Required
        </div>
      @elseif(str_contains(strtolower($notifTitle), 'approval'))
        <div class="banner" style="background: #ecfdf5; color: #047857; border-bottom: 1px solid #d1fae5;">
          <span class="banner-dot" style="background: #10b981;"></span>
          Approval Required
        </div>
      @else
        <div class="banner banner-action">
          <span class="banner-dot dot-action"></span>
          Review Required
        </div>
      @endif

      {{-- Body --}}
      <div class="body">
        <p class="greeting">Hello, {{ $recipientName }}</p>
        <p class="message">
          {!! $notifBody !!}
        </p>

        {{-- Document/Request card --}}
        <div class="doc-card">
          <div class="doc-label">{{ $cardLabel }}</div>
          <div class="doc-title">{{ $documentTitle }}</div>
          <div class="doc-meta">
            <span class="doc-badge {{ $isReject ? 'badge-reject' : 'badge-action' }}">
              {{ $documentStatus }}
            </span>
          </div>
        </div>

        {{-- CTA --}}
        @if($documentId || $overrideLinkUrl)
          <div class="cta-wrap">
            <a href="{{ $overrideLinkUrl ?? ($appUrl . '/document-flow/' . $documentId) }}" class="cta-btn">
              Open {{ $cardLabel }} &rarr;
            </a>
          </div>
        @endif
      </div>

      <hr class="divider" />

      {{-- Footer --}}
      <div class="footer">
        <p>
          You received this email because you have email notifications enabled in {{ $appName }}.<br />
          To manage your preferences, visit <a href="{{ $appUrl }}/settings">Settings &rarr; Notifications</a>.
        </p>
        <p style="margin-top:6px; color:#cbd5e1;">
          &copy; {{ date('Y') }} {{ $appName }}. All rights reserved.
        </p>
      </div>

    </div>
  </div>
</body>
</html>
