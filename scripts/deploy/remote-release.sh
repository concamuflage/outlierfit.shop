#!/usr/bin/env bash
# Deploys a trusted, prebuilt release to the inactive port; e.g. staging <40-char SHA> deploy.
set -euo pipefail
environment="${1:?staging or production}"
release_id="${2:?commit SHA}"
action="${3:-deploy}"
case "$environment" in staging|production) ;; *) exit 2 ;; esac
[[ "$release_id" =~ ^[a-f0-9]{40}$ ]] || exit 2
case "$action" in deploy|finalize|rollback) ;; *) exit 2 ;; esac
root=/opt/outlierfit
install -d -m 750 "$root/state" /etc/outlierfit
install -d -m 750 -o root -g outlierfit "$root/releases" "$root/slots"
exec 9>/var/lock/outlierfit-deploy.lock
flock -n 9
state="$root/state/pending-$release_id"

# Only numeric, internally generated state values are accepted; never source uploaded shell files.
read_port() {
  local value
  value="$(cat "$1" 2>/dev/null || true)"
  case "$value" in 3001|3002) printf '%s' "$value" ;; *) printf 3002 ;; esac
}

if [ "$action" = rollback ]; then
  [ -f "$state" ] || exit 0
  old_port="$(read_port "$state")"
  new_port=3001; [ "$old_port" = 3001 ] && new_port=3002
  if [ -L "$root/slots/$old_port" ]; then
    install -m 644 "$root/state/upstream-$old_port.conf" /etc/nginx/conf.d/outlierfit-upstream.conf
    nginx -t
    systemctl reload nginx
  fi
  systemctl stop "outlierfit@$new_port" || true
  rm -f "$state"
  exit 0
fi
if [ "$action" = finalize ]; then
  [ -f "$state" ] || exit 0
  old_port="$(read_port "$state")"
  new_port=3001; [ "$old_port" = 3001 ] && new_port=3002
  systemctl enable "outlierfit@$new_port"
  systemctl disable "outlierfit@$old_port" || true
  systemctl stop "outlierfit@$old_port" || true
  printf '%s\n' "$new_port" > "$root/state/active-port"
  ln -sfn "$root/slots/$new_port" "$root/current"
  rm -f "$state"
  # Keep three recent releases plus both slot targets, bounding disk use on the 20 GB production VM.
  kept=0
  while read -r candidate; do
    [[ "$candidate" =~ ^[a-f0-9]{40}$ ]] || continue
    kept=$((kept + 1))
    if [ "$kept" -gt 3 ] \
      && [ "$root/releases/$candidate" != "$(readlink -f "$root/slots/3001" 2>/dev/null || true)" ] \
      && [ "$root/releases/$candidate" != "$(readlink -f "$root/slots/3002" 2>/dev/null || true)" ]; then
      rm -rf -- "$root/releases/$candidate"
    fi
  done < <(find "$root/releases" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %f\n' | sort -nr | awk '{print $2}')
  exit 0
fi

archive="/var/tmp/outlierfit-$release_id.tar.gz"
test -f "$archive"
# Reject archive traversal before extracting a Jenkins-built artifact as root.
tar -tzf "$archive" | awk '/^\// || /(^|\/)\.\.(\/|$)/ {bad=1} END {exit bad}'
release="$root/releases/$release_id"
if [ ! -d "$release" ]; then
  install -d -m 750 -o outlierfit -g outlierfit "$release"
  # Extraction is unprivileged: even a malformed artifact cannot write into root-owned paths.
  runuser -u outlierfit -- tar --no-same-owner --no-same-permissions -xzf "$archive" -C "$release"
fi
test "$(cat "$release/.deploy-commit-sha")" = "$release_id"
rm -f "$archive"
node /usr/local/lib/outlierfit/secret-env.mjs "outlierfit-$environment-env" /etc/outlierfit/runtime.env
# Migration tools live outside the pruned runtime artifact; peer auth avoids exposing DB passwords.
runuser -u outlierfit -- env PGHOST=/var/run/postgresql PGUSER=outlierfit PGDATABASE="outlierfit_$environment" \
  node /opt/outlierfit/migration-tools/node_modules/node-pg-migrate/bin/node-pg-migrate.js \
  -m "$release/migrations" --no-verbose up
old_port="$(read_port "$root/state/active-port")"
new_port=3001; [ "$old_port" = 3001 ] && new_port=3002
systemctl stop "outlierfit@$new_port" || true
ln -sfn "$release" "$root/slots/$new_port"
systemctl start "outlierfit@$new_port"
healthy=0
for attempt in $(seq 1 45); do
  if curl --fail --silent --max-time 5 "http://127.0.0.1:$new_port/api/store/products" >/dev/null; then healthy=1; break; fi
  sleep 2
done
if [ "$healthy" != 1 ]; then systemctl stop "outlierfit@$new_port"; exit 1; fi
printf 'upstream outlierfit_app { server 127.0.0.1:%s; }\n' "$new_port" > "$root/state/upstream-$new_port.conf"
printf '%s\n' "$old_port" > "$state"
install -m 644 "$root/state/upstream-$new_port.conf" /etc/nginx/conf.d/outlierfit-upstream.conf
nginx -t
systemctl reload nginx
# Keep the previous backend running until smoke tests finalize or roll back this release.
echo "Deployed $environment $release_id on port $new_port; awaiting smoke verification."
