#!/bin/bash
set -e

cd /var/www/html

echo "=== Clearing config ==="
php artisan config:clear

echo "=== Caching config ==="
php artisan config:cache

echo "=== Storage link ==="
php artisan storage:link --force || true

echo "=== Running migrate:fresh --seed ==="
# php artisan migrate:fresh --force --seed
php artisan migrate --force

echo "=== Backfilling template thumbnails ==="
php artisan templates:backfill-thumbnails || true

echo "=== Starting queue worker ==="
php artisan queue:work --daemon --tries=3 &

echo "=== Migration done, starting server ==="
exec /start.sh
