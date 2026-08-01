#!/bin/sh
set -eu

repo_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
env_file=${1:-"$repo_root/.env.production"}
backup_root=${2:-"$repo_root/backups"}
compose_file="$repo_root/docker-compose.production.yml"

if [ ! -f "$env_file" ]; then
  printf 'Production env file not found: %s\n' "$env_file" >&2
  exit 1
fi

command -v docker >/dev/null 2>&1 || {
  printf 'docker is required\n' >&2
  exit 1
}

node "$repo_root/deploy/validate-production-env.mjs" "$env_file"
running_services=$(docker compose --env-file "$env_file" -f "$compose_file" ps --services --status running)
for required_service in mysql minio; do
  if ! printf '%s\n' "$running_services" | grep -qx "$required_service"; then
    printf 'Required service is not running: %s\n' "$required_service" >&2
    exit 1
  fi
done

timestamp=$(date -u +%Y%m%dT%H%M%SZ)
target="$backup_root/$timestamp"
mkdir -p "$target"
chmod 700 "$target"
touch "$target/.incomplete"

printf 'Exporting MySQL to %s/mysql.sql\n' "$target"
docker compose --env-file "$env_file" -f "$compose_file" exec -T mysql \
  sh -ec 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysqldump --single-transaction --routines --events --triggers -uroot "$MYSQL_DATABASE"' \
  > "$target/mysql.sql"
test -s "$target/mysql.sql"

printf 'Mirroring MinIO bucket to %s/minio\n' "$target"
docker compose --env-file "$env_file" -f "$compose_file" run --rm -T \
  -v "$target:/backup" --entrypoint /bin/sh minio-init -ec '
    mc alias set local http://minio:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null
    mkdir -p /backup/minio
    mc mirror --overwrite "local/$MINIO_BUCKET" /backup/minio
  '

cat > "$target/manifest.txt" <<EOF
created_at=$timestamp
git_commit=${RELEASE_SHA:-$(git -C "$repo_root" rev-parse HEAD 2>/dev/null || printf unknown)}
mysql_dump=mysql.sql
minio_backup=minio/
EOF

rm "$target/.incomplete"
printf 'Backup completed: %s\n' "$target"
