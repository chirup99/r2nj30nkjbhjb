#!/bin/bash
# Create all new AWS infrastructure for PersonaConnect
# This creates: VPC, Subnets, IGW, Route Tables, Security Groups,
#               EB Application, EB Environment (ALB), Route 53 records
#
# Prerequisites:
#   - AWS CLI v2 installed and configured (aws configure)
#   - AWS credentials with permissions for VPC, EC2, EB, Route53, IAM
#   - personaconnect.xyz hosted zone already in Route 53
#     (or update HOSTED_ZONE_ID below after creating it)
#
# Usage:
#   bash scripts/create-aws-infra.sh

set -e

# ─── Configuration ────────────────────────────────────────────────────────────
REGION="ap-south-1"
APP_NAME="personaconnect"
ENV_NAME="personaconnect-prod"
DOMAIN="personaconnect.xyz"
WWW_DOMAIN="www.personaconnect.xyz"
PLATFORM="64bit Amazon Linux 2023 v6.5.1 running Node.js 20"
INSTANCE_TYPE="t3.small"
VPC_CIDR="10.1.0.0/16"
SUBNET1_CIDR="10.1.1.0/24"   # ap-south-1a
SUBNET2_CIDR="10.1.2.0/24"   # ap-south-1b
# ──────────────────────────────────────────────────────────────────────────────

echo ""
echo "========================================================"
echo "  PersonaConnect — AWS Infrastructure Setup"
echo "  Region : $REGION"
echo "  Domain : $DOMAIN"
echo "========================================================"
echo ""

# ── 1. Create VPC ─────────────────────────────────────────────────────────────
echo "[1/12] Creating VPC ($VPC_CIDR)..."
VPC_ID=$(aws ec2 create-vpc \
  --cidr-block "$VPC_CIDR" \
  --region "$REGION" \
  --tag-specifications "ResourceType=vpc,Tags=[{Key=Name,Value=${APP_NAME}-vpc},{Key=Project,Value=${APP_NAME}}]" \
  --query 'Vpc.VpcId' --output text)
echo "       VPC: $VPC_ID"

aws ec2 modify-vpc-attribute --vpc-id "$VPC_ID" --enable-dns-support --region "$REGION"
aws ec2 modify-vpc-attribute --vpc-id "$VPC_ID" --enable-dns-hostnames --region "$REGION"

# ── 2. Create Internet Gateway ────────────────────────────────────────────────
echo "[2/12] Creating Internet Gateway..."
IGW_ID=$(aws ec2 create-internet-gateway \
  --region "$REGION" \
  --tag-specifications "ResourceType=internet-gateway,Tags=[{Key=Name,Value=${APP_NAME}-igw},{Key=Project,Value=${APP_NAME}}]" \
  --query 'InternetGateway.InternetGatewayId' --output text)
aws ec2 attach-internet-gateway --vpc-id "$VPC_ID" --internet-gateway-id "$IGW_ID" --region "$REGION"
echo "       IGW: $IGW_ID"

# ── 3. Create Public Subnets ──────────────────────────────────────────────────
echo "[3/12] Creating subnets (2 AZs for ALB multi-AZ requirement)..."
SUBNET1_ID=$(aws ec2 create-subnet \
  --vpc-id "$VPC_ID" \
  --cidr-block "$SUBNET1_CIDR" \
  --availability-zone "${REGION}a" \
  --region "$REGION" \
  --tag-specifications "ResourceType=subnet,Tags=[{Key=Name,Value=${APP_NAME}-public-1a},{Key=Project,Value=${APP_NAME}}]" \
  --query 'Subnet.SubnetId' --output text)

SUBNET2_ID=$(aws ec2 create-subnet \
  --vpc-id "$VPC_ID" \
  --cidr-block "$SUBNET2_CIDR" \
  --availability-zone "${REGION}b" \
  --region "$REGION" \
  --tag-specifications "ResourceType=subnet,Tags=[{Key=Name,Value=${APP_NAME}-public-1b},{Key=Project,Value=${APP_NAME}}]" \
  --query 'Subnet.SubnetId' --output text)

aws ec2 modify-subnet-attribute --subnet-id "$SUBNET1_ID" --map-public-ip-on-launch --region "$REGION"
aws ec2 modify-subnet-attribute --subnet-id "$SUBNET2_ID" --map-public-ip-on-launch --region "$REGION"
echo "       Subnet 1a: $SUBNET1_ID"
echo "       Subnet 1b: $SUBNET2_ID"

