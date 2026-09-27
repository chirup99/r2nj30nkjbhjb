#!/usr/bin/env node
// End-to-end AWS deployment for PersonaConnect
// Creates: VPC, Subnets, IGW, Route Table, Security Groups (ALB + EC2),
//          IAM Roles, S3 bucket, EB Application + Load-Balanced Environment,
//          ACM Certificate request, Route 53 A records

const { EC2Client, CreateVpcCommand, ModifyVpcAttributeCommand,
  CreateInternetGatewayCommand, AttachInternetGatewayCommand,
  CreateSubnetCommand, ModifySubnetAttributeCommand,
  CreateRouteTableCommand, CreateRouteCommand, AssociateRouteTableCommand,
  CreateSecurityGroupCommand, AuthorizeSecurityGroupIngressCommand,
  DescribeAvailabilityZonesCommand } = await import('@aws-sdk/client-ec2');

const { ElasticBeanstalkClient, CreateApplicationCommand,
  CreateEnvironmentCommand, DescribeEnvironmentsCommand } = await import('@aws-sdk/client-elastic-beanstalk');

const { S3Client, CreateBucketCommand, PutObjectCommand,
  HeadBucketCommand } = await import('@aws-sdk/client-s3');

const { IAMClient, CreateRoleCommand, AttachRolePolicyCommand,
  CreateInstanceProfileCommand, AddRoleToInstanceProfileCommand,
  GetRoleCommand, GetInstanceProfileCommand } = await import('@aws-sdk/client-iam');

const { STSClient, GetCallerIdentityCommand } = await import('@aws-sdk/client-sts');

const { ACMClient, RequestCertificateCommand } = await import('@aws-sdk/client-acm');

const { Route53Client, ListHostedZonesByNameCommand, CreateHostedZoneCommand,
  ChangeResourceRecordSetsCommand, ListResourceRecordSetsCommand } = await import('@aws-sdk/client-route-53');

const { ElasticLoadBalancingV2Client, DescribeLoadBalancersCommand,
  DescribeListenersCommand, CreateListenerCommand,
  ModifyListenerCommand, DescribeTargetGroupsCommand } = await import('@aws-sdk/client-elastic-load-balancing-v2');

const fs = await import('fs');
const path = await import('path');
const { execSync } = await import('child_process');

// ─── Config ────────────────────────────────────────────────────────────────
const REGION       = 'ap-south-1';
const APP_NAME     = 'personaconnect';
const ENV_NAME     = 'personaconnect-prod';
const DOMAIN       = 'personaconnect.xyz';
const VPC_CIDR     = '10.2.0.0/16';
const S1_CIDR      = '10.2.1.0/24';
const S2_CIDR      = '10.2.2.0/24';
const PLATFORM     = '64bit Amazon Linux 2023 v6.5.1 running Node.js 20';
const INSTANCE     = 't3.small';
const CREDS = {
  accessKeyId:     process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
};

const cfg = { region: REGION, credentials: CREDS };
const ec2  = new EC2Client(cfg);
const eb   = new ElasticBeanstalkClient(cfg);
const s3   = new S3Client(cfg);
const iam  = new IAMClient({ credentials: CREDS }); // IAM is global
const sts  = new STSClient(cfg);
const acm  = new ACMClient(cfg);
const r53  = new Route53Client({ credentials: CREDS });
const alb  = new ElasticLoadBalancingV2Client(cfg);

const log = (step, msg) => console.log(`[${step}] ${msg}`);
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ─── 0. Get Account ID ─────────────────────────────────────────────────────
const { Account: ACCOUNT_ID } = await sts.send(new GetCallerIdentityCommand({}));
const S3_BUCKET = `${APP_NAME}-deploys-${ACCOUNT_ID}`;
log('0', `Account: ${ACCOUNT_ID}  Bucket: ${S3_BUCKET}`);

