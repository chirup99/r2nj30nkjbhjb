#!/usr/bin/env node

/*
 * Provision a new, isolated PersonaConnect Elastic Beanstalk stack.
 *
 * This intentionally does not use or modify the existing Perala EB
 * application/environment. AWS credentials are read from the process
 * environment for provisioning only and are not copied into EB settings.
 */

const fs = await import("node:fs");
const {
  EC2Client,
  DescribeAvailabilityZonesCommand,
  DescribeVpcsCommand,
  CreateVpcCommand,
  ModifyVpcAttributeCommand,
  DescribeInternetGatewaysCommand,
  CreateInternetGatewayCommand,
  AttachInternetGatewayCommand,
  DescribeSubnetsCommand,
  CreateSubnetCommand,
  ModifySubnetAttributeCommand,
  DescribeRouteTablesCommand,
  CreateRouteTableCommand,
  CreateRouteCommand,
  AssociateRouteTableCommand,
  DescribeSecurityGroupsCommand,
  CreateSecurityGroupCommand,
  AuthorizeSecurityGroupIngressCommand,
} = await import("@aws-sdk/client-ec2");
const {
  ElasticBeanstalkClient,
  DescribeApplicationsCommand,
  CreateApplicationCommand,
  CreateApplicationVersionCommand,
  CreateEnvironmentCommand,
  DescribeEnvironmentsCommand,
  DescribeEnvironmentResourcesCommand,
} = await import("@aws-sdk/client-elastic-beanstalk");
const {
  S3Client,
  CreateBucketCommand,
  PutObjectCommand,
} = await import("@aws-sdk/client-s3");
const {
  IAMClient,
  GetRoleCommand,
  CreateRoleCommand,
  AttachRolePolicyCommand,
  GetInstanceProfileCommand,
  CreateInstanceProfileCommand,
  AddRoleToInstanceProfileCommand,
} = await import("@aws-sdk/client-iam");
const { STSClient, GetCallerIdentityCommand } = await import("@aws-sdk/client-sts");
const {
  ACMClient,
  ListCertificatesCommand,
  RequestCertificateCommand,
  DescribeCertificateCommand,
} = await import("@aws-sdk/client-acm");
const {
  Route53Client,
  ListHostedZonesByNameCommand,
  CreateHostedZoneCommand,
  ListResourceRecordSetsCommand,
  ChangeResourceRecordSetsCommand,
} = await import("@aws-sdk/client-route-53");
const {
  ElasticLoadBalancingV2Client,
  DescribeLoadBalancersCommand,
  DescribeListenersCommand,
  CreateListenerCommand,
  ModifyListenerCommand,
  DescribeTargetGroupsCommand,
} = await import("@aws-sdk/client-elastic-load-balancing-v2");

const REGION = "ap-south-1";
const APP_NAME = "personaconnect";
const ENV_NAME = "personaconnect-prod";
const DOMAIN = "personaconnect.xyz";
const WWW_DOMAIN = `www.${DOMAIN}`;
const PLATFORM = "64bit Amazon Linux 2023 v6.5.1 running Node.js 20";
const INSTANCE_TYPE = "t3.small";
const PROJECT_TAG = "personaconnect-current";
const VPC_CIDR = "10.2.0.0/16";
const SUBNET_CIDRS = ["10.2.1.0/24", "10.2.2.0/24"];

const cfg = { region: REGION };
const ec2 = new EC2Client(cfg);
const eb = new ElasticBeanstalkClient(cfg);
const s3 = new S3Client(cfg);
const iam = new IAMClient({ region: "us-east-1" });
const sts = new STSClient(cfg);
const acm = new ACMClient(cfg);
const r53 = new Route53Client({ region: "us-east-1" });
const alb = new ElasticLoadBalancingV2Client(cfg);

const log = (step, message) => console.log(`[${step}] ${message}`);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const tag = (key, value) => ({ Key: key, Value: value });

function isDuplicate(error) {
  return [
    "InvalidPermission.Duplicate",
    "RouteAlreadyExists",
    "InvalidRoute.Duplicate",
    "ResourceInUseException",
  ].includes(error?.name);
}

