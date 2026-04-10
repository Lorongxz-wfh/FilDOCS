<x-mail::message>
# Hello, {{ $recipientName }}

You are receiving this email because a login attempt to your **{{ $appName }}** account requires additional verification.

Please use the following code to complete your sign-in:

<x-mail::panel>
<h1 style="text-align: center; letter-spacing: 0.5em; font-family: monospace; margin: 0;">{{ $code }}</h1>
</x-mail::panel>

This code will expire in **5 minutes**.

If you did not attempt to sign in, we recommend that you change your password immediately to secure your account.

Thanks,<br>
The {{ $appName }} Security Team
</x-mail::message>
