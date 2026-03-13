#!/usr/bin/env sh
set -e

cd /var/www/html

php artisan config:clear || true
php artisan config:cache || true
php artisan storage:link --force || true
php artisan migrate:fresh --force --seed || true
