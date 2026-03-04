#!/usr/bin/env sh
set -e

cd /var/www/html

# Keep boot light on free instances; cache later once stable
php artisan migrate --force || true
php artisan db:seed --force || true

# Do NOT start services here; the base image startup (/start.sh) handles nginx+php-fpm
exit 0