# ── 4. Route Table ────────────────────────────────────────────────────────────
echo "[4/12] Creating and associating Route Table..."
RTB_ID=$(aws ec2 create-route-table \
  --vpc-id "$VPC_ID" \
  --region "$REGION" \
  --tag-specifications "ResourceType=route-table,Tags=[{Key=Name,Value=${APP_NAME}-rtb},{Key=Project,Value=${APP_NAME}}]" \
  --query 'RouteTable.RouteTableId' --output text)
aws ec2 create-route --route-table-id "$RTB_ID" --destination-cidr-block "0.0.0.0/0" --gateway-id "$IGW_ID" --region "$REGION" > /dev/null
aws ec2 associate-route-table --route-table-id "$RTB_ID" --subnet-id "$SUBNET1_ID" --region "$REGION" > /dev/null
aws ec2 associate-route-table --route-table-id "$RTB_ID" --subnet-id "$SUBNET2_ID" --region "$REGION" > /dev/null
echo "       RTB: $RTB_ID"

# ── 5. Security Groups ────────────────────────────────────────────────────────
echo "[5/12] Creating Security Groups..."

# ALB Security Group — allow 80 and 443 from anywhere
ALB_SG_ID=$(aws ec2 create-security-group \
  --group-name "${APP_NAME}-alb-sg" \
  --description "PersonaConnect ALB — public HTTP/HTTPS" \
  --vpc-id "$VPC_ID" \
  --region "$REGION" \
  --tag-specifications "ResourceType=security-group,Tags=[{Key=Name,Value=${APP_NAME}-alb-sg},{Key=Project,Value=${APP_NAME}}]" \
  --query 'GroupId' --output text)
aws ec2 authorize-security-group-ingress --group-id "$ALB_SG_ID" --protocol tcp --port 80  --cidr 0.0.0.0/0 --region "$REGION" > /dev/null
aws ec2 authorize-security-group-ingress --group-id "$ALB_SG_ID" --protocol tcp --port 443 --cidr 0.0.0.0/0 --region "$REGION" > /dev/null
echo "       ALB SG: $ALB_SG_ID"

# EC2 Security Group — allow 8080 from ALB SG only, all outbound
EC2_SG_ID=$(aws ec2 create-security-group \
  --group-name "${APP_NAME}-ec2-sg" \
  --description "PersonaConnect EC2 — traffic from ALB only" \
  --vpc-id "$VPC_ID" \
  --region "$REGION" \
  --tag-specifications "ResourceType=security-group,Tags=[{Key=Name,Value=${APP_NAME}-ec2-sg},{Key=Project,Value=${APP_NAME}}]" \
  --query 'GroupId' --output text)
aws ec2 authorize-security-group-ingress \
  --group-id "$EC2_SG_ID" \
  --protocol tcp --port 8080 \
  --source-group "$ALB_SG_ID" \
  --region "$REGION" > /dev/null
echo "       EC2 SG: $EC2_SG_ID"

# ── 6. IAM Roles for EB ───────────────────────────────────────────────────────
echo "[6/12] Creating IAM roles for Elastic Beanstalk..."

# EB Service Role
aws iam create-role \
  --role-name "${APP_NAME}-eb-service-role" \
  --assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"elasticbeanstalk.amazonaws.com"},"Action":"sts:AssumeRole"}]}' \
  --region "$REGION" 2>/dev/null || echo "       (service role already exists, reusing)"

aws iam attach-role-policy \
  --role-name "${APP_NAME}-eb-service-role" \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSElasticBeanstalkEnhancedHealth 2>/dev/null || true
aws iam attach-role-policy \
  --role-name "${APP_NAME}-eb-service-role" \
  --policy-arn arn:aws:iam::aws:policy/AWSElasticBeanstalkManagedUpdatesCustomerRolePolicy 2>/dev/null || true

# EC2 Instance Profile
aws iam create-role \
  --role-name "${APP_NAME}-eb-ec2-role" \
  --assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"ec2.amazonaws.com"},"Action":"sts:AssumeRole"}]}' \
  --region "$REGION" 2>/dev/null || echo "       (ec2 role already exists, reusing)"

aws iam attach-role-policy \
  --role-name "${APP_NAME}-eb-ec2-role" \
  --policy-arn arn:aws:iam::aws:policy/AWSElasticBeanstalkWebTier 2>/dev/null || true
aws iam attach-role-policy \
  --role-name "${APP_NAME}-eb-ec2-role" \
  --policy-arn arn:aws:iam::aws:policy/AmazonDynamoDBFullAccess 2>/dev/null || true

aws iam create-instance-profile \
  --instance-profile-name "${APP_NAME}-eb-ec2-profile" 2>/dev/null || echo "       (instance profile already exists)"
aws iam add-role-to-instance-profile \
  --instance-profile-name "${APP_NAME}-eb-ec2-profile" \
  --role-name "${APP_NAME}-eb-ec2-role" 2>/dev/null || true

