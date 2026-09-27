#!/usr/bin/env node
// Continue deployment from step 6 (IAM) onwards
// VPC infrastructure already created in previous run

// ─── IDs from successful previous run ──────────────────────────────────────
const VPC_ID  = 'vpc-0ee32dc6332e2e86e';
const SUBNET1 = 'subnet-03e0f58d3deb3935a';
const SUBNET2 = 'subnet-04aa259cef829fc60';
const ALB_SG  = 'sg-012fb548133a3fa79';
const EC2_SG  = 'sg-0c44a9dce726eb4eb';

// ─── Config ────────────────────────────────────────────────────────────────
const REGION   = 'ap-south-1';
const APP_NAME = 'personaconnect';
const ENV_NAME = 'personaconnect-prod';
const DOMAIN   = 'personaconnect.xyz';
const PLATFORM = '64bit Amazon Linux 2023 v6.5.1 running Node.js 20';
const INSTANCE = 't3.small';
const ACCOUNT_ID = '323726447850';
const S3_BUCKET  = `${APP_NAME}-deploys-${ACCOUNT_ID}`;

const CREDS = {
  accessKeyId:     process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
};
const cfg    = { region: REGION, credentials: CREDS };
const iamCfg = { region: 'us-east-1', credentials: CREDS }; // IAM is global, use us-east-1

const { IAMClient, CreateRoleCommand, AttachRolePolicyCommand,
  CreateInstanceProfileCommand, AddRoleToInstanceProfileCommand,
  GetRoleCommand, GetInstanceProfileCommand } = await import('@aws-sdk/client-iam');

const { ElasticBeanstalkClient, CreateApplicationCommand,
  CreateEnvironmentCommand, CreateApplicationVersionCommand,
  DescribeEnvironmentsCommand } = await import('@aws-sdk/client-elastic-beanstalk');

const { S3Client, CreateBucketCommand, PutObjectCommand } = await import('@aws-sdk/client-s3');

const { ACMClient, RequestCertificateCommand } = await import('@aws-sdk/client-acm');

const { Route53Client, ListHostedZonesByNameCommand, CreateHostedZoneCommand,
  ChangeResourceRecordSetsCommand, ListResourceRecordSetsCommand } = await import('@aws-sdk/client-route-53');

const { ElasticLoadBalancingV2Client, DescribeLoadBalancersCommand } = await import('@aws-sdk/client-elastic-load-balancing-v2');

const fs = await import('fs');

const iam  = new IAMClient(iamCfg);
const eb   = new ElasticBeanstalkClient(cfg);
const s3   = new S3Client(cfg);
const acm  = new ACMClient(cfg);
const r53  = new Route53Client({ region: 'us-east-1', credentials: CREDS });
const alb  = new ElasticLoadBalancingV2Client(cfg);

const log   = (step, msg) => console.log(`[${step}] ${msg}`);
const sleep = ms => new Promise(r => setTimeout(r, ms));

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
      try {
        await iam.send(new AttachRolePolicyCommand({ RoleName: roleName, PolicyArn: arn }));
      } catch (e) { log('6', `  Policy attach warn: ${e.message}`); }
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
    try {
      await iam.send(new AddRoleToInstanceProfileCommand({ InstanceProfileName: profileName, RoleName: roleName }));
    } catch (e) { log('6', `  Role attach warn: ${e.message}`); }
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
log('6', 'Waiting 20s for IAM propagation...');
await sleep(20000);

// ─── 7. S3 Bucket + Upload ─────────────────────────────────────────────────
log('7', `S3 bucket: ${S3_BUCKET}`);
try {
  await s3.send(new CreateBucketCommand({
    Bucket: S3_BUCKET,
    CreateBucketConfiguration: { LocationConstraint: REGION },
  }));
  log('7', '  Bucket created.');
} catch (e) {
  if (e.name !== 'BucketAlreadyOwnedByYou') throw e;
  log('7', '  Bucket already exists.');
}

const VERSION_LABEL = `${APP_NAME}-${Date.now()}`;
const ZIP_KEY       = `${VERSION_LABEL}.zip`;
const zipData       = fs.readFileSync('eb-deploy.zip');
log('7', `Uploading ${ZIP_KEY} to s3://${S3_BUCKET}/...`);
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
  log('8', `  Already exists or: ${e.message}`);
}

// Create application version separately
log('8', `Creating application version ${VERSION_LABEL}...`);
await eb.send(new CreateApplicationVersionCommand({
  ApplicationName: APP_NAME,
  VersionLabel: VERSION_LABEL,
  SourceBundle: { S3Bucket: S3_BUCKET, S3Key: ZIP_KEY },
}));
log('8', '  Version created.');

// ─── 9. EB Environment ─────────────────────────────────────────────────────
log('9', `Creating EB environment: ${ENV_NAME}...`);