async function ensureRole(roleName, service, policyArns) {
  try {
    const result = await iam.send(new GetRoleCommand({ RoleName: roleName }));
    return result.Role.Arn;
  } catch (error) {
    if (error.name !== "NoSuchEntity") throw error;
    const result = await iam.send(new CreateRoleCommand({
      RoleName: roleName,
      AssumeRolePolicyDocument: JSON.stringify({
        Version: "2012-10-17",
        Statement: [{
          Effect: "Allow",
          Principal: { Service: service },
          Action: "sts:AssumeRole",
        }],
      }),
      Tags: [tag("Project", PROJECT_TAG)],
    }));
    for (const policyArn of policyArns) {
      await iam.send(new AttachRolePolicyCommand({ RoleName: roleName, PolicyArn: policyArn }));
    }
    return result.Role.Arn;
  }
}

async function ensureInstanceProfile(profileName, roleName) {
  try {
    const result = await iam.send(new GetInstanceProfileCommand({
      InstanceProfileName: profileName,
    }));
    return result.InstanceProfile.Arn;
  } catch (error) {
    if (error.name !== "NoSuchEntity") throw error;
    const result = await iam.send(new CreateInstanceProfileCommand({
      InstanceProfileName: profileName,
      Tags: [tag("Project", PROJECT_TAG)],
    }));
    await iam.send(new AddRoleToInstanceProfileCommand({
      InstanceProfileName: profileName,
      RoleName: roleName,
    }));
    return result.InstanceProfile.Arn;
  }
}

async function getOrCreateVpc() {
  const existing = await ec2.send(new DescribeVpcsCommand({
    Filters: [{ Name: "tag:Project", Values: [PROJECT_TAG] }],
  }));
  if (existing.Vpcs?.[0]) return existing.Vpcs[0].VpcId;
  const result = await ec2.send(new CreateVpcCommand({
    CidrBlock: VPC_CIDR,
    TagSpecifications: [{
      ResourceType: "vpc",
      Tags: [tag("Name", `${APP_NAME}-vpc`), tag("Project", PROJECT_TAG)],
    }],
  }));
  const vpcId = result.Vpc.VpcId;
  await ec2.send(new ModifyVpcAttributeCommand({
    VpcId: vpcId,
    EnableDnsSupport: { Value: true },
  }));
  await ec2.send(new ModifyVpcAttributeCommand({
    VpcId: vpcId,
    EnableDnsHostnames: { Value: true },
  }));
  return vpcId;
}

async function getOrCreateSubnets(vpcId, availabilityZones) {
  const existing = await ec2.send(new DescribeSubnetsCommand({
    Filters: [{ Name: "vpc-id", Values: [vpcId] }, { Name: "tag:Project", Values: [PROJECT_TAG] }],
  }));
  const byAz = new Map((existing.Subnets || []).map((subnet) => [subnet.AvailabilityZone, subnet]));
  const subnets = [];
  for (let i = 0; i < 2; i += 1) {
    const az = availabilityZones[i];
    if (byAz.has(az)) {
      subnets.push(byAz.get(az));
      continue;
    }
    const result = await ec2.send(new CreateSubnetCommand({
      VpcId: vpcId,
      CidrBlock: SUBNET_CIDRS[i],
      AvailabilityZone: az,
      TagSpecifications: [{
        ResourceType: "subnet",
        Tags: [tag("Name", `${APP_NAME}-public-${az}`), tag("Project", PROJECT_TAG)],
      }],
    }));
    await ec2.send(new ModifySubnetAttributeCommand({
      SubnetId: result.Subnet.SubnetId,
      MapPublicIpOnLaunch: { Value: true },
    }));
    subnets.push(result.Subnet);
  }
  return subnets;
}