echo "       IAM roles ready."

# ── 7. Create EB Application ──────────────────────────────────────────────────
echo "[7/12] Creating Elastic Beanstalk Application..."
aws elasticbeanstalk create-application \
  --application-name "$APP_NAME" \
  --description "PersonaConnect — Digital Persona Hub" \
  --region "$REGION" 2>/dev/null || echo "       (application already exists)"
echo "       EB Application: $APP_NAME"

# ── 8. Create EB Environment (Load Balanced) ──────────────────────────────────
echo "[8/12] Creating EB Environment with Application Load Balancer..."
echo "       This can take 5-10 minutes. Please wait..."

aws elasticbeanstalk create-environment \
  --application-name "$APP_NAME" \
  --environment-name "$ENV_NAME" \
  --region "$REGION" \
  --solution-stack-name "$PLATFORM" \
  --option-settings \
    "Namespace=aws:ec2:vpc,OptionName=VPCId,Value=${VPC_ID}" \
    "Namespace=aws:ec2:vpc,OptionName=Subnets,Value=${SUBNET1_ID},${SUBNET2_ID}" \
    "Namespace=aws:ec2:vpc,OptionName=ELBSubnets,Value=${SUBNET1_ID},${SUBNET2_ID}" \
    "Namespace=aws:ec2:vpc,OptionName=AssociatePublicIpAddress,Value=true" \
    "Namespace=aws:elasticbeanstalk:environment,OptionName=EnvironmentType,Value=LoadBalanced" \
    "Namespace=aws:elasticbeanstalk:environment,OptionName=ServiceRole,Value=${APP_NAME}-eb-service-role" \
    "Namespace=aws:elasticbeanstalk:environment,OptionName=LoadBalancerType,Value=application" \
    "Namespace=aws:autoscaling:launchconfiguration,OptionName=InstanceType,Value=${INSTANCE_TYPE}" \
    "Namespace=aws:autoscaling:launchconfiguration,OptionName=IamInstanceProfile,Value=${APP_NAME}-eb-ec2-profile" \
    "Namespace=aws:autoscaling:launchconfiguration,OptionName=SecurityGroups,Value=${EC2_SG_ID}" \
    "Namespace=aws:elbv2:loadbalancer,OptionName=SecurityGroups,Value=${ALB_SG_ID}" \
    "Namespace=aws:autoscaling:asg,OptionName=MinSize,Value=1" \
    "Namespace=aws:autoscaling:asg,OptionName=MaxSize,Value=2" \
    "Namespace=aws:elasticbeanstalk:healthreporting:system,OptionName=SystemType,Value=enhanced" \
    "Namespace=aws:elasticbeanstalk:application:environment,OptionName=NODE_ENV,Value=production" \
    "Namespace=aws:elasticbeanstalk:application:environment,OptionName=PORT,Value=8080" \
    "Namespace=aws:elasticbeanstalk:application:environment,OptionName=AWS_REGION,Value=${REGION}" \
    "Namespace=aws:elasticbeanstalk:application:environment,OptionName=DYNAMODB_TABLE_NAME,Value=Users" \
    "Namespace=aws:elasticbeanstalk:application:environment,OptionName=AWS_ACCESS_KEY_ID,Value=REPLACE_WITH_YOUR_KEY" \
    "Namespace=aws:elasticbeanstalk:application:environment,OptionName=AWS_SECRET_ACCESS_KEY,Value=REPLACE_WITH_YOUR_SECRET"

echo ""
echo "       Waiting for environment to become ready (this takes ~8 minutes)..."
aws elasticbeanstalk wait environment-exists \
  --application-name "$APP_NAME" \
  --environment-names "$ENV_NAME" \
  --region "$REGION"

# Get the EB environment URL
EB_URL=$(aws elasticbeanstalk describe-environments \
  --application-name "$APP_NAME" \
  --environment-names "$ENV_NAME" \
  --region "$REGION" \
  --query 'Environments[0].CNAME' --output text)

# Get the ALB DNS name
ALB_DNS=$(aws elbv2 describe-load-balancers \
  --region "$REGION" \
  --query "LoadBalancers[?contains(DNSName, '${ENV_NAME}')].DNSName | [0]" \
  --output text 2>/dev/null || echo "")

echo "       EB URL: $EB_URL"
echo "       ALB DNS: $ALB_DNS"

# ── 9. Request ACM Certificate ────────────────────────────────────────────────
echo "[9/12] Requesting ACM SSL certificate for $DOMAIN..."
CERT_ARN=$(aws acm request-certificate \
  --domain-name "$DOMAIN" \
  --subject-alternative-names "$WWW_DOMAIN" \
  --validation-method DNS \
  --region "$REGION" \
  --query 'CertificateArn' --output text)