try {
  await eb.send(new CreateEnvironmentCommand({
    ApplicationName: APP_NAME,
    EnvironmentName: ENV_NAME,
    SolutionStackName: PLATFORM,
    VersionLabel: VERSION_LABEL,
    OptionSettings: [
      { Namespace: 'aws:ec2:vpc', OptionName: 'VPCId',                    Value: VPC_ID },
      { Namespace: 'aws:ec2:vpc', OptionName: 'Subnets',                  Value: `${SUBNET1},${SUBNET2}` },
      { Namespace: 'aws:ec2:vpc', OptionName: 'ELBSubnets',               Value: `${SUBNET1},${SUBNET2}` },
      { Namespace: 'aws:ec2:vpc', OptionName: 'AssociatePublicIpAddress',  Value: 'true' },
      { Namespace: 'aws:elasticbeanstalk:environment', OptionName: 'EnvironmentType',  Value: 'LoadBalanced' },
      { Namespace: 'aws:elasticbeanstalk:environment', OptionName: 'ServiceRole',      Value: `${APP_NAME}-eb-service-role` },
      { Namespace: 'aws:elasticbeanstalk:environment', OptionName: 'LoadBalancerType', Value: 'application' },
      { Namespace: 'aws:autoscaling:launchconfiguration', OptionName: 'InstanceType',       Value: INSTANCE },
      { Namespace: 'aws:autoscaling:launchconfiguration', OptionName: 'IamInstanceProfile',  Value: `${APP_NAME}-eb-ec2-profile` },
      { Namespace: 'aws:autoscaling:launchconfiguration', OptionName: 'SecurityGroups',      Value: EC2_SG },
      { Namespace: 'aws:elbv2:loadbalancer',              OptionName: 'SecurityGroups',      Value: ALB_SG },
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
  log('9', 'Environment creation initiated.');
} catch (e) {
  log('9', `Error: ${e.message}`);
  throw e;
}

log('9', 'Polling for Ready status (checks every 30s, timeout ~15 min)...');
let EB_URL = '';
for (let i = 0; i < 30; i++) {
  await sleep(30000);
  const { Environments } = await eb.send(new DescribeEnvironmentsCommand({
    ApplicationName: APP_NAME,
    EnvironmentNames: [ENV_NAME],
  }));
  const env = Environments[0];
  log('9', `  [${(i+1)*30}s] Status: ${env?.Status}  Health: ${env?.Health}`);
  if (env?.Status === 'Ready') {
    EB_URL = env.CNAME;
    log('9', `  Ready! URL: ${EB_URL}`);
    break;
  }
  if (env?.Status === 'Terminated') throw new Error('Environment terminated unexpectedly.');
}
if (!EB_URL) throw new Error('Timed out — check AWS console for status.');

// ─── 10. ACM Certificate ───────────────────────────────────────────────────
log('10', `Requesting ACM certificate for ${DOMAIN}...`);
const { CertificateArn } = await acm.send(new RequestCertificateCommand({
  DomainName: DOMAIN,
  SubjectAlternativeNames: [`www.${DOMAIN}`],
  ValidationMethod: 'DNS',
}));
log('10', `Certificate ARN: ${CertificateArn}`);

// ─── 11. Route 53 ──────────────────────────────────────────────────────────
log('11', `Route 53 setup for ${DOMAIN}...`);
let hostedZoneId = '';
const { HostedZones } = await r53.send(new ListHostedZonesByNameCommand({ DNSName: DOMAIN }));
const existing = HostedZones.find(z => z.Name === `${DOMAIN}.`);

if (existing) {
  hostedZoneId = existing.Id.replace('/hostedzone/', '');
  log('11', `  Existing zone: ${hostedZoneId}`);
} else {
  const { HostedZone } = await r53.send(new CreateHostedZoneCommand({
    Name: DOMAIN,
    CallerReference: `persona-${Date.now()}`,
    HostedZoneConfig: { Comment: 'PersonaConnect' },
  }));
  hostedZoneId = HostedZone.Id.replace('/hostedzone/', '');
  log('11', `  Created zone: ${hostedZoneId}`);
  const { ResourceRecordSets } = await r53.send(new ListResourceRecordSetsCommand({ HostedZoneId: hostedZoneId }));
  const ns = ResourceRecordSets.find(r => r.Type === 'NS');
  log('11', '  >>> UPDATE REGISTRAR NAMESERVERS TO <<<');
  ns?.ResourceRecords.forEach(r => log('11', `      ${r.Value}`));
}

// Find ALB hosted zone ID
let albDns = EB_URL;
let albZoneId = 'Z11Q36JB7WBZFM'; // ap-south-1 default
try {
  const { LoadBalancers } = await alb.send(new DescribeLoadBalancersCommand({}));
  const appAlb = LoadBalancers.find(l => l.Type === 'application' &&
    l.DNSName.toLowerCase().includes('personaconnect'));
  if (appAlb) {
    albDns    = appAlb.DNSName;
    albZoneId = appAlb.CanonicalHostedZoneId;
    log('11', `  ALB DNS: ${albDns}  Hosted Zone: ${albZoneId}`);
  }
} catch (e) { log('11', `  ALB lookup: ${e.message} — using defaults`); }

await r53.send(new ChangeResourceRecordSetsCommand({
  HostedZoneId: hostedZoneId,
  ChangeBatch: {
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
log('11', `  DNS records → ${albDns}`);

// ─── Summary ───────────────────────────────────────────────────────────────
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
console.log(`  Domain       : https://${DOMAIN}  (HTTPS after cert validation)`);
console.log('');
console.log('  NEXT: Validate ACM cert then run:');
console.log(`        node scripts/add-https.js ${CertificateArn}`);
console.log('='.repeat(60));
