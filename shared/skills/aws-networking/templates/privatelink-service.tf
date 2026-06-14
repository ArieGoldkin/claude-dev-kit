# PrivateLink Endpoint Service
# Expose internal service privately to consumers

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

variable "subnet_ids" {
  description = "Subnet IDs for NLB"
  type        = list(string)
}

variable "service_port" {
  description = "Port the backend service listens on"
  type        = number
  default     = 443
}

variable "health_check_path" {
  description = "Health check path"
  type        = string
  default     = "/health"
}

variable "target_type" {
  description = "Target type (instance, ip, alb)"
  type        = string
  default     = "ip"
}

variable "acceptance_required" {
  description = "Require manual acceptance of endpoint connections"
  type        = bool
  default     = true
}

variable "allowed_principals" {
  description = "List of AWS principal ARNs allowed to connect"
  type        = list(string)
  default     = []
}

# Data sources
data "aws_region" "current" {}

# Locals
locals {
  common_tags = {
    ManagedBy = "terraform"
  }
}

# Network Load Balancer (required for PrivateLink)
resource "aws_lb" "internal" {
  name               = "${var.prefix}-internal-nlb"
  internal           = true
  load_balancer_type = "network"
  subnets            = var.subnet_ids

  enable_cross_zone_load_balancing = true
  enable_deletion_protection       = false

  tags = merge(local.common_tags, {
    Name = "${var.prefix}-internal-nlb"
  })
}

# Target Group
resource "aws_lb_target_group" "service" {
  name        = "${var.prefix}-tg"
  port        = var.service_port
  protocol    = "TCP"
  vpc_id      = var.vpc_id
  target_type = var.target_type

  health_check {
    enabled             = true
    protocol            = "HTTPS"
    path                = var.health_check_path
    port                = "traffic-port"
    healthy_threshold   = 2
    unhealthy_threshold = 2
    interval            = 30
  }

  tags = merge(local.common_tags, {
    Name = "${var.prefix}-tg"
  })
}

# NLB Listener
resource "aws_lb_listener" "service" {
  load_balancer_arn = aws_lb.internal.arn
  port              = var.service_port
  protocol          = "TCP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.service.arn
  }
}

# VPC Endpoint Service
resource "aws_vpc_endpoint_service" "main" {
  acceptance_required        = var.acceptance_required
  network_load_balancer_arns = [aws_lb.internal.arn]

  allowed_principals = var.allowed_principals

  tags = merge(local.common_tags, {
    Name = "${var.prefix}-endpoint-service"
  })
}

# Optional: Private DNS name (requires domain verification)
# resource "aws_vpc_endpoint_service_private_dns_verification" "main" {
#   service_id = aws_vpc_endpoint_service.main.id
# }

# Outputs
output "endpoint_service_name" {
  description = "Service name for consumers to use"
  value       = aws_vpc_endpoint_service.main.service_name
}

output "endpoint_service_id" {
  description = "Endpoint service ID"
  value       = aws_vpc_endpoint_service.main.id
}

output "nlb_arn" {
  description = "Network Load Balancer ARN"
  value       = aws_lb.internal.arn
}

output "nlb_dns_name" {
  description = "Network Load Balancer DNS name"
  value       = aws_lb.internal.dns_name
}

output "target_group_arn" {
  description = "Target group ARN (register targets here)"
  value       = aws_lb_target_group.service.arn
}

# Example: Consumer creates endpoint to connect
# resource "aws_vpc_endpoint" "consumer" {
#   vpc_id              = var.consumer_vpc_id
#   service_name        = aws_vpc_endpoint_service.main.service_name
#   vpc_endpoint_type   = "Interface"
#   subnet_ids          = var.consumer_subnet_ids
#   security_group_ids  = [aws_security_group.consumer.id]
#   private_dns_enabled = false
# }
