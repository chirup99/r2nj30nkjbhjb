#!/bin/bash
# Deploy the built zip to Elastic Beanstalk
# Run AFTER: bash scripts/build-for-eb.sh
# Usage: bash scripts/deploy-to-eb.sh

set -e

REGION="ap-south-1"
APP_NAME="personaconnect"
ENV_NAME="personaconnect-prod"
S3_BUCKET="${APP_NAME}-deployments-$(aws sts get-caller-identity --query Account --output text)"
VERSION_LABEL="${APP_NAME}-$(date +%Y%m%d-%H%M%S)"
ZIP_FILE="eb-deploy.zip"

if [ ! -f "$ZIP_FILE" ]; then
  echo "ERROR: $ZIP_FILE not found. Run 'bash scripts/build-for-eb.sh' first."
  exit 1
fi

echo "==> Deploying $VERSION_LABEL to $ENV_NAME ($REGION)..."

# Create S3 bucket if it doesn't exist
aws s3api create-bucket \
  --bucket "$S3_BUCKET" \
  --region "$REGION" \
  --create-bucket-configuration "LocationConstraint=${REGION}" 2>/dev/null || true

# Upload zip to S3
echo "    Uploading to S3..."
aws s3 cp "$ZIP_FILE" "s3://${S3_BUCKET}/${VERSION_LABEL}.zip" --region "$REGION"

# Create EB application version
echo "    Creating application version..."
aws elasticbeanstalk create-application-version \
  --application-name "$APP_NAME" \
  --version-label "$VERSION_LABEL" \
  --source-bundle "S3Bucket=${S3_BUCKET},S3Key=${VERSION_LABEL}.zip" \
  --region "$REGION"

# Deploy to environment
echo "    Deploying to environment (this takes 2-5 minutes)..."
aws elasticbeanstalk update-environment \
  --application-name "$APP_NAME" \
  --environment-name "$ENV_NAME" \
  --version-label "$VERSION_LABEL" \
  --region "$REGION"

# Wait for deployment to complete
echo "    Waiting for deployment to finish..."
aws elasticbeanstalk wait environment-updated \
  --application-name "$APP_NAME" \
  --environment-names "$ENV_NAME" \
  --region "$REGION"

# Check health
HEALTH=$(aws elasticbeanstalk describe-environments \
  --application-name "$APP_NAME" \
  --environment-names "$ENV_NAME" \
  --region "$REGION" \
  --query 'Environments[0].Health' --output text)

EB_URL=$(aws elasticbeanstalk describe-environments \
  --application-name "$APP_NAME" \
  --environment-names "$ENV_NAME" \
  --region "$REGION" \
  --query 'Environments[0].CNAME' --output text)

echo ""
echo "==> Deployment complete!"
echo "    Version : $VERSION_LABEL"
echo "    Health  : $HEALTH"
echo "    URL     : http://$EB_URL"
echo "    Domain  : https://personaconnect.xyz"