// ─── 1. Create VPC ─────────────────────────────────────────────────────────
log('1', `Creating VPC ${VPC_CIDR}...`);
const { Vpc } = await ec2.send(new CreateVpcCommand({
  CidrBlock: VPC_CIDR,
  TagSpecifications: [{ ResourceType: 'vpc', Tags: [
    { Key: 'Name', Value: `${APP_NAME}-vpc` },
    { Key: 'Project', Value: APP_NAME }
  ]}],
}));
const VPC_ID = Vpc.VpcId;
await ec2.send(new ModifyVpcAttributeCommand({ VpcId: VPC_ID, EnableDnsSupport: { Value: true } }));
await ec2.send(new ModifyVpcAttributeCommand({ VpcId: VPC_ID, EnableDnsHostnames: { Value: true } }));
log('1', `VPC: ${VPC_ID}`);

// ─── 2. Internet Gateway ───────────────────────────────────────────────────
log('2', 'Creating Internet Gateway...');
const { InternetGateway } = await ec2.send(new CreateInternetGatewayCommand({
  TagSpecifications: [{ ResourceType: 'internet-gateway', Tags: [
    { Key: 'Name', Value: `${APP_NAME}-igw` }
  ]}],
}));
const IGW_ID = InternetGateway.InternetGatewayId;
await ec2.send(new AttachInternetGatewayCommand({ VpcId: VPC_ID, InternetGatewayId: IGW_ID }));
log('2', `IGW: ${IGW_ID}`);

// ─── 3. Subnets (2 AZs required for ALB) ───────────────────────────────────
log('3', 'Getting available AZs and creating subnets...');
const { AvailabilityZones: AZs } = await ec2.send(new DescribeAvailabilityZonesCommand({
  Filters: [{ Name: 'state', Values: ['available'] }]
}));
const AZ1 = AZs[0].ZoneName;
const AZ2 = AZs[1].ZoneName;

const { Subnet: Sub1 } = await ec2.send(new CreateSubnetCommand({
  VpcId: VPC_ID, CidrBlock: S1_CIDR, AvailabilityZone: AZ1,
  TagSpecifications: [{ ResourceType: 'subnet', Tags: [{ Key: 'Name', Value: `${APP_NAME}-public-${AZ1}` }] }],
}));
const { Subnet: Sub2 } = await ec2.send(new CreateSubnetCommand({
  VpcId: VPC_ID, CidrBlock: S2_CIDR, AvailabilityZone: AZ2,
  TagSpecifications: [{ ResourceType: 'subnet', Tags: [{ Key: 'Name', Value: `${APP_NAME}-public-${AZ2}` }] }],
}));
const SUBNET1 = Sub1.SubnetId;
const SUBNET2 = Sub2.SubnetId;

await ec2.send(new ModifySubnetAttributeCommand({ SubnetId: SUBNET1, MapPublicIpOnLaunch: { Value: true } }));
await ec2.send(new ModifySubnetAttributeCommand({ SubnetId: SUBNET2, MapPublicIpOnLaunch: { Value: true } }));
log('3', `Subnet1(${AZ1}): ${SUBNET1}  Subnet2(${AZ2}): ${SUBNET2}`);

// ─── 4. Route Table ────────────────────────────────────────────────────────
log('4', 'Creating Route Table...');
const { RouteTable } = await ec2.send(new CreateRouteTableCommand({
  VpcId: VPC_ID,
  TagSpecifications: [{ ResourceType: 'route-table', Tags: [{ Key: 'Name', Value: `${APP_NAME}-rtb` }] }],
}));
const RTB_ID = RouteTable.RouteTableId;
await ec2.send(new CreateRouteCommand({ RouteTableId: RTB_ID, DestinationCidrBlock: '0.0.0.0/0', GatewayId: IGW_ID }));
await ec2.send(new AssociateRouteTableCommand({ RouteTableId: RTB_ID, SubnetId: SUBNET1 }));
await ec2.send(new AssociateRouteTableCommand({ RouteTableId: RTB_ID, SubnetId: SUBNET2 }));
log('4', `Route Table: ${RTB_ID}`);

