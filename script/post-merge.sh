#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

npm ci --no-audit --no-fund
npm run build

# Production is externally hosted. Never publish, enable payments, or run
# database migrations automatically after a merge. Apply reviewed SQL separately.