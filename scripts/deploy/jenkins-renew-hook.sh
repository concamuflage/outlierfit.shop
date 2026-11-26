#!/bin/sh
# Loads renewed TLS certificates, e.g. after certbot renew updates jenkins.outlierfit.shop.
set -eu
/usr/sbin/nginx -t
/usr/bin/systemctl reload nginx