// ─── 5. Security Groups ────────────────────────────────────────────────────
log('5', 'Creating Security Groups...');
const { GroupId: ALB_SG } = await ec2.send(new CreateSecurityGroupCommand({
  GroupName: `${APP_NAME}-alb-sg`,
  Description: 'PersonaConnect ALB - public HTTP/HTTPS',
  VpcId: VPC_ID,
  TagSpecifications: [{ ResourceType: 'security-group', Tags: [{ Key: 'Name', Value: `${APP_NAME}-alb-sg` }] }],
}));
await ec2.send(new AuthorizeSecurityGroupIngressCommand({ GroupId: ALB_SG, IpPermissions: [
  { IpProtocol: 'tcp', FromPort: 80,  ToPort: 80,  IpRanges: [{ CidrIp: '0.0.0.0/0' }] },
  { IpProtocol: 'tcp', FromPort: 443, ToPort: 443, IpRanges: [{ CidrIp: '0.0.0.0/0' }] },
]}));

const { GroupId: EC2_SG } = await ec2.send(new CreateSecurityGroupCommand({
  GroupName: `${APP_NAME}-ec2-sg`,
  Description: 'PersonaConnect EC2 - traffic from ALB only',
  VpcId: VPC_ID,
  TagSpecifications: [{ ResourceType: 'security-group', Tags: [{ Key: 'Name', Value: `${APP_NAME}-ec2-sg` }] }],
}));
await ec2.send(new AuthorizeSecurityGroupIngressCommand({ GroupId: EC2_SG, IpPermissions: [
  { IpProtocol: 'tcp', FromPort: 80, ToPort: 8080,
    UserIdGroupPairs: [{ GroupId: ALB_SG }] },
]}));
log('5', `ALB SG: ${ALB_SG}  EC2 SG: ${EC2_SG}`);

// ─── 6. IAM Roles ──────────────────────────────────────────────────────────
log('6', 'Creating IAM roles...');

const ensureRole = async (roleName, trustService, policies) => {
  try {
    const { Role } = await iam.send(new GetRoleCommand({ RoleName: roleName }));
    log('6', `  Role exists: ${roleName}`);
    return Role.Arn;
  } catch {
    const { Role } = await iam.send(new CreateRoleCommand({
      RoleName: roleName,
      AssumeRolePolicyDocument: JSON.stringify({
        Version: '2012-10-17',
        Statement: [{ Effect: 'Allow', Principal: { Service: trustService }, Action: 'sts:AssumeRole' }],
      }),
    }));
    for (const arn of policies) {
      await iam.send(new AttachRolePolicyCommand({ RoleName: roleName, PolicyArn: arn }));
    }
    log('6', `  Created role: ${roleName}`);
    return Role.Arn;
  }
};

const ensureInstanceProfile = async (profileName, roleName) => {
  try {
    const { InstanceProfile } = await iam.send(new GetInstanceProfileCommand({ InstanceProfileName: profileName }));
    log('6', `  Instance profile exists: ${profileName}`);
    return InstanceProfile.Arn;
  } catch {
    const { InstanceProfile } = await iam.send(new CreateInstanceProfileCommand({ InstanceProfileName: profileName }));
    await iam.send(new AddRoleToInstanceProfileCommand({ InstanceProfileName: profileName, RoleName: roleName }));
    log('6', `  Created instance profile: ${profileName}`);
    return InstanceProfile.Arn;
  }
};

