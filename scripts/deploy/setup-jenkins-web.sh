#!/usr/bin/env bash
# Installs the Jenkins HTTPS gateway, e.g. sudo bash /tmp/setup-jenkins-web.sh.
# Upload jenkins-nginx.conf, jenkins-renew-hook.sh, and a private jenkins-cloudflare.ini into /tmp first.
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
test "$(id -u)" = 0
test -s /tmp/jenkins-nginx.conf
test -s /tmp/jenkins-renew-hook.sh
test -s /tmp/jenkins-cloudflare.ini

apt-get -o Acquire::Languages=none update
apt-get install -y nginx certbot python3-certbot-dns-cloudflare
install -d -m 700 /etc/letsencrypt/credentials
install -m 600 /tmp/jenkins-cloudflare.ini /etc/letsencrypt/credentials/outlierfit-cloudflare.ini
rm -f /tmp/jenkins-cloudflare.ini
certbot certonly --dns-cloudflare \
  --dns-cloudflare-credentials /etc/letsencrypt/credentials/outlierfit-cloudflare.ini \
  --dns-cloudflare-propagation-seconds 30 --non-interactive --agree-tos \
  --email apple_banana_2026@proton.me --cert-name jenkins.outlierfit.shop -d jenkins.outlierfit.shop

# Renewed certificate files are not picked up by nginx until it reloads.
install -d /etc/letsencrypt/renewal-hooks/deploy
install -m 755 /tmp/jenkins-renew-hook.sh /etc/letsencrypt/renewal-hooks/deploy/outlierfit-nginx
install -m 644 /tmp/jenkins-nginx.conf /etc/nginx/sites-available/outlierfit-jenkins
ln -sfn /etc/nginx/sites-available/outlierfit-jenkins /etc/nginx/sites-enabled/outlierfit-jenkins
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl enable --now nginx certbot.timer
systemctl reload nginx
echo 'Jenkins HTTPS gateway ready; the controller must remain bound to 127.0.0.1:8080.'
