#!/usr/bin/env bash
set -e

MIN_NODE=18
NODE_VER=$(node -e "console.log(process.versions.node.split('.')[0])" 2>/dev/null || echo "0")

if [ "$NODE_VER" -lt "$MIN_NODE" ] 2>/dev/null; then
  echo "mcp-ipm requires Node.js >= $MIN_NODE. Install at https://nodejs.org" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "$SCRIPT_DIR/bin/install.js" ]; then
  node "$SCRIPT_DIR/bin/install.js" "$@"
else
  npx -y "github:neto-developer/mcp-ipm" "$@"
fi
