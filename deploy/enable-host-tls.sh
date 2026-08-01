#!/usr/bin/env bash
set -euo pipefail

if [[ ${CONFIRM_TLS:-} != enable-aicourse-tls ]]; then
  echo 'Set CONFIRM_TLS=enable-aicourse-tls to run this host-changing script.' >&2
  exit 1
fi

domain=${1:-}
email=${2:-}
if [[ ! $domain =~ ^[A-Za-z0-9.-]+$ ]] || [[ $domain == .* ]] || [[ $domain == *. ]]; then
  echo 'A valid domain is required.' >&2
  exit 1
fi
if [[ ! $email =~ ^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$ ]]; then
  echo 'A valid Let’s Encrypt contact email is required.' >&2
  exit 1
fi

curl --fail --silent --show-error http://127.0.0.1:8088/healthz >/dev/null
sudo certbot certonly --webroot --webroot-path /var/www/html \
  --non-interactive --agree-tos --email "$email" -d "$domain"

script_root=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
temporary_config=$(mktemp)
trap 'rm -f "$temporary_config"' EXIT
sed "s/academy\.example\.com/$domain/g" \
  "$script_root/host-nginx.conf.example" > "$temporary_config"
sudo install -m 0644 "$temporary_config" /etc/nginx/sites-available/aicourse
sudo nginx -t
sudo systemctl reload nginx

curl --fail --silent --show-error "https://$domain/healthz" >/dev/null
echo "TLS enabled: https://$domain"
