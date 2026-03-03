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

# Start script (we will add deploy.sh next step)
COPY deploy.sh /usr/local/bin/deploy.sh
RUN chmod +x /usr/local/bin/deploy.sh

EXPOSE 80

CMD ["/usr/local/bin/deploy.sh"]
