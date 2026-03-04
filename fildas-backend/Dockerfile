FROM richarvey/nginx-php-fpm:3.1.6

WORKDIR /var/www/html

# Copy app
COPY . .

# Install PHP dependencies
RUN composer install --no-dev --optimize-autoloader

# Laravel required writable dirs
RUN chown -R nginx:nginx /var/www/html/storage /var/www/html/bootstrap/cache

# Nginx config (we will add nginx.conf next step)
COPY nginx.conf /etc/nginx/sites-available/default.conf

# Base image start.sh runs scripts in /var/www/html/scripts when RUN_SCRIPTS=1
RUN mkdir -p /var/www/html/scripts
COPY deploy.sh /var/www/html/scripts/99-deploy.sh
RUN chmod +x /var/www/html/scripts/99-deploy.sh

EXPOSE 80
# Important: keep base image default CMD/entrypoint so it starts php-fpm + nginx
