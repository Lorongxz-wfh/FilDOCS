FROM richarvey/nginx-php-fpm:3.1.6

WORKDIR /var/www/html

# Install LibreOffice for PDF preview generation
RUN apk add --no-cache libreoffice openjdk11-jre

# Copy app
COPY . .

# Install PHP dependencies
RUN composer install --no-dev --optimize-autoloader

# Laravel required writable dirs
RUN chown -R nginx:nginx /var/www/html/storage /var/www/html/bootstrap/cache

# Nginx config
COPY nginx.conf /etc/nginx/sites-available/default.conf

# Base image start.sh runs scripts in /var/www/html/scripts when RUN_SCRIPTS=1
RUN mkdir -p /var/www/html/scripts
COPY deploy.sh /var/www/html/scripts/99-deploy.sh
RUN chmod +x /var/www/html/scripts/99-deploy.sh

EXPOSE 80
