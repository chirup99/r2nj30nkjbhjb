#!/bin/bash
# Add HTTPS listener to the ALB after ACM certificate is validated
# Usage: bash scripts/add-https-listener.sh <certificate-arn>

set -e

REGION="ap-south-1"
APP_NAME="personaconnect"
ENV_NAME="personaconnect-prod"
CERT_ARN="${1:?Usage: $0 <certificate-arn>}"

echo "==> Adding HTTPS listener to ALB..."

# Get ALB ARN
ALB_ARN=$(aws elbv2 describe-load-balancers \
  --region "$REGION" \
  --query "LoadBalancers[?contains(LoadBalancerArn, 'personaconnect')].LoadBalancerArn | [0]" \
  --output text)

echo "    ALB ARN: $ALB_ARN"

# Get the existing target group from EB
TG_ARN=$(aws elbv2 describe-target-groups \
  --region "$REGION" \
  --query "TargetGroups[?contains(TargetGroupArn, '${ENV_NAME}')].TargetGroupArn | [0]" \
  --output text)

echo "    Target Group ARN: $TG_ARN"

# Add HTTPS listener
aws elbv2 create-listener \
  --load-balancer-arn "$ALB_ARN" \
  --protocol HTTPS \
  --port 443 \
  --certificates "CertificateArn=${CERT_ARN}" \
  --ssl-policy "ELBSecurityPolicy-TLS13-1-2-2021-06" \
  --default-actions "Type=forward,TargetGroupArn=${TG_ARN}" \
  --region "$REGION"

# Modify HTTP listener to redirect to HTTPS
HTTP_LISTENER_ARN=$(aws elbv2 describe-listeners \
  --load-balancer-arn "$ALB_ARN" \
  --region "$REGION" \
  --query "Listeners[?Port==\`80\`].ListenerArn | [0]" \
  --output text)

aws elbv2 modify-listener \
  --listener-arn "$HTTP_LISTENER_ARN" \
  --default-actions "Type=redirect,RedirectConfig={Protocol=HTTPS,Port=443,StatusCode=HTTP_301}" \
  --region "$REGION"

echo ""
echo "==> HTTPS listener added. HTTP traffic will now redirect to HTTPS."
echo "    Test: curl -I https://personaconnect.xyz"
