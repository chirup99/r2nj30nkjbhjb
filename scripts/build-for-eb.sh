#!/bin/bash
# Build the project and create a deployment zip for AWS Elastic Beanstalk
# Run from the project root: bash scripts/build-for-eb.sh

set -e

echo "==> Building PersonaConnect for Elastic Beanstalk..."

# Clean previous builds
rm -rf dist eb-deploy.zip

# Install all dependencies (including devDeps needed for build)
echo "==> Installing dependencies..."
npm install

# Build frontend + backend
echo "==> Running build..."
npm run build

# Verify build output
if [ ! -f "dist/index.cjs" ]; then
  echo "ERROR: dist/index.cjs not found. Build failed."
  exit 1
fi
if [ ! -d "dist/public" ]; then
  echo "ERROR: dist/public not found. Frontend build failed."
  exit 1
fi

echo "==> Build complete. Creating deployment zip..."

# Create the zip with everything EB needs:
# - dist/           (compiled backend + static frontend)
# - package.json    (EB reads scripts.start)
# - Procfile        (tells EB what command to run)
# - .ebextensions/  (EB environment config)
zip -r eb-deploy.zip \
  dist/ \
  package.json \
  package-lock.json \
  Procfile \
  .ebextensions/ \
  --exclude "*.git*"

echo ""
echo "==> eb-deploy.zip created successfully."
echo "    Size: $(du -sh eb-deploy.zip | cut -f1)"
echo ""
echo "Next: run 'bash scripts/deploy-to-eb.sh' to deploy."
