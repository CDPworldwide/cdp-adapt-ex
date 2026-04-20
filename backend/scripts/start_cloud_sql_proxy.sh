#!/usr/bin/env bash

set -euo pipefail

CONTAINER_NAME="pac-cloud-sql-proxy"
INSTANCE_CONNECTION_NAME="project-bb4fd058-24e7-4ccb-b06:us-central1:cdp-test"
PROXY_IMAGE="gcr.io/cloud-sql-connectors/cloud-sql-proxy:2.21.2"

docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true

exec docker run --rm \
  --name "$CONTAINER_NAME" \
  -p 55432:5432 \
  "$PROXY_IMAGE" \
  --token "$(gcloud auth print-access-token)" \
  --address 0.0.0.0 \
  --port 5432 \
  "$INSTANCE_CONNECTION_NAME"
