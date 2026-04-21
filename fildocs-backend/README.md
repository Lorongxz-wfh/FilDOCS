<p align="center"><a href="https://laravel.com" target="_blank"><img src="https://raw.githubusercontent.com/laravel/art/master/logo-lockup/5%20SVG/2%20CMYK/1%20Full%20Color/laravel-logolockup-cmyk-red.svg" width="400" alt="Laravel Logo"></a></p>

<p align="center">
<a href="https://github.com/laravel/framework/actions"><img src="https://github.com/laravel/framework/workflows/tests/badge.svg" alt="Build Status"></a>
<a href="https://packagist.org/packages/laravel/framework"><img src="https://img.shields.io/packagist/dt/laravel/framework" alt="Total Downloads"></a>
<a href="https://packagist.org/packages/laravel/framework"><img src="https://img.shields.io/packagist/v/laravel/framework" alt="Latest Stable Version"></a>
<a href="https://packagist.org/packages/laravel/framework"><img src="https://img.shields.io/packagist/l/laravel/framework" alt="License"></a>
</p>

# FilDOCS - Filamer Document Operations and Control System (Backend)

FilDOCS is a document workflow and operations management system designed for Filamer Christian University. 

## Features
- Multi-phase document workflows (Draft → Review → Approval → Finalization)
- Integrated evidence requests and submissions
- Real-time notifications and activity logging
- Two-Factor Authentication (2FA) for enhanced security
- Comprehensive analytics and reporting dashboard

## Technology Stack
- **Framework**: Laravel 12
- **Language**: PHP 8.2+
- **Database**: PostgreSQL / SQLite (for local)
- **Broadcasting**: Pusher / Laravel Echo
- **Auth**: Laravel Sanctum

## Setup
1. Clone the repository
2. Install dependencies: `composer install`
3. Prepare environment: `cp .env.example .env`
4. Generate key: `php artisan key:generate`
5. Run migrations: `php artisan migrate`
6. Start the server: `php artisan serve --port=8001`

## Scripts
- `composer dev`: Run server, queue, and logs concurrently.
- `composer test`: Run PHPUnit tests.
- `composer setup`: Full system installation and setup.

## License
Proprietary and Confidential.