async function ensureNetwork(vpcId, subnets) {
  const gateways = await ec2.send(new DescribeInternetGatewaysCommand({
    Filters: [{ Name: "attachment.vpc-id", Values: [vpcId] }],
  }));
  let igw = gateways.InternetGateways?.[0];
  if (!igw) {
    const created = await ec2.send(new CreateInternetGatewayCommand({
      TagSpecifications: [{
        ResourceType: "internet-gateway",
        Tags: [tag("Name", `${APP_NAME}-igw`), tag("Project", PROJECT_TAG)],
      }],
    }));
    igw = created.InternetGateway;
    await ec2.send(new AttachInternetGatewayCommand({
      VpcId: vpcId,
      InternetGatewayId: igw.InternetGatewayId,
    }));
  }

  const routeTables = await ec2.send(new DescribeRouteTablesCommand({
    Filters: [{ Name: "vpc-id", Values: [vpcId] }, { Name: "tag:Project", Values: [PROJECT_TAG] }],
  }));
  let routeTable = routeTables.RouteTables?.[0];
  if (!routeTable) {
    const created = await ec2.send(new CreateRouteTableCommand({
      VpcId: vpcId,
      TagSpecifications: [{
        ResourceType: "route-table",
        Tags: [tag("Name", `${APP_NAME}-public-rt`), tag("Project", PROJECT_TAG)],
      }],
    }));
    routeTable = created.RouteTable;
    try {
      await ec2.send(new CreateRouteCommand({
        RouteTableId: routeTable.RouteTableId,
        DestinationCidrBlock: "0.0.0.0/0",
        GatewayId: igw.InternetGatewayId,
      }));
    } catch (error) {
      if (!isDuplicate(error)) throw error;
    }
  }
  for (const subnet of subnets) {
    const associated = routeTable.Associations?.some((association) => association.SubnetId === subnet.SubnetId);
    if (!associated) {
      try {
        await ec2.send(new AssociateRouteTableCommand({
          RouteTableId: routeTable.RouteTableId,
          SubnetId: subnet.SubnetId,
        }));
      } catch (error) {
        if (!isDuplicate(error)) throw error;
      }
    }
  }
}

async function getOrCreateSecurityGroups(vpcId) {
  const groups = await ec2.send(new DescribeSecurityGroupsCommand({
    Filters: [{ Name: "vpc-id", Values: [vpcId] }, { Name: "tag:Project", Values: [PROJECT_TAG] }],
  }));
  let albGroup = groups.SecurityGroups?.find((group) => group.GroupName === `${APP_NAME}-alb-sg`);
  let instanceGroup = groups.SecurityGroups?.find((group) => group.GroupName === `${APP_NAME}-instance-sg`);
  if (!albGroup) {
    const result = await ec2.send(new CreateSecurityGroupCommand({
      GroupName: `${APP_NAME}-alb-sg`,
      Description: "PersonaConnect public ALB HTTP and HTTPS",
      VpcId: vpcId,
      TagSpecifications: [{ ResourceType: "security-group", Tags: [tag("Project", PROJECT_TAG)] }],
    }));
    albGroup = { GroupId: result.GroupId };
  }
  if (!instanceGroup) {
    const result = await ec2.send(new CreateSecurityGroupCommand({
      GroupName: `${APP_NAME}-instance-sg`,
      Description: "PersonaConnect EB instances from the ALB only",
      VpcId: vpcId,
      TagSpecifications: [{ ResourceType: "security-group", Tags: [tag("Project", PROJECT_TAG)] }],
    }));
    instanceGroup = { GroupId: result.GroupId };
  }
  for (const port of [80, 443]) {
    try {
      await ec2.send(new AuthorizeSecurityGroupIngressCommand({
        GroupId: albGroup.GroupId,
        IpPermissions: [{ IpProtocol: "tcp", FromPort: port, ToPort: port, IpRanges: [{ CidrIp: "0.0.0.0/0" }] }],
      }));
    } catch (error) {
      if (!isDuplicate(error)) throw error;
    }
  }
  try {
    await ec2.send(new AuthorizeSecurityGroupIngressCommand({
      GroupId: instanceGroup.GroupId,
      IpPermissions: [{
        IpProtocol: "tcp",
        FromPort: 8080,
        ToPort: 8080,
        UserIdGroupPairs: [{ GroupId: albGroup.GroupId }],
      }],
    }));
  } catch (error) {
    if (!isDuplicate(error)) throw error;
  }
  return { alb: albGroup.GroupId, instance: instanceGroup.GroupId };
}

async function ensureHostedZone() {
  const result = await r53.send(new ListHostedZonesByNameCommand({ DNSName: DOMAIN }));
  const existing = result.HostedZones?.find((zone) => zone.Name === `${DOMAIN}.` && !zone.Config?.PrivateZone);
  if (existing) return existing.Id.replace("/hostedzone/", "");
  const created = await r53.send(new CreateHostedZoneCommand({
    Name: DOMAIN,
    CallerReference: `${PROJECT_TAG}-${Date.now()}`,
    HostedZoneConfig: { Comment: "PersonaConnect current project" },
  }));
  return created.HostedZone.Id.replace("/hostedzone/", "");
}

