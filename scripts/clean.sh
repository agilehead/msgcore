#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
for package in services/msgcore/node/packages/*; do
  [ ! -d "$package/dist" ] || rm -rf "$package/dist"
done
