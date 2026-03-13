FROM richarvey/nginx-php-fpm:3.1.6

WORKDIR /var/www/html

RUN apk add --no-cache libreoffice openjdk17-jre ttf-dejavu fontconfig

COPY . .

RUN composer install --no-dev --optimize-autoloader

RUN chown -R nginx:nginx /var/www/html/storage /var/www/html/bootstrap/cache

COPY nginx.conf /etc/nginx/sites-available/default.conf

RUN mkdir -p /var/www/html/scripts
COPY deploy.sh /var/www/html/scripts/99-deploy.sh
RUN chmod +x /var/www/html/scripts/99-deploy.sh

ENV RUN_SCRIPTS=1
ENV WEBROOT=/var/www/html/public

EXPOSE 80