async function upsertRecords(hostedZoneId, changes) {
  await r53.send(new ChangeResourceRecordSetsCommand({
    HostedZoneId: hostedZoneId,
    ChangeBatch: { Changes: changes.map((ResourceRecordSet) => ({ Action: "UPSERT", ResourceRecordSet })) },
  }));
}

async function getOrCreateCertificate() {
  const result = await acm.send(new ListCertificatesCommand({
    CertificateStatuses: ["PENDING_VALIDATION", "ISSUED", "INACTIVE"],
  }));
  const existing = (result.CertificateSummaryList || []).find((certificate) =>
    certificate.DomainName === DOMAIN &&
    certificate.SubjectAlternativeNameSummaries?.includes(WWW_DOMAIN)
  );
  if (existing) return existing.CertificateArn;
  const created = await acm.send(new RequestCertificateCommand({
    DomainName: DOMAIN,
    SubjectAlternativeNames: [WWW_DOMAIN],
    ValidationMethod: "DNS",
  }));
  return created.CertificateArn;
}

async function addCertificateValidationRecords(certificateArn, hostedZoneId) {
  const result = await acm.send(new DescribeCertificateCommand({ CertificateArn: certificateArn }));
  const records = (result.Certificate.DomainValidationOptions || [])
    .map((option) => option.ResourceRecord)
    .filter(Boolean)
    .map((record) => ({
      Name: record.Name,
      Type: record.Type,
      TTL: 300,
      ResourceRecords: [{ Value: record.Value }],
    }));
  if (records.length) await upsertRecords(hostedZoneId, records);
  return result.Certificate.Status;
}

async function waitForEnvironment() {
  for (let attempt = 1; attempt <= 30; attempt += 1) {
    const result = await eb.send(new DescribeEnvironmentsCommand({
      ApplicationName: APP_NAME,
      EnvironmentNames: [ENV_NAME],
    }));
    const environment = result.Environments?.[0];
    log("EB", `status=${environment?.Status} health=${environment?.Health || "pending"} (${attempt}/30)`);
    if (environment?.Status === "Ready") return environment;
    if (["Terminated", "Failed"].includes(environment?.Status)) {
      throw new Error(`Elastic Beanstalk environment failed: ${environment.Status}`);
    }
    await sleep(30000);
  }
  throw new Error("Timed out waiting for Elastic Beanstalk. Check the AWS console.");
}