await ensureRole(`${APP_NAME}-eb-service-role`, 'elasticbeanstalk.amazonaws.com', [
  'arn:aws:iam::aws:policy/service-role/AWSElasticBeanstalkEnhancedHealth',
  'arn:aws:iam::aws:policy/AWSElasticBeanstalkManagedUpdatesCustomerRolePolicy',
]);
await ensureRole(`${APP_NAME}-eb-ec2-role`, 'ec2.amazonaws.com', [
  'arn:aws:iam::aws:policy/AWSElasticBeanstalkWebTier',
  'arn:aws:iam::aws:policy/AmazonDynamoDBFullAccess',
]);
await ensureInstanceProfile(`${APP_NAME}-eb-ec2-profile`, `${APP_NAME}-eb-ec2-role`);
log('6', 'Waiting 15s for IAM propagation...');
await sleep(15000);

// ─── 7. S3 Bucket + Upload build ───────────────────────────────────────────
log('7', `Creating S3 bucket: ${S3_BUCKET}...`);
try {
  await s3.send(new CreateBucketCommand({
    Bucket: S3_BUCKET,
    CreateBucketConfiguration: { LocationConstraint: REGION },
  }));
  log('7', `  Bucket created: ${S3_BUCKET}`);
} catch (e) {
  if (e.name !== 'BucketAlreadyOwnedByYou') throw e;
  log('7', `  Bucket already exists: ${S3_BUCKET}`);
}

// Use pre-built zip (already built and zipped before this script runs)
const VERSION_LABEL = `${APP_NAME}-${Date.now()}`;
const ZIP_KEY       = `${VERSION_LABEL}.zip`;
const zipData       = fs.readFileSync('eb-deploy.zip');

log('7', `Uploading ${ZIP_KEY} to S3...`);
await s3.send(new PutObjectCommand({ Bucket: S3_BUCKET, Key: ZIP_KEY, Body: zipData }));
log('7', 'Upload complete.');

// ─── 8. EB Application ─────────────────────────────────────────────────────
log('8', `Creating EB application: ${APP_NAME}...`);
try {
  await eb.send(new CreateApplicationCommand({
    ApplicationName: APP_NAME,
    Description: 'PersonaConnect — Digital Persona Hub',
  }));
  log('8', '  Application created.');
} catch (e) {
  if (e.name !== 'InvalidParameterValueException') throw e;
  log('8', '  Application already exists.');
}

// ─── 9. EB Environment (ALB, Load Balanced) ────────────────────────────────
log('9', `Creating EB environment: ${ENV_NAME} (this takes 8-12 min)...`);

