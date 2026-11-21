#!/usr/bin/env bash
# Implements Jenkins stages with fixed private-IP SSH; e.g. ci.sh staging build.
set -euo pipefail
environment="${1:?environment}"
action="${2:?action}"
case "$environment" in staging) host=10.20.0.2; domain=staging.outlierfit.shop ;; production) host=10.20.0.5; domain=outlierfit.shop ;; *) exit 2 ;; esac
ssh_target="deploy@$host"
ssh_options=(-i /var/lib/jenkins/.ssh/outlierfit-deploy -o BatchMode=yes -o StrictHostKeyChecking=yes -o ConnectTimeout=15)
sha="${DEPLOY_COMMIT_SHA:-$(git rev-parse HEAD)}"
[[ "$sha" =~ ^[a-f0-9]{40}$ ]] || exit 2
artifact_root=/var/lib/jenkins/outlierfit-artifacts

case "$action" in
  build)
    [ "$environment" = staging ]
    node scripts/deploy/secret-env.mjs outlierfit-staging-env .env.local
    ssh "${ssh_options[@]}" -N -L 15432:127.0.0.1:5432 "$ssh_target" &
    tunnel=$!; trap 'kill "$tunnel" 2>/dev/null || true; rm -f .env.local' EXIT
    # The tunnel is build-only; runtime uses the VM-local database on port 5432.
    for attempt in $(seq 1 20); do
      if node -e 'const s=require("net").connect(15432,"127.0.0.1",()=>{s.end();process.exit(0)});s.on("error",()=>process.exit(1))'; then break; fi
      sleep 1
    done
    export PGHOST=127.0.0.1 PGPORT=15432
    npm ci
    npm run migrate:up
    node --test test/unit/*.test.cjs
    npm run build
    printf '%s\n' "$sha" > .deploy-commit-sha
    npm prune --omit=dev
    tar --exclude=.git --exclude='.env*' --exclude=.local --exclude=.next/cache \
      --exclude=public/products/levis/000VT-0000/passport.png \
      --exclude=playwright-tests --exclude=test/ui/target --exclude=.deploy-artifact.tar.gz \
      -czf /var/tmp/outlierfit-"$sha".tar.gz .
    ;;
  deploy)
    if [ "$environment" = production ]; then
      test -f "$artifact_root/$sha/verified"
      (cd "$artifact_root/$sha" && sha256sum --check artifact.sha256)
      cp "$artifact_root/$sha/artifact.tar.gz" "/var/tmp/outlierfit-$sha.tar.gz"
    fi
    scp "${ssh_options[@]}" "/var/tmp/outlierfit-$sha.tar.gz" "$ssh_target:/var/tmp/outlierfit-$sha.tar.gz"
    ssh "${ssh_options[@]}" "$ssh_target" "sudo /usr/local/sbin/outlierfit-release $environment $sha deploy"
    if [ "$environment" = production ]; then rm -f "/var/tmp/outlierfit-$sha.tar.gz"; fi
    ;;
  health)
    healthy=0
    # DNS/TLS propagation can lag initial deployment; retry checks, never repeat payment actions.
    for attempt in $(seq 1 60); do
      if curl --fail --silent --max-time 10 "https://$domain/api/store/products" >/dev/null \
        && curl --fail --silent --max-time 10 "https://$domain/products" >/dev/null; then healthy=1; break; fi
      sleep 5
    done
    [ "$healthy" = 1 ] || { echo "Public HTTPS health check failed for $domain" >&2; exit 1; }
    ;;
  smoke)
    export PLAYWRIGHT_BASE_URL="https://$domain"
    node scripts/deploy/smoke.cjs
    ;;
  auth|full)
    test -d test/ui
    ssh "${ssh_options[@]}" -N -L 15432:127.0.0.1:5432 "$ssh_target" &
    tunnel=$!; trap 'kill "$tunnel" 2>/dev/null || true' EXIT
    node scripts/deploy/auth-smoke.mjs "$environment" "$domain" "$action"
    ;;
  publish)
    install -d "$artifact_root/$sha"
    cp "/var/tmp/outlierfit-$sha.tar.gz" "$artifact_root/$sha/artifact.tar.gz"
    (cd "$artifact_root/$sha" && sha256sum artifact.tar.gz > artifact.sha256)
    touch "$artifact_root/$sha/verified"
    rm -f "/var/tmp/outlierfit-$sha.tar.gz"
    ;;
  finalize|rollback)
    ssh "${ssh_options[@]}" "$ssh_target" "sudo /usr/local/sbin/outlierfit-release $environment $sha $action"
    ;;
  *) exit 2 ;;
esac