async function main() {
  if (!fs.existsSync("eb-deploy.zip")) {
    throw new Error("eb-deploy.zip is missing. Build the EB bundle first.");
  }
  const identity = await sts.send(new GetCallerIdentityCommand({}));
  log("AWS", `account=${identity.Account} region=${REGION}`);
  log("SAFE", "Only resources tagged personaconnect-current will be created/reused.");

  const azResult = await ec2.send(new DescribeAvailabilityZonesCommand({
    Filters: [{ Name: "state", Values: ["available"] }],
  }));
  const azs = (azResult.AvailabilityZones || []).slice(0, 2).map((az) => az.ZoneName);
  if (azs.length < 2) throw new Error("Mumbai region did not return two available AZs.");

  const vpcId = await getOrCreateVpc();
  const subnets = await getOrCreateSubnets(vpcId, azs);
  await ensureNetwork(vpcId, subnets);
  const securityGroups = await getOrCreateSecurityGroups(vpcId);
  log("VPC", `${vpcId} subnets=${subnets.map((subnet) => subnet.SubnetId).join(",")}`);
  log("SG", `alb=${securityGroups.alb} instance=${securityGroups.instance}`);

  const serviceRoleName = `${APP_NAME}-eb-service-role`;
  const instanceRoleName = `${APP_NAME}-eb-instance-role`;
  const instanceProfileName = `${APP_NAME}-eb-instance-profile`;
  await ensureRole(serviceRoleName, "elasticbeanstalk.amazonaws.com", [
    "arn:aws:iam::aws:policy/service-role/AWSElasticBeanstalkEnhancedHealth",
    "arn:aws:iam::aws:policy/AWSElasticBeanstalkManagedUpdatesCustomerRolePolicy",
  ]);
  await ensureRole(instanceRoleName, "ec2.amazonaws.com", [
    "arn:aws:iam::aws:policy/AWSElasticBeanstalkWebTier",
    "arn:aws:iam::aws:policy/AmazonDynamoDBFullAccess",
  ]);
  await ensureInstanceProfile(instanceProfileName, instanceRoleName);
  await sleep(15000);

  const bucketName = `${APP_NAME}-eb-deploys-${identity.Account}`;
  try {
    await s3.send(new CreateBucketCommand({
      Bucket: bucketName,
      CreateBucketConfiguration: { LocationConstraint: REGION },
    }));
  } catch (error) {
    if (error.name !== "BucketAlreadyOwnedByYou") throw error;
  }
  const versionLabel = `${APP_NAME}-${Date.now()}`;
  await s3.send(new PutObjectCommand({
    Bucket: bucketName,
    Key: `${versionLabel}.zip`,
    Body: fs.readFileSync("eb-deploy.zip"),
  }));

  try {
    await eb.send(new CreateApplicationCommand({
      ApplicationName: APP_NAME,
      Description: "PersonaConnect current project",
    }));
  } catch (error) {
    if (error.name !== "InvalidParameterValueException") throw error;
  }
  await eb.send(new CreateApplicationVersionCommand({
    ApplicationName: APP_NAME,
    VersionLabel: versionLabel,
    SourceBundle: { S3Bucket: bucketName, S3Key: `${versionLabel}.zip` },
  }));

  const hostedZoneId = await ensureHostedZone();
  const certificateArn = await getOrCreateCertificate();
  const certificateStatus = await addCertificateValidationRecords(certificateArn, hostedZoneId);
  log("DNS", `hosted-zone=${hostedZoneId} certificate=${certificateStatus}`);

  let environment;
  const existingEnvironment = await eb.send(new DescribeEnvironmentsCommand({
    ApplicationName: APP_NAME,
    EnvironmentNames: [ENV_NAME],
  }));
  if (existingEnvironment.Environments?.[0]) {
    environment = existingEnvironment.Environments[0];
    log("EB", `reusing ${ENV_NAME} status=${environment.Status}`);
  } else {
    await eb.send(new CreateEnvironmentCommand({
      ApplicationName: APP_NAME,
      EnvironmentName: ENV_NAME,
      SolutionStackName: PLATFORM,
      VersionLabel: versionLabel,
      OptionSettings: [
        { Namespace: "aws:ec2:vpc", OptionName: "VPCId", Value: vpcId },
        { Namespace: "aws:ec2:vpc", OptionName: "Subnets", Value: subnets.map((s) => s.SubnetId).join(",") },
        { Namespace: "aws:ec2:vpc", OptionName: "ELBSubnets", Value: subnets.map((s) => s.SubnetId).join(",") },
        { Namespace: "aws:ec2:vpc", OptionName: "AssociatePublicIpAddress", Value: "true" },
        { Namespace: "aws:elasticbeanstalk:environment", OptionName: "EnvironmentType", Value: "LoadBalanced" },
        { Namespace: "aws:elasticbeanstalk:environment", OptionName: "ServiceRole", Value: serviceRoleName },
        { Namespace: "aws:elasticbeanstalk:environment", OptionName: "LoadBalancerType", Value: "application" },
        { Namespace: "aws:autoscaling:launchconfiguration", OptionName: "InstanceType", Value: INSTANCE_TYPE },
        { Namespace: "aws:autoscaling:launchconfiguration", OptionName: "IamInstanceProfile", Value: instanceProfileName },
        { Namespace: "aws:autoscaling:launchconfiguration", OptionName: "SecurityGroups", Value: securityGroups.instance },
        { Namespace: "aws:elbv2:loadbalancer", OptionName: "SecurityGroups", Value: securityGroups.alb },
        { Namespace: "aws:autoscaling:asg", OptionName: "MinSize", Value: "1" },
        { Namespace: "aws:autoscaling:asg", OptionName: "MaxSize", Value: "2" },
        { Namespace: "aws:elasticbeanstalk:healthreporting:system", OptionName: "SystemType", Value: "enhanced" },
        { Namespace: "aws:elasticbeanstalk:application:environment", OptionName: "NODE_ENV", Value: "production" },
        { Namespace: "aws:elasticbeanstalk:application:environment", OptionName: "PORT", Value: "8080" },
        { Namespace: "aws:elasticbeanstalk:application:environment", OptionName: "AWS_REGION", Value: REGION },
        { Namespace: "aws:elasticbeanstalk:application:environment", OptionName: "DYNAMODB_TABLE_NAME", Value: "Users" },
        { Namespace: "aws:elasticbeanstalk:environment:process:default", OptionName: "Port", Value: "8080" },
        { Namespace: "aws:elasticbeanstalk:environment:process:default", OptionName: "HealthCheckPath", Value: "/" },
      ],
    }));
    log("EB", "environment creation started");
  }

  environment = await waitForEnvironment();
  const resources = await eb.send(new DescribeEnvironmentResourcesCommand({
    EnvironmentName: ENV_NAME,
    EnvironmentId: environment.EnvironmentId,
  }));
  const loadBalancerName = resources.LoadBalancers?.[0]?.Name;
  if (!loadBalancerName) throw new Error("Elastic Beanstalk did not return an ALB.");
  const loadBalancers = await alb.send(new DescribeLoadBalancersCommand({
    Names: [loadBalancerName],
  }));
  const loadBalancer = loadBalancers.LoadBalancers?.[0];
  if (!loadBalancer) throw new Error("Could not describe the PersonaConnect ALB.");
  await upsertRecords(hostedZoneId, [
    {
      Name: `${DOMAIN}.`,
      Type: "A",
      AliasTarget: {
        HostedZoneId: loadBalancer.CanonicalHostedZoneId,
        DNSName: `dualstack.${loadBalancer.DNSName}`,
        EvaluateTargetHealth: true,
      },
    },
    {
      Name: `${WWW_DOMAIN}.`,
      Type: "A",
      AliasTarget: {
        HostedZoneId: loadBalancer.CanonicalHostedZoneId,
        DNSName: `dualstack.${loadBalancer.DNSName}`,
        EvaluateTargetHealth: true,
      },
    },
  ]);

  const listeners = await alb.send(new DescribeListenersCommand({
    LoadBalancerArn: loadBalancer.LoadBalancerArn,
  }));
  const targetGroups = await alb.send(new DescribeTargetGroupsCommand({
    LoadBalancerArn: loadBalancer.LoadBalancerArn,
  }));
  const targetGroup = targetGroups.TargetGroups?.[0];
  const cert = await acm.send(new DescribeCertificateCommand({ CertificateArn: certificateArn }));
  if (cert.Certificate.Status === "ISSUED" && targetGroup) {
    if (!listeners.Listeners?.some((listener) => listener.Port === 443)) {
      await alb.send(new CreateListenerCommand({
        LoadBalancerArn: loadBalancer.LoadBalancerArn,
        Protocol: "HTTPS",
        Port: 443,
        Certificates: [{ CertificateArn: certificateArn }],
        SslPolicy: "ELBSecurityPolicy-TLS13-1-2-2021-06",
        DefaultActions: [{ Type: "forward", TargetGroupArn: targetGroup.TargetGroupArn }],
      }));
    }
    const http = listeners.Listeners?.find((listener) => listener.Port === 80);
    if (http) {
      await alb.send(new ModifyListenerCommand({
        ListenerArn: http.ListenerArn,
        DefaultActions: [{
          Type: "redirect",
          RedirectConfig: { Protocol: "HTTPS", Port: "443", StatusCode: "HTTP_301" },
        }],
      }));
    }
    log("HTTPS", "certificate issued and HTTPS listener configured");
  } else {
    log("HTTPS", `certificate is ${cert.Certificate.Status}; update registrar nameservers before HTTPS can activate`);
  }

  const zoneRecords = await r53.send(new ListResourceRecordSetsCommand({ HostedZoneId: hostedZoneId }));
  const ns = zoneRecords.ResourceRecordSets?.find((record) => record.Type === "NS");
  console.log("\nDEPLOYMENT SUMMARY");
  console.log(`Region: ${REGION}`);
  console.log(`Elastic Beanstalk: ${APP_NAME}/${ENV_NAME}`);
  console.log(`EB URL: http://${environment.CNAME}`);
  console.log(`ALB DNS: ${loadBalancer.DNSName}`);
  console.log(`VPC: ${vpcId}`);
  console.log(`Route 53 zone: ${hostedZoneId}`);
  console.log(`Certificate: ${certificateArn}`);
  if (ns) {
    console.log("Route 53 nameservers (set these at the domain registrar):");
    for (const record of ns.ResourceRecords || []) console.log(`  ${record.Value}`);
  }
  console.log("AWS access keys were not added to the EB environment.");
}

main().catch((error) => {
  console.error(`Deployment failed: ${error.name || "Error"}: ${error.message}`);
  process.exitCode = 1;
});