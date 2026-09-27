#!/usr/bin/env node
// Add HTTPS listener to the ALB and redirect HTTP → HTTPS
// Usage: node scripts/add-https.js <certificate-arn>

const { ElasticLoadBalancingV2Client, DescribeLoadBalancersCommand,
  DescribeListenersCommand, CreateListenerCommand,
  ModifyListenerCommand, DescribeTargetGroupsCommand } = await import('@aws-sdk/client-elastic-load-balancing-v2');

const { ElasticBeanstalkClient, DescribeEnvironmentsCommand } = await import('@aws-sdk/client-elastic-beanstalk');

const CERT_ARN = process.argv[2];
if (!CERT_ARN) { console.error('Usage: node scripts/add-https.js <certificate-arn>'); process.exit(1); }

const REGION  = 'ap-south-1';
const ENV_NAME = 'personaconnect-prod';
const APP_NAME = 'personaconnect';
const CREDS = { accessKeyId: process.env.AWS_ACCESS_KEY_ID, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY };
const cfg   = { region: REGION, credentials: CREDS };
const alb   = new ElasticLoadBalancingV2Client(cfg);
const eb    = new ElasticBeanstalkClient(cfg);

console.log('==> Adding HTTPS to PersonaConnect ALB...');

// Get EB environment CNAME
const { Environments } = await eb.send(new DescribeEnvironmentsCommand({
  ApplicationName: APP_NAME, EnvironmentNames: [ENV_NAME],
}));
const cname = Environments[0]?.CNAME;
console.log(`    EB CNAME: ${cname}`);

// Find the ALB for this environment
const { LoadBalancers } = await alb.send(new DescribeLoadBalancersCommand({}));
const appAlb = LoadBalancers.find(l =>
  l.Type === 'application' && l.DNSName.toLowerCase().includes('personaconnect')
) || LoadBalancers.find(l => l.Type === 'application');

if (!appAlb) { console.error('ALB not found. Make sure the EB environment is ready.'); process.exit(1); }
console.log(`    ALB: ${appAlb.LoadBalancerArn}`);
console.log(`    DNS: ${appAlb.DNSName}`);

// Get target groups
const { TargetGroups } = await alb.send(new DescribeTargetGroupsCommand({
  LoadBalancerArn: appAlb.LoadBalancerArn,
}));
const tg = TargetGroups[0];
console.log(`    Target Group: ${tg.TargetGroupArn}`);

// Get existing listeners
const { Listeners } = await alb.send(new DescribeListenersCommand({
  LoadBalancerArn: appAlb.LoadBalancerArn,
}));
const http80 = Listeners.find(l => l.Port === 80);

// Add HTTPS listener on port 443
console.log('    Creating HTTPS listener (port 443)...');
const { Listeners: [httpsListener] } = await alb.send(new CreateListenerCommand({
  LoadBalancerArn: appAlb.LoadBalancerArn,
  Protocol: 'HTTPS',
  Port: 443,
  Certificates: [{ CertificateArn: CERT_ARN }],
  SslPolicy: 'ELBSecurityPolicy-TLS13-1-2-2021-06',
  DefaultActions: [{ Type: 'forward', TargetGroupArn: tg.TargetGroupArn }],
}));
console.log(`    HTTPS listener created: ${httpsListener.ListenerArn}`);

// Redirect HTTP → HTTPS
if (http80) {
  console.log('    Redirecting HTTP → HTTPS...');
  await alb.send(new ModifyListenerCommand({
    ListenerArn: http80.ListenerArn,
    DefaultActions: [{
      Type: 'redirect',
      RedirectConfig: { Protocol: 'HTTPS', Port: '443', StatusCode: 'HTTP_301' },
    }],
  }));
  console.log('    HTTP → HTTPS redirect enabled.');
}

console.log('\n==> HTTPS setup complete!');
console.log(`    https://personaconnect.xyz`);
