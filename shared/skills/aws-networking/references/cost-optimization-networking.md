# Networking Cost Optimization

## Table of Contents

- [Cost Components](#cost-components)
- [NAT Gateway Optimization](#nat-gateway-optimization)
  - [Single NAT for Non-Production](#single-nat-for-non-production)
  - [NAT Instance for Low Traffic](#nat-instance-for-low-traffic)
  - [Reduce NAT Traffic](#reduce-nat-traffic)
- [Transit Gateway Optimization](#transit-gateway-optimization)
  - [Consolidate Attachments](#consolidate-attachments)
  - [Use VPC Peering for 2 VPCs](#use-vpc-peering-for-2-vpcs)
  - [Minimize Cross-Region Traffic](#minimize-cross-region-traffic)
- [VPC Endpoints Strategy](#vpc-endpoints-strategy)
  - [Always Use Gateway Endpoints](#always-use-gateway-endpoints)
  - [Interface Endpoints ROI](#interface-endpoints-roi)
  - [Share Endpoints via Route 53 Profiles](#share-endpoints-via-route-53-profiles)
- [Cross-AZ Traffic](#cross-az-traffic)
  - [Minimize Cross-AZ](#minimize-cross-az)
  - [EKS Topology Awareness](#eks-topology-awareness)
- [Data Transfer Out](#data-transfer-out)
  - [Use CloudFront](#use-cloudfront)
  - [Regional Endpoints](#regional-endpoints)
  - [Compress Everything](#compress-everything)
- [Monitoring Costs](#monitoring-costs)
  - [VPC Flow Logs Analysis](#vpc-flow-logs-analysis)
  - [Cost Explorer](#cost-explorer)
  - [CloudWatch Metrics](#cloudwatch-metrics)
- [Quick Wins Checklist](#quick-wins-checklist)

Strategies to reduce AWS networking costs.

## Cost Components

| Resource | Cost | Notes |
|----------|------|-------|
| NAT Gateway | ~$32/month + $0.045/GB | Biggest cost driver |
| Transit Gateway | ~$36/month + $0.02/GB | Per attachment |
| Interface Endpoints | ~$7.50/month each | + $0.01/GB |
| Gateway Endpoints | FREE | S3, DynamoDB only |
| VPC Peering | $0.01/GB (cross-AZ) | No hourly fee |
| Data Transfer Out | $0.09/GB | To internet |
| Cross-AZ | $0.01/GB each way | Adds up quickly |

## NAT Gateway Optimization

### Single NAT for Non-Production

```hcl
# Production: NAT per AZ for HA
# Non-prod: Single NAT saves ~$64/month

variable "environment" {
  type = string
}

locals {
  nat_count = var.environment == "prod" ? length(local.azs) : 1
}

resource "aws_nat_gateway" "main" {
  count = local.nat_count
  # ...
}
```

### NAT Instance for Low Traffic

For <5GB/month, NAT instance is cheaper:

```hcl
# t4g.nano: ~$3/month vs NAT Gateway ~$32/month
resource "aws_instance" "nat" {
  ami           = data.aws_ami.nat.id
  instance_type = "t4g.nano"
  subnet_id     = aws_subnet.public[0].id

  source_dest_check = false  # Required for NAT

  tags = { Name = "nat-instance" }
}
```

### Reduce NAT Traffic

1. **Use Gateway Endpoints** - S3/DynamoDB bypass NAT
2. **Use Interface Endpoints** - For high-traffic AWS services
3. **Cache externally fetched data** - Don't re-download
4. **Compress data** - Before transfer

## Transit Gateway Optimization

### Consolidate Attachments

Each attachment costs ~$36/month. Fewer is better:

```
BAD: 10 VPCs = 10 attachments = $360/month
GOOD: 3 shared-services VPCs with Transit Gateway = $108/month
```

### Use VPC Peering for 2 VPCs

```
2 VPCs: VPC Peering = $0/month (just data transfer)
2 VPCs: Transit Gateway = $72/month + data transfer

Break-even: ~3-4 VPCs
```

### Minimize Cross-Region Traffic

TGW peering: $0.02/GB each direction

Strategies:
- Replicate data locally
- Use regional services
- Cache at edge (CloudFront)

## VPC Endpoints Strategy

### Always Use Gateway Endpoints

```hcl
# FREE - no reason not to use
resource "aws_vpc_endpoint" "s3" {
  vpc_id            = aws_vpc.main.id
  service_name      = "com.amazonaws.${var.region}.s3"
  vpc_endpoint_type = "Gateway"
}
```

### Interface Endpoints ROI

Calculate break-even vs NAT:

```
NAT cost per GB: $0.045
Interface endpoint: $0.01/GB + $7.50/month

Break-even: $7.50 / ($0.045 - $0.01) = 214 GB/month

If service > 214 GB/month through NAT, use interface endpoint
```

### Share Endpoints via Route 53 Profiles

Instead of creating endpoints in every VPC:

```hcl
# Central VPC has endpoints
resource "aws_vpc_endpoint" "secrets" {
  vpc_id = aws_vpc.shared.id
  # ...
}

# Share via Route 53 Profile (Oct 2025)
resource "aws_route53_profile" "endpoints" {
  name = "shared-endpoints"
}

resource "aws_route53_profile_resource_association" "secrets" {
  profile_id   = aws_route53_profile.endpoints.id
  resource_arn = aws_vpc_endpoint.secrets.arn
}

# Associate profile with spoke VPCs
resource "aws_route53_profile_association" "spoke" {
  profile_id = aws_route53_profile.endpoints.id
  vpc_id     = aws_vpc.spoke.id
}
```

## Cross-AZ Traffic

Every cross-AZ hop costs $0.01/GB each way.

### Minimize Cross-AZ

1. **Use AZ-aware services** - DynamoDB local, ElastiCache replicas
2. **Topology-aware routing** - Kubernetes topology constraints
3. **Single-AZ for dev** - Not everything needs HA

```hcl
# Development: Single AZ
resource "aws_subnet" "private" {
  count = var.environment == "prod" ? 3 : 1
  # ...
}
```

### EKS Topology Awareness

```yaml
# Schedule pods in same AZ as data
apiVersion: v1
kind: Pod
spec:
  topologySpreadConstraints:
    - maxSkew: 1
      topologyKey: topology.kubernetes.io/zone
      whenUnsatisfiable: ScheduleAnyway
```

## Data Transfer Out

### Use CloudFront

CloudFront data transfer: $0.085/GB (vs $0.09 direct)
Plus caching reduces origin traffic.

### Regional Endpoints

Use regional S3 endpoints to avoid internet:

```hcl
# Regional endpoint (stays in AWS network)
aws s3 cp s3://bucket/file . --region us-east-1

# Avoid: s3.amazonaws.com (might route through internet)
```

### Compress Everything

```python
# Compress before uploading
import gzip
import boto3

s3 = boto3.client('s3')
data = gzip.compress(json.dumps(payload).encode())
s3.put_object(Bucket='bucket', Key='data.json.gz', Body=data)
```

## Monitoring Costs

### VPC Flow Logs Analysis

```sql
-- Find top talkers
SELECT
  srcaddr,
  dstaddr,
  sum(bytes) as total_bytes
FROM vpc_flow_logs
WHERE date = current_date - 1
GROUP BY srcaddr, dstaddr
ORDER BY total_bytes DESC
LIMIT 20;
```

### Cost Explorer

Filter by:
- Usage type contains "DataTransfer"
- Usage type contains "NatGateway"
- Service = "Amazon Virtual Private Cloud"

### CloudWatch Metrics

```hcl
resource "aws_cloudwatch_metric_alarm" "nat_bytes" {
  alarm_name          = "nat-gateway-high-traffic"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "BytesOutToDestination"
  namespace           = "AWS/NATGateway"
  period              = 86400  # Daily
  statistic           = "Sum"
  threshold           = 100000000000  # 100 GB
  alarm_description   = "NAT Gateway processed >100GB today"

  dimensions = {
    NatGatewayId = aws_nat_gateway.main.id
  }
}
```

## Quick Wins Checklist

1. [ ] Gateway endpoints for S3/DynamoDB (FREE)
2. [ ] Single NAT for non-prod environments
3. [ ] Interface endpoints for high-traffic services
4. [ ] VPC peering instead of TGW for 2 VPCs
5. [ ] Compress data before transfer
6. [ ] Use CloudFront for static content
7. [ ] Monitor NAT Gateway bytes processed
8. [ ] Review cross-AZ traffic patterns
