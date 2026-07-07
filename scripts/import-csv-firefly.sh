#!/bin/bash

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Load .env (robust to spaces and special chars)
if [ -f "$PROJECT_DIR/.env" ]; then
    set -a
    source "$PROJECT_DIR/.env"
    set +a
fi

# CSV path and importer config are overridable (arg 1 / arg 2) so any provider
# both import through this one script. Defaults preserve the bare TR invocation.
CONVERTED_CSV="${1:-$PROJECT_DIR/importer/imports/inbox.csv}"
CONFIG_FILE="${2:-$PROJECT_DIR/importer/config/config.json}"
IMPORTER_URL="${IMPORTER_URL:-http://localhost:8067}"

echo "=== Import to Firefly III (via Data Importer) ==="

if [ -z "$AUTO_IMPORT_SECRET" ]; then
    echo "ERROR: AUTO_IMPORT_SECRET not set"
    echo "Set it in .env file"
    exit 1
fi

if [ ! -f "$CONVERTED_CSV" ]; then
    echo "ERROR: File not found: $CONVERTED_CSV"
    echo "Convert a provider export to the standard CSV first (see providers/README.md)"
    exit 1
fi

if [ ! -f "$CONFIG_FILE" ]; then
    echo "ERROR: Import config not found: $CONFIG_FILE"
    exit 1
fi

echo "Importing: $CONVERTED_CSV"
echo "Using config: $CONFIG_FILE"
echo "Data Importer: $IMPORTER_URL"

response=$(curl -s -X POST \
    "$IMPORTER_URL/autoupload" \
    -F "secret=$AUTO_IMPORT_SECRET" \
    -F "json=@$CONFIG_FILE" \
    -F "importable=@$CONVERTED_CSV" 2>&1)

echo "$response"

# Duplicate external_id collisions are benign (idempotent re-import) and the
# "There are N error(s)" line is just a count — neither is a real failure.
# Fail only if a genuine error/exception survives filtering those out.
real_errors=$(echo "$response" | grep -iE 'error|exception' \
    | grep -viE 'there (are|is) [0-9]+ (error|warning|message)' \
    | grep -vi 'already a transaction' \
    | grep -vi 'already exists' || true)

if [ -n "$real_errors" ]; then
    echo ""
    echo "ERROR: Import failed"
    echo "$real_errors"
    exit 1
else
    echo ""
    echo "=== Import completed successfully! ==="
fi