echo "       Certificate ARN: $CERT_ARN"
echo "       ACTION REQUIRED: Validate the certificate by adding the CNAME records"
echo "       shown in ACM console to your DNS provider for $DOMAIN."
echo "       (Run: aws acm describe-certificate --certificate-arn $CERT_ARN --region $REGION)"

# ── 10. Add HTTPS listener to ALB ─────────────────────────────────────────────
echo "[10/12] Skipping HTTPS listener until certificate is validated."
echo "        Once validated, run:"
echo "        bash scripts/add-https-listener.sh $CERT_ARN"

# ── 11. Route 53 ──────────────────────────────────────────────────────────────
echo "[11/12] Configuring Route 53..."

# Check if hosted zone exists
HOSTED_ZONE_ID=$(aws route53 list-hosted-zones-by-name \
  --dns-name "$DOMAIN" \
  --query "HostedZones[?Name=='${DOMAIN}.'].Id" \
  --output text | sed 's|/hostedzone/||')

if [ -z "$HOSTED_ZONE_ID" ]; then
  echo "       No Route 53 hosted zone found for $DOMAIN."
  echo "       Creating new hosted zone..."
  HOSTED_ZONE_ID=$(aws route53 create-hosted-zone \
    --name "$DOMAIN" \
    --caller-reference "personaconnect-$(date +%s)" \
    --hosted-zone-config "Comment=PersonaConnect main zone" \
    --query 'HostedZone.Id' --output text | sed 's|/hostedzone/||')
  echo "       New hosted zone: $HOSTED_ZONE_ID"
  echo "       ACTION REQUIRED: Update your domain registrar's nameservers to:"
  aws route53 list-resource-record-sets \
    --hosted-zone-id "$HOSTED_ZONE_ID" \
    --query "ResourceRecordSets[?Type=='NS'].ResourceRecords[].Value" \
    --output text
else
  echo "       Found existing hosted zone: $HOSTED_ZONE_ID"
fi

# Get ALB hosted zone ID for ap-south-1 (fixed value for this region)
ALB_HOSTED_ZONE="AP-SOUTH-1-ALB-HOSTED-ZONE"
ALB_HOSTED_ZONE_ID=$(aws elbv2 describe-load-balancers \
  --region "$REGION" \
  --query "LoadBalancers[?contains(DNSName, 'elasticbeanstalk')].CanonicalHostedZoneId | [0]" \
  --output text 2>/dev/null || echo "Z11Q36JB7WBZFM")

# Create A record alias for root domain → ALB
aws route53 change-resource-record-sets \
  --hosted-zone-id "$HOSTED_ZONE_ID" \
  --change-batch "{
    \"Changes\": [
      {
        \"Action\": \"UPSERT\",
        \"ResourceRecordSet\": {
          \"Name\": \"${DOMAIN}\",
          \"Type\": \"A\",
          \"AliasTarget\": {
            \"HostedZoneId\": \"${ALB_HOSTED_ZONE_ID}\",
            \"DNSName\": \"${EB_URL}\",
            \"EvaluateTargetHealth\": true
          }
        }
      },
      {
        \"Action\": \"UPSERT\",
        \"ResourceRecordSet\": {
          \"Name\": \"${WWW_DOMAIN}\",
          \"Type\": \"A\",
          \"AliasTarget\": {
            \"HostedZoneId\": \"${ALB_HOSTED_ZONE_ID}\",
            \"DNSName\": \"${EB_URL}\",
            \"EvaluateTargetHealth\": true
          }
        }
      }
    ]
  }"
echo "       Route 53 A records created → $EB_URL"

# ── 12. Summary ───────────────────────────────────────────────────────────────
echo ""
echo "========================================================"
echo "  Infrastructure created successfully!"
echo "========================================================"
echo ""
echo "  VPC ID          : $VPC_ID"
echo "  Subnet 1a       : $SUBNET1_ID"
echo "  Subnet 1b       : $SUBNET2_ID"
echo "  ALB SG          : $ALB_SG_ID"
echo "  EC2 SG          : $EC2_SG_ID"
echo "  EB Application  : $APP_NAME"
echo "  EB Environment  : $ENV_NAME"
echo "  EB URL          : $EB_URL"
echo "  Certificate ARN : $CERT_ARN"
echo "  Hosted Zone     : $HOSTED_ZONE_ID"
echo ""
echo "  NEXT STEPS:"
echo "  1. Validate the ACM certificate (check ACM console)"
echo "  2. Once validated, run: bash scripts/add-https-listener.sh $CERT_ARN"
echo "  3. Deploy the app: bash scripts/deploy-to-eb.sh"
echo "  4. Test: curl http://$DOMAIN"
echo ""
