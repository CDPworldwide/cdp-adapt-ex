#!/usr/bin/env bash

set -euo pipefail

if [ "$#" -ne 3 ]; then
  echo "Usage: $0 <frontend|backend> <pr-title> <pr-number>" >&2
  exit 2
fi

component="$1"
title="$2"
pr_number="$3"

case "$component" in
  frontend)
    prefix="frontend-preview-"
    ;;
  backend)
    prefix="cdp-server-preview-"
    ;;
  *)
    echo "Unsupported preview component: $component" >&2
    exit 2
    ;;
esac

if ! [[ "$pr_number" =~ ^[0-9]+$ ]]; then
  echo "PR number must contain only digits" >&2
  exit 2
fi

if ascii_title=$(printf '%s' "$title" | iconv -f UTF-8 -t 'ASCII//TRANSLIT' 2>/dev/null); then
  :
else
  ascii_title="$title"
fi

slug=$(printf '%s' "$ascii_title" \
  | LC_ALL=C tr '[:upper:]' '[:lower:]' \
  | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//')

if [ -z "$slug" ]; then
  slug="feature"
fi

suffix="-pr-${pr_number}"
max_slug_length=$((49 - ${#prefix} - ${#suffix}))

if [ "$max_slug_length" -lt 1 ]; then
  echo "PR number is too long to form a valid Cloud Run service name" >&2
  exit 2
fi

slug=$(printf '%s' "$slug" | cut -c "1-${max_slug_length}" | sed -E 's/-+$//')

if [ -z "$slug" ]; then
  slug="feature"
fi

printf '%s%s%s\n' "$prefix" "$slug" "$suffix"
