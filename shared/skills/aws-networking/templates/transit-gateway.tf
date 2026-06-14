# Transit Gateway Setup
# Hub-and-spoke topology with multi-account support

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

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "amazon_side_asn" {
  description = "ASN for the Amazon side of the TGW"
  type        = number
  default     = 64512
}

variable "shared_account_ids" {
  description = "AWS account IDs to share TGW with via RAM"
  type        = list(string)
  default     = []
}

variable "vpc_attachments" {
  description = "Map of VPC attachments"
  type = map(object({
    vpc_id     = string
    subnet_ids = list(string)
    routes     = list(string)  # CIDR blocks to route to TGW
  }))
  default = {}
}

# Locals
locals {
  common_tags = {
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# Transit Gateway
resource "aws_ec2_transit_gateway" "main" {
  description                     = "${var.prefix} Transit Gateway"
  amazon_side_asn                 = var.amazon_side_asn
  auto_accept_shared_attachments  = "enable"
  default_route_table_association = "enable"
  default_route_table_propagation = "enable"
  dns_support                     = "enable"
  vpn_ecmp_support                = "enable"
  multicast_support               = "disable"

  tags = merge(local.common_tags, {
    Name = "${var.prefix}-tgw"
  })
}

# VPC Attachments
resource "aws_ec2_transit_gateway_vpc_attachment" "vpcs" {
  for_each = var.vpc_attachments

  transit_gateway_id = aws_ec2_transit_gateway.main.id
  vpc_id             = each.value.vpc_id
  subnet_ids         = each.value.subnet_ids

  dns_support                                     = "enable"
  transit_gateway_default_route_table_association = true
  transit_gateway_default_route_table_propagation = true

  tags = merge(local.common_tags, {
    Name = "${var.prefix}-tgw-attachment-${each.key}"
  })
}

# Route Table for segmentation (optional)
resource "aws_ec2_transit_gateway_route_table" "isolated" {
  transit_gateway_id = aws_ec2_transit_gateway.main.id

  tags = merge(local.common_tags, {
    Name = "${var.prefix}-tgw-rt-isolated"
  })
}

# Resource Access Manager for multi-account sharing
resource "aws_ram_resource_share" "tgw" {
  count = length(var.shared_account_ids) > 0 ? 1 : 0

  name                      = "${var.prefix}-tgw-share"
  allow_external_principals = false

  tags = merge(local.common_tags, {
    Name = "${var.prefix}-tgw-share"
  })
}

resource "aws_ram_resource_association" "tgw" {
  count = length(var.shared_account_ids) > 0 ? 1 : 0

  resource_arn       = aws_ec2_transit_gateway.main.arn
  resource_share_arn = aws_ram_resource_share.tgw[0].arn
}

resource "aws_ram_principal_association" "accounts" {
  for_each = toset(var.shared_account_ids)

  principal          = each.value
  resource_share_arn = aws_ram_resource_share.tgw[0].arn
}

# Outputs
output "transit_gateway_id" {
  description = "Transit Gateway ID"
  value       = aws_ec2_transit_gateway.main.id
}

output "transit_gateway_arn" {
  description = "Transit Gateway ARN"
  value       = aws_ec2_transit_gateway.main.arn
}

output "transit_gateway_route_table_id" {
  description = "Default route table ID"
  value       = aws_ec2_transit_gateway.main.association_default_route_table_id
}

output "vpc_attachment_ids" {
  description = "Map of VPC attachment IDs"
  value       = { for k, v in aws_ec2_transit_gateway_vpc_attachment.vpcs : k => v.id }
}

output "ram_share_arn" {
  description = "RAM resource share ARN"
  value       = length(var.shared_account_ids) > 0 ? aws_ram_resource_share.tgw[0].arn : null
}

# Example usage in spoke VPC (add routes to TGW)
# resource "aws_route" "to_tgw" {
#   for_each = toset(var.route_table_ids)
#
#   route_table_id         = each.value
#   destination_cidr_block = "10.0.0.0/8"  # Route all private to TGW
#   transit_gateway_id     = aws_ec2_transit_gateway.main.id
# }
