---
name: aws-networking
description: >
  AWS networking architecture with VPC, Transit Gateway, and PrivateLink using Terraform.
  Covers multi-AZ VPC design, CIDR planning, Transit Gateway hub-and-spoke topology,
  VPC peering, PrivateLink for service exposure, VPC endpoints (Gateway and Interface),
  security groups, NACLs, and hybrid connectivity patterns.
effort: low
paths:
  - "terraform/**"
  - "*.tf"
  - "infra/**"
---

# AWS Networking

Terraform patterns for production AWS network architecture.

## Required Interface Endpoints

Platform services require these VPC interface endpoints:

```hcl
locals {
  interface_endpoints = [
    "secretsmanager",
    "ssm",
    "ssmmessages",
    "ec2messages",
    "logs",
    "ecr.api",
    "ecr.dkr",
    "ecs",
    "ecs-agent",
    "ecs-telemetry"
  ]
}
```

## NAT Gateway Environment Strategy

Per-AZ NAT in prod for HA; single NAT in non-prod to reduce cost:

```hcl
resource "aws_nat_gateway" "single" {
  count         = var.environment == "prod" ? length(local.azs) : 1
  allocation_id = aws_eip.nat[count.index].id
  subnet_id     = aws_subnet.public[count.index].id
}
```

## Templates

| Template | Purpose |
|----------|---------|
| `${CLAUDE_SKILL_DIR}/templates/vpc-multi-az.tf` | Production VPC layout |
| `${CLAUDE_SKILL_DIR}/templates/transit-gateway.tf` | TGW with attachments |
| `${CLAUDE_SKILL_DIR}/templates/vpc-endpoints.tf` | Common endpoint patterns |
| `${CLAUDE_SKILL_DIR}/templates/privatelink-service.tf` | Expose service via PrivateLink |

## References

- `${CLAUDE_SKILL_DIR}/references/transit-gateway-patterns.md` - TGW architectures
- `${CLAUDE_SKILL_DIR}/references/cost-optimization-networking.md` - Reduce data transfer costs
