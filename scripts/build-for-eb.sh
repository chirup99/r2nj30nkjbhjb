#!/bin/bash
# Build a reproducible Elastic Beanstalk bundle.
# Run from the project root: bash scripts/build-for-eb.sh [output.zip]

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUTPUT_ZIP="${1:-eb-deploy.zip}"
if [[ "$OUTPUT_ZIP" != /* ]]; then
  OUTPUT_ZIP="$ROOT_DIR/$OUTPUT_ZIP"
fi
mkdir -p "$(dirname "$OUTPUT_ZIP")"

TEMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TEMP_DIR"' EXIT

cd "$ROOT_DIR"
echo "==> Installing locked dependencies..."
npm ci --no-audit --no-fund

echo "==> Building frontend and server..."
npm run build

if [[ ! -f "dist/index.cjs" || ! -f "dist/public/index.html" ]]; then
  echo "ERROR: Expected production build output is missing."
  exit 1
fi

echo "==> Staging Elastic Beanstalk bundle..."
STAGING_DIR="$TEMP_DIR/staging"
mkdir -p "$STAGING_DIR"
cp -R dist package.json package-lock.json Procfile .ebextensions server shared tsconfig.json "$STAGING_DIR/"

# The Replit .npmrc includes development dependencies; the deployed bundle needs
# only runtime packages because dist/ already contains the compiled app.
printf 'omit=dev\n' > "$STAGING_DIR/.npmrc"

TEMP_ZIP="$TEMP_DIR/$(basename "$OUTPUT_ZIP")"
(
  cd "$STAGING_DIR"
  zip -q -r "$TEMP_ZIP" \
    dist package.json package-lock.json Procfile .ebextensions .npmrc server shared tsconfig.json
)

unzip -tq "$TEMP_ZIP"
mv -f "$TEMP_ZIP" "$OUTPUT_ZIP"

echo "==> Elastic Beanstalk bundle created: $OUTPUT_ZIP"
echo "    Size: $(du -sh "$OUTPUT_ZIP" | cut -f1)"
echo "    To deploy the default eb-deploy.zip, run: bash scripts/deploy-to-eb.sh"
