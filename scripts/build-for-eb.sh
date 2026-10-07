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
mkdir -p "$STAGING_DIR/.ebextensions"
cp -R dist package.json package-lock.json Procfile server shared tsconfig.json "$STAGING_DIR/"
cp -R .ebextensions/. "$STAGING_DIR/.ebextensions/"

# Replit's lockfile can contain absolute tarball URLs for its private package
# firewall. Elastic Beanstalk instances cannot resolve that host, so rewrite
# only those deployment-copy URLs to the equivalent public npm registry paths.
node --input-type=module - "$STAGING_DIR/package-lock.json" <<'NODE'
import fs from "node:fs/promises";

const lockPath = process.argv[2];
const lock = JSON.parse(await fs.readFile(lockPath, "utf8"));
let rewritten = 0;

for (const [name, entry] of Object.entries(lock.packages ?? {})) {
  if (!entry.resolved) continue;
  const url = new URL(entry.resolved);
  if (url.hostname === "package-firewall.replit.internal") {
    if (!url.pathname.startsWith("/npm/")) {
      throw new Error(`Unexpected Replit package URL path in ${name}`);
    }
    url.protocol = "https:";
    url.hostname = "registry.npmjs.org";
    url.port = "";
    url.pathname = url.pathname.slice(4);
    entry.resolved = url.toString();
    rewritten++;
  } else if (url.hostname.endsWith(".replit.internal")) {
    throw new Error(`Unexpected Replit-internal package host in ${name}`);
  }
}

await fs.writeFile(lockPath, `${JSON.stringify(lock, null, 2)}\n`);
console.log(`Normalized ${rewritten} deployment-copy package URLs.`);
NODE

# The built app needs no development dependencies on the EB instance.
printf 'registry=https://registry.npmjs.org/\nomit=dev\n' > "$STAGING_DIR/.npmrc"

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
