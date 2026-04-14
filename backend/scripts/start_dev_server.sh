#!/usr/bin/env bash

set -euo pipefail

SECRET_PAYLOAD="$(gcloud secrets versions access latest --secret=cloudsql_cdp-test --project project-bb4fd058-24e7-4ccb-b06)"
POSTGRES_PASSWORD="$(printf '%s\n' "$SECRET_PAYLOAD" | perl -ne 'print "$1\n" if /^password:\s*(.+)$/')"

if [ -z "$POSTGRES_PASSWORD" ]; then
  printf 'Failed to resolve POSTGRES_PASSWORD from cloudsql_cdp-test\n' >&2
  exit 1
fi

export POSTGRES_PORT="${POSTGRES_PORT:-55432}"
export POSTGRES_PASSWORD

exec uv run fastapi dev app/main.py