const { EnvironmentArn } = await eb.send(new CreateEnvironmentCommand({
  ApplicationName: APP_NAME,
  EnvironmentName: ENV_NAME,
  SolutionStackName: PLATFORM,
  VersionLabel: VERSION_LABEL,
  SourceBundle: { S3Bucket: S3_BUCKET, S3Key: ZIP_KEY },
  OptionSettings: [
    { Namespace: 'aws:ec2:vpc', OptionName: 'VPCId',                    Value: VPC_ID },
    { Namespace: 'aws:ec2:vpc', OptionName: 'Subnets',                  Value: `${SUBNET1},${SUBNET2}` },
    { Namespace: 'aws:ec2:vpc', OptionName: 'ELBSubnets',               Value: `${SUBNET1},${SUBNET2}` },
    { Namespace: 'aws:ec2:vpc', OptionName: 'AssociatePublicIpAddress',  Value: 'true' },
    { Namespace: 'aws:elasticbeanstalk:environment', OptionName: 'EnvironmentType', Value: 'LoadBalanced' },
    { Namespace: 'aws:elasticbeanstalk:environment', OptionName: 'ServiceRole',     Value: `${APP_NAME}-eb-service-role` },
    { Namespace: 'aws:elasticbeanstalk:environment', OptionName: 'LoadBalancerType', Value: 'application' },
    { Namespace: 'aws:autoscaling:launchconfiguration', OptionName: 'InstanceType',      Value: INSTANCE },
    { Namespace: 'aws:autoscaling:launchconfiguration', OptionName: 'IamInstanceProfile', Value: `${APP_NAME}-eb-ec2-profile` },
    { Namespace: 'aws:autoscaling:launchconfiguration', OptionName: 'SecurityGroups',     Value: EC2_SG },
    { Namespace: 'aws:elbv2:loadbalancer',              OptionName: 'SecurityGroups',     Value: ALB_SG },
    { Namespace: 'aws:autoscaling:asg', OptionName: 'MinSize', Value: '1' },
    { Namespace: 'aws:autoscaling:asg', OptionName: 'MaxSize', Value: '2' },
    { Namespace: 'aws:elasticbeanstalk:healthreporting:system', OptionName: 'SystemType', Value: 'enhanced' },
    { Namespace: 'aws:elasticbeanstalk:application:environment', OptionName: 'NODE_ENV',              Value: 'production' },
    { Namespace: 'aws:elasticbeanstalk:application:environment', OptionName: 'PORT',                  Value: '8080' },
    { Namespace: 'aws:elasticbeanstalk:application:environment', OptionName: 'AWS_REGION',            Value: REGION },
    { Namespace: 'aws:elasticbeanstalk:application:environment', OptionName: 'DYNAMODB_TABLE_NAME',   Value: 'Users' },
    { Namespace: 'aws:elasticbeanstalk:application:environment', OptionName: 'AWS_ACCESS_KEY_ID',     Value: CREDS.accessKeyId },
    { Namespace: 'aws:elasticbeanstalk:application:environment', OptionName: 'AWS_SECRET_ACCESS_KEY', Value: CREDS.secretAccessKey },
  ],
}));
log('9', `Environment ARN: ${EnvironmentArn}`);
log('9', 'Waiting for environment to become Ready...');

// Poll until Ready (typically 8-12 minutes)
let EB_URL = '';
for (let i = 0; i < 40; i++) {
  await sleep(30000);
  const { Environments } = await eb.send(new DescribeEnvironmentsCommand({
    ApplicationName: APP_NAME,
    EnvironmentNames: [ENV_NAME],
  }));
  const env = Environments[0];
  log('9', `  Status: ${env.Status}  Health: ${env.Health}  (${(i+1)*30}s)`);
  if (env.Status === 'Ready') {
    EB_URL = env.CNAME;
    log('9', `  Environment ready! URL: ${EB_URL}`);
    break;
  }
  if (env.Status === 'Terminated' || env.Status === 'Failed') {
    throw new Error(`Environment failed with status: ${env.Status}`);
  }
}

if (!EB_URL) throw new Error('Timed out waiting for EB environment. Check AWS console.');

// ─── 10. ACM Certificate ───────────────────────────────────────────────────
log('10', `Requesting ACM certificate for ${DOMAIN} and www.${DOMAIN}...`);
const { CertificateArn } = await acm.send(new RequestCertificateCommand({
  DomainName: DOMAIN,
  SubjectAlternativeNames: [`www.${DOMAIN}`],
  ValidationMethod: 'DNS',
}));
log('10', `Certificate ARN: ${CertificateArn}`);
log('10', '  NOTE: Validate this cert by adding CNAME records in Route 53 (auto below if hosted zone exists).');

// ─── 11. Route 53 ──────────────────────────────────────────────────────────
log('11', `Setting up Route 53 for ${DOMAIN}...`);

// Find or create hosted zone
let hostedZoneId = '';
const { HostedZones } = await r53.send(new ListHostedZonesByNameCommand({ DNSName: DOMAIN }));
const existing = HostedZones.find(z => z.Name === `${DOMAIN}.`);

