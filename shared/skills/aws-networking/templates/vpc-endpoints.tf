# VPC Endpoints
# Gateway endpoints (free) and Interface endpoints

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Variables
variable "prefix" {
  description = "Prefix for resource names"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID"
  type        = string
}

variable "vpc_cidr" {
  description = "VPC CIDR block"
  type        = string
}

variable "private_subnet_ids" {
  description = "Private subnet IDs for interface endpoints"
  type        = list(string)
}

variable "route_table_ids" {
  description = "Route table IDs for gateway endpoints"
  type        = list(string)
}

variable "enable_interface_endpoints" {
  description = "Enable interface endpoints (cost: ~$7.50/month each)"
  type        = bool
  default     = true
}

variable "interface_endpoints" {
  description = "List of interface endpoint services to create"
  type        = list(string)
  default = [
    "secretsmanager",
    "ssm",
    "ssmmessages",
    "ec2messages",
    "logs",
    "ecr.api",
    "ecr.dkr"
  ]
}

# Data sources
data "aws_region" "current" {}

# Locals
locals {
  common_tags = {
    ManagedBy = "terraform"
  }
}

# Security Group for Interface Endpoints
resource "aws_security_group" "vpc_endpoints" {
  count = var.enable_interface_endpoints ? 1 : 0

  name        = "${var.prefix}-vpc-endpoints-sg"
  description = "Security group for VPC interface endpoints"
  vpc_id      = var.vpc_id

  ingress {
    description = "HTTPS from VPC"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
  }

  egress {
    description = "Allow all outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.common_tags, {
    Name = "${var.prefix}-vpc-endpoints-sg"
  })
}

# Gateway Endpoints (FREE - always create)
resource "aws_vpc_endpoint" "s3" {
  vpc_id            = var.vpc_id
  service_name      = "com.amazonaws.${data.aws_region.current.name}.s3"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = var.route_table_ids

  tags = merge(local.common_tags, {
    Name = "${var.prefix}-s3-endpoint"
  })
}

resource "aws_vpc_endpoint" "dynamodb" {
  vpc_id            = var.vpc_id
  service_name      = "com.amazonaws.${data.aws_region.current.name}.dynamodb"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = var.route_table_ids

  tags = merge(local.common_tags, {
    Name = "${var.prefix}-dynamodb-endpoint"
  })
}

# Interface Endpoints
resource "aws_vpc_endpoint" "interface" {
  for_each = var.enable_interface_endpoints ? toset(var.interface_endpoints) : []

  vpc_id              = var.vpc_id
  service_name        = "com.amazonaws.${data.aws_region.current.name}.${each.value}"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = var.private_subnet_ids
  security_group_ids  = [aws_security_group.vpc_endpoints[0].id]
  private_dns_enabled = true

  tags = merge(local.common_tags, {
    Name = "${var.prefix}-${replace(each.value, ".", "-")}-endpoint"
  })
}

# Endpoint policies (optional - restrict access)
resource "aws_vpc_endpoint_policy" "s3" {
  vpc_endpoint_id = aws_vpc_endpoint.s3.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AllowAll"
        Effect    = "Allow"
        Principal = "*"
        Action    = "s3:*"
        Resource  = "*"
      }
    ]
  })
}

# Outputs
output "s3_endpoint_id" {
  description = "S3 Gateway endpoint ID"
  value       = aws_vpc_endpoint.s3.id
}

output "dynamodb_endpoint_id" {
  description = "DynamoDB Gateway endpoint ID"
  value       = aws_vpc_endpoint.dynamodb.id
}

output "interface_endpoint_ids" {
  description = "Map of interface endpoint IDs"
  value       = { for k, v in aws_vpc_endpoint.interface : k => v.id }
}

output "interface_endpoint_dns" {
  description = "Map of interface endpoint DNS names"
  value       = { for k, v in aws_vpc_endpoint.interface : k => v.dns_entry[0].dns_name }
}

output "vpc_endpoints_security_group_id" {
  description = "Security group ID for interface endpoints"
  value       = var.enable_interface_endpoints ? aws_security_group.vpc_endpoints[0].id : null
}
