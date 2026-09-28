---
name: AWS deployment permissions
description: Permission boundary and isolation rule for provisioning the PersonaConnect AWS stack
---

The AWS identity used for PersonaConnect provisioning must be able to create a VPC and related EC2 networking, pass EB IAM roles, upload an EB bundle to S3, create the Elastic Beanstalk environment and ALB, request ACM certificates, and manage the dedicated Route 53 hosted zone. If the identity is denied at the first VPC action, stop before selecting or modifying any existing Perala resource.

**Why:** The imported project uses AWS credentials associated with an existing Perala deployment, and the identity can be valid while still lacking infrastructure-creation permissions.

**How to apply:** Confirm the deployment identity has the required create/pass-role permissions before retrying the isolated stack; keep the new resource names and project tags separate from the existing Perala environment.