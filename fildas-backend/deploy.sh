#!/usr/bin/env sh

cd /var/www/html

php artisan config:clear
php artisan config:cache
php artisan storage:link --force || true
php artisan migrate:fresh --force --seed

# Hand off to the base image's start script
exec /start.sh
