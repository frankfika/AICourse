#!/usr/bin/env bash
set -euo pipefail

if [[ ${CONFIRM_BOOTSTRAP:-} != install-aicourse-host ]]; then
  echo 'Set CONFIRM_BOOTSTRAP=install-aicourse-host to run this host-changing script.' >&2
  exit 1
fi

domain=${1:-aicourse.49.234.25.35.sslip.io}
deploy_user=${2:-ubuntu}
deploy_root=${3:-/opt/aicourse}
if [[ ! $domain =~ ^[A-Za-z0-9.-]+$ ]] || [[ $domain == .* ]] || [[ $domain == *. ]]; then
  echo 'Invalid domain' >&2
  exit 1
fi
if [[ $deploy_root != /opt/* ]] || [[ $deploy_root == /opt/ ]]; then
  echo 'deploy_root must be a dedicated directory below /opt' >&2
  exit 1
fi

source /etc/os-release
if [[ ${ID:-} != ubuntu ]] || [[ ${VERSION_ID:-} != 22.04 ]]; then
  echo 'This bootstrap is validated only for Ubuntu 22.04.' >&2
  exit 1
fi
id "$deploy_user" >/dev/null
sudo -n true

if ! command -v docker >/dev/null 2>&1; then
  conflicts=$(dpkg-query -W -f='${binary:Package}\n' \
    docker.io docker-compose docker-compose-v2 podman-docker containerd runc 2>/dev/null || true)
  if [[ -n $conflicts ]]; then
    echo 'Conflicting container packages are installed; review manually:' >&2
    echo "$conflicts" >&2
    exit 1
  fi

  sudo apt-get update
  sudo apt-get install -y ca-certificates curl
  sudo install -m 0755 -d /etc/apt/keyrings
  sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  sudo chmod a+r /etc/apt/keyrings/docker.asc
  architecture=$(dpkg --print-architecture)
  codename=${UBUNTU_CODENAME:-$VERSION_CODENAME}
  printf '%s\n' \
    'Types: deb' \
    'URIs: https://download.docker.com/linux/ubuntu' \
    "Suites: $codename" \
    'Components: stable' \
    "Architectures: $architecture" \
    'Signed-By: /etc/apt/keyrings/docker.asc' | \
    sudo tee /etc/apt/sources.list.d/docker.sources >/dev/null
  sudo apt-get update
  sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi

sudo systemctl enable --now docker
sudo usermod -aG docker "$deploy_user"
sudo apt-get update
sudo apt-get install -y certbot

sudo install -d -m 0755 -o "$deploy_user" -g "$deploy_user" \
  "$deploy_root" "$deploy_root/incoming" "$deploy_root/releases" "$deploy_root/shared"
sudo install -d -m 0755 /var/www/html/.well-known/acme-challenge

script_root=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
temporary_config=$(mktemp)
trap 'rm -f "$temporary_config"' EXIT
sed "s/academy\.example\.com/$domain/g" \
  "$script_root/host-nginx-http.conf.example" > "$temporary_config"
sudo install -m 0644 "$temporary_config" /etc/nginx/sites-available/aicourse
sudo ln -sfn /etc/nginx/sites-available/aicourse /etc/nginx/sites-enabled/aicourse
sudo nginx -t
sudo systemctl reload nginx

echo 'Host bootstrap completed. Start a new SSH session before using docker without sudo.'
