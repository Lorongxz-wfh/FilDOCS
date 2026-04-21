FROM richarvey/nginx-php-fpm:3.1.6

WORKDIR /var/www/html

RUN apk add --no-cache libreoffice openjdk17-jre ttf-dejavu fontconfig

COPY . .

RUN composer install --no-dev --optimize-autoloader

RUN chown -R nginx:nginx /var/www/html/storage /var/www/html/bootstrap/cache

COPY nginx.conf /etc/nginx/sites-available/default.conf

ENV WEBROOT=/var/www/html/public

COPY deploy.sh /deploy.sh
RUN chmod +x /deploy.sh

CMD ["/bin/bash", "/deploy.sh"]
