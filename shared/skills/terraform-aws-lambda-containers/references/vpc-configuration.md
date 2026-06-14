# VPC Configuration for Lambda

Detailed networking configuration for VPC-connected Lambda functions.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                    VPC                                       │
│  ┌─────────────────────────────┐  ┌─────────────────────────────┐          │
│  │      Public Subnet          │  │      Public Subnet          │          │
│  │   ┌─────────────────────┐   │  │   ┌─────────────────────┐   │          │
│  │   │    NAT Gateway      │   │  │   │    NAT Gateway      │   │          │
│  │   └─────────────────────┘   │  │   └─────────────────────┘   │          │
│  │            │                │  │            │                │          │
│  └────────────│────────────────┘  └────────────│────────────────┘          │
│               │                                │                            │
│  ┌────────────▼────────────────┐  ┌────────────▼────────────────┐          │
│  │     Private Subnet          │  │     Private Subnet          │          │
│  │   ┌─────────────────────┐   │  │   ┌─────────────────────┐   │          │
│  │   │   Lambda Function   │   │  │   │      RDS/Aurora     │   │          │
│  │   └─────────────────────┘   │  │   └─────────────────────┘   │          │
│  └─────────────────────────────┘  └─────────────────────────────┘          │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Why VPC for Lambda?

Connect Lambda to:
- RDS/Aurora databases in private subnets
- ElastiCache Redis/Memcached
- Internal ALBs/NLBs
- Other VPC resources (EFS, etc.)

## Network Requirements

### 1. Private Subnets

Lambda functions should be in private subnets:

```hcl
resource "aws_subnet" "private" {
  count             = 2
  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(aws_vpc.main.cidr_block, 8, count.index + 10)
  availability_zone = data.aws_availability_zones.available.names[count.index]

  tags = {
    Name = "private-${count.index + 1}"
    Type = "private"
  }
}
```

### 2. NAT Gateway for Internet Access

Lambdas in private subnets need NAT Gateway for:
- Calling external APIs
- Accessing AWS services (S3, DynamoDB, etc.)

```hcl
resource "aws_eip" "nat" {
  count  = 2
  domain = "vpc"

  tags = {
    Name = "nat-eip-${count.index + 1}"
  }
}

resource "aws_nat_gateway" "main" {
  count         = 2
  allocation_id = aws_eip.nat[count.index].id
  subnet_id     = aws_subnet.public[count.index].id

  tags = {
    Name = "nat-gateway-${count.index + 1}"
  }
}
```

### 3. Route Tables

Route private subnet traffic through NAT:

```hcl
resource "aws_route_table" "private" {
  count  = 2
  vpc_id = aws_vpc.main.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.main[count.index].id
  }

  tags = {
    Name = "private-rt-${count.index + 1}"
  }
}

resource "aws_route_table_association" "private" {
  count          = 2
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private[count.index].id
}
```

### 4. Security Group

Control Lambda network access:

```hcl
resource "aws_security_group" "lambda" {
  name        = "${var.app_name}-lambda-sg"
  description = "Security group for Lambda functions"
  vpc_id      = aws_vpc.main.id

  # Outbound to database
  egress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.database.id]
    description     = "PostgreSQL"
  }

  # Outbound to Redis
  egress {
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.redis.id]
    description     = "Redis"
  }

  # Outbound to internet (via NAT)
  egress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTPS outbound"
  }

  tags = {
    Name = "${var.app_name}-lambda-sg"
  }
}
```

## Lambda VPC Configuration

```hcl
resource "aws_lambda_function" "main" {
  function_name = var.function_name
  # ... other config

  vpc_config {
    subnet_ids         = aws_subnet.private[*].id
    security_group_ids = [aws_security_group.lambda.id]
  }
}
```

## VPC Endpoints (Cost Optimization)

Use VPC endpoints instead of NAT for AWS services:

```hcl
# S3 Gateway Endpoint (free)
resource "aws_vpc_endpoint" "s3" {
  vpc_id            = aws_vpc.main.id
  service_name      = "com.amazonaws.${var.region}.s3"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = aws_route_table.private[*].id
}

# DynamoDB Gateway Endpoint (free)
resource "aws_vpc_endpoint" "dynamodb" {
  vpc_id            = aws_vpc.main.id
  service_name      = "com.amazonaws.${var.region}.dynamodb"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = aws_route_table.private[*].id
}

# Secrets Manager Interface Endpoint
resource "aws_vpc_endpoint" "secretsmanager" {
  vpc_id              = aws_vpc.main.id
  service_name        = "com.amazonaws.${var.region}.secretsmanager"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = aws_subnet.private[*].id
  security_group_ids  = [aws_security_group.vpc_endpoints.id]
  private_dns_enabled = true
}
```

**Gateway endpoints** (S3, DynamoDB): Free, use route tables
**Interface endpoints**: ~$7.30/month each, use ENIs

## IAM Permissions

Lambda needs VPC execution role:

```hcl
resource "aws_iam_role_policy_attachment" "vpc_execution" {
  role       = aws_iam_role.lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}
```

This grants:
- `ec2:CreateNetworkInterface`
- `ec2:DescribeNetworkInterfaces`
- `ec2:DeleteNetworkInterface`
- `ec2:AssignPrivateIpAddresses`
- `ec2:UnassignPrivateIpAddresses`

## Troubleshooting

### Timeout Connecting to External APIs

**Symptom**: Lambda times out when calling external APIs

**Check**:
1. NAT Gateway exists in public subnet
2. Private subnet route table has 0.0.0.0/0 → NAT Gateway
3. Security group allows outbound 443

### Cannot Connect to RDS

**Symptom**: Connection refused to database

**Check**:
1. Lambda security group has outbound to RDS port
2. RDS security group has inbound from Lambda security group
3. Lambda and RDS in same VPC

### ENI Limit Reached

**Symptom**: Lambda fails to create network interface

**Check**:
1. Account ENI limits (default varies by region)
2. Request limit increase if needed
3. Consider reducing Lambda concurrency

### Cold Start Latency

VPC Lambdas have longer cold starts due to ENI attachment.

**Mitigate**:
- Use provisioned concurrency
- Keep functions warm with scheduled pings
- Use VPC endpoints instead of NAT where possible
