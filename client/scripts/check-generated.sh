#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLIENT_DIR="$(dirname "$SCRIPT_DIR")"

required_files=(
    "openapi.json"
    "src/index.ts"
    "src/sdk.gen.ts"
    "src/types.gen.ts"
    "src/schemas.gen.ts"
)

missing_files=()

for relative_path in "${required_files[@]}"; do
    if [ ! -f "${CLIENT_DIR}/${relative_path}" ]; then
        missing_files+=("$relative_path")
    fi
done

if [ "${#missing_files[@]}" -eq 0 ]; then
    echo "Client artifacts are present."
    exit 0
fi

echo "Client artifacts are missing:"
for relative_path in "${missing_files[@]}"; do
    echo "  - ${relative_path}"
done

echo
echo "To regenerate from the tracked OpenAPI snapshot, run:"
echo "  npm run client:generate"
echo
echo "To refresh the snapshot from the backend and regenerate, run:"
echo "  npm run client:refresh"

exit 1
