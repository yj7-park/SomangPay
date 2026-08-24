FROM nginx:alpine

# OpenSSL 설치 및 자체 서명 SSL 인증서 자동 생성
RUN apk add --no-cache openssl && \
    mkdir -p /etc/nginx/ssl && \
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/nginx/ssl/key.pem \
    -out /etc/nginx/ssl/cert.pem \
    -subj "/CN=192.168.123.103"

COPY nginx.conf /etc/nginx/conf.d/default.conf

COPY index.html /usr/share/nginx/html/
COPY kiosk.html /usr/share/nginx/html/
COPY user.html /usr/share/nginx/html/
COPY admin.html /usr/share/nginx/html/
COPY manifest.json /usr/share/nginx/html/
COPY manifest-user.json /usr/share/nginx/html/
COPY manifest-admin.json /usr/share/nginx/html/
COPY favicon.ico /usr/share/nginx/html/
COPY sw.js /usr/share/nginx/html/
COPY jsQR.min.js /usr/share/nginx/html/
COPY src /usr/share/nginx/html/src/
COPY icons /usr/share/nginx/html/icons/

EXPOSE 80 443 3000
CMD ["nginx", "-g", "daemon off;"]