if (existing) {
  hostedZoneId = existing.Id.replace('/hostedzone/', '');
  log('11', `  Found existing hosted zone: ${hostedZoneId}`);
} else {
  log('11', '  No hosted zone found — creating one...');
  const { HostedZone } = await r53.send(new CreateHostedZoneCommand({
    Name: DOMAIN,
    CallerReference: `personaconnect-${Date.now()}`,
    HostedZoneConfig: { Comment: 'PersonaConnect main zone' },
  }));
  hostedZoneId = HostedZone.Id.replace('/hostedzone/', '');
  log('11', `  Created hosted zone: ${hostedZoneId}`);

  // Print NS records for registrar update
  const { ResourceRecordSets } = await r53.send(new ListResourceRecordSetsCommand({ HostedZoneId: hostedZoneId }));
  const nsRecord = ResourceRecordSets.find(r => r.Type === 'NS');
  log('11', '  *** UPDATE YOUR DOMAIN REGISTRAR NAMESERVERS TO: ***');
  nsRecord?.ResourceRecords.forEach(r => log('11', `    ${r.Value}`));
}

// Get ALB canonical hosted zone ID for ap-south-1 (AWS fixed value)
// The ALB in ap-south-1 uses hosted zone Z11Q36JB7WBZFM
// But we get the actual value from the EB environment's ALB
let albDns   = EB_URL;
let albZoneId = 'Z11Q36JB7WBZFM'; // ap-south-1 ALB hosted zone

// Try to get the actual ALB zone from the load balancers
try {
  const { LoadBalancers } = await alb.send(new DescribeLoadBalancersCommand({}));
  const appAlb = LoadBalancers.find(l => l.DNSName.includes(ENV_NAME.toLowerCase().replace(/-/g, '')));
  if (appAlb) {
    albDns    = appAlb.DNSName;
    albZoneId = appAlb.CanonicalHostedZoneId;
    log('11', `  ALB DNS: ${albDns}  Zone: ${albZoneId}`);
  }
} catch { /* Use defaults */ }

// Create A (ALIAS) records for root and www
await r53.send(new ChangeResourceRecordSetsCommand({
  HostedZoneId: hostedZoneId,
  ChangeBatch: {
    Comment: 'PersonaConnect EB deployment',
    Changes: [
      {
        Action: 'UPSERT',
        ResourceRecordSet: {
          Name: `${DOMAIN}.`,
          Type: 'A',
          AliasTarget: { HostedZoneId: albZoneId, DNSName: `dualstack.${albDns}`, EvaluateTargetHealth: true },
        },
      },
      {
        Action: 'UPSERT',
        ResourceRecordSet: {
          Name: `www.${DOMAIN}.`,
          Type: 'A',
          AliasTarget: { HostedZoneId: albZoneId, DNSName: `dualstack.${albDns}`, EvaluateTargetHealth: true },
        },
      },
    ],
  },
}));
log('11', `  Route 53 A records created → ${albDns}`);

// ─── 12. Summary ───────────────────────────────────────────────────────────
console.log('\n' + '='.repeat(60));
console.log('  DEPLOYMENT COMPLETE');
console.log('='.repeat(60));
console.log(`  VPC          : ${VPC_ID}`);
console.log(`  Subnets      : ${SUBNET1}, ${SUBNET2}`);
console.log(`  ALB SG       : ${ALB_SG}`);
console.log(`  EC2 SG       : ${EC2_SG}`);
console.log(`  EB App       : ${APP_NAME}`);
console.log(`  EB Env       : ${ENV_NAME}`);
console.log(`  EB URL       : http://${EB_URL}`);
console.log(`  Cert ARN     : ${CertificateArn}`);
console.log(`  Hosted Zone  : ${hostedZoneId}`);
console.log(`  Domain       : http://${DOMAIN}  (HTTPS after cert validation)`);
console.log('');
console.log('  NEXT STEPS:');
console.log('  1. Validate the ACM certificate in the AWS console');
console.log('     (ACM > Certificates > Create CNAME records in Route 53)');
console.log('  2. After cert validation, run:');
console.log(`     node scripts/add-https.js ${CertificateArn}`);
console.log('='.repeat(60) + '\n');
