#!/usr/bin/env bash

set -euo pipefail

script_dir=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
subject="$script_dir/preview-service-name.sh"

assert_name() {
  expected="$1"
  shift
  actual=$(bash "$subject" "$@")

  if [ "$actual" != "$expected" ]; then
    echo "Expected '$expected', got '$actual'" >&2
    exit 1
  fi
}

assert_name \
  "frontend-preview-add-map-risk-filters-pr-482" \
  frontend \
  "Add map risk filters" \
  482

assert_name \
  "cdp-server-preview-fix-login-redirect-pr-7" \
  backend \
  "  Fix: login redirect!  " \
  7

long_name=$(bash "$subject" frontend "Introduce a very long and highly descriptive feature title that exceeds the limit" 12345)
if [ "${#long_name}" -gt 49 ]; then
  echo "Generated name exceeds Cloud Run's 49-character limit: $long_name" >&2
  exit 1
fi

if [[ ! "$long_name" =~ ^[a-z][a-z0-9-]*[a-z0-9]$ ]]; then
  echo "Generated name is not DNS-safe: $long_name" >&2
  exit 1
fi

assert_name \
  "frontend-preview-feature-pr-9" \
  frontend \
  "🚀" \
  9

echo "preview-service-name tests passed"
