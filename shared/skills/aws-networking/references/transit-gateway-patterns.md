# Transit Gateway Architecture Patterns

## Table of Contents

- [Hub-and-Spoke (Basic)](#hub-and-spoke-basic)
- [Segmented Network](#segmented-network)
  - [Implementation](#implementation)
- [Multi-Region](#multi-region)
  - [Implementation](#implementation-1)
- [Multi-Account with AWS Organizations](#multi-account-with-aws-organizations)
  - [Implementation](#implementation-2)
  - [Spoke Account](#spoke-account)
- [Centralized Egress](#centralized-egress)
  - [Route Tables](#route-tables)
- [Hybrid Connectivity](#hybrid-connectivity)
  - [Site-to-Site VPN](#site-to-site-vpn)
- [Best Practices](#best-practices)

Common TGW topologies and use cases.

## Hub-and-Spoke (Basic)

Most common pattern - central TGW with spoke VPCs.

```
                    ┌─────────────────┐
                    │  Transit Gateway │
                    │    (Hub)         │
                    └────────┬────────┘
           ┌─────────────────┼─────────────────┐
           │                 │                 │
    ┌──────▼──────┐   ┌──────▼──────┐   ┌──────▼──────┐
    │   VPC-A     │   │   VPC-B     │   │   VPC-C     │
    │ Production  │   │   Staging   │   │   Shared    │
    └─────────────┘   └─────────────┘   └─────────────┘
```

**Pros:**
- Simple to understand
- All VPCs can communicate
- Easy to add new spokes

**Cons:**
- No isolation between spokes
- All traffic routes through TGW

## Segmented Network

Use multiple route tables for isolation.

```
Transit Gateway
├── Route Table: Production
│   └── Association: VPC-Prod
├── Route Table: Development
│   └── Association: VPC-Dev, VPC-Test
└── Route Table: Shared-Services
    └── Association: VPC-Shared

Propagation rules control which VPCs see each other.
```

### Implementation

```hcl
# Production route table - only sees shared services
resource "aws_ec2_transit_gateway_route_table" "production" {
  transit_gateway_id = aws_ec2_transit_gateway.main.id
  tags = { Name = "production-rt" }
}

resource "aws_ec2_transit_gateway_route_table_association" "prod_vpc" {
  transit_gateway_attachment_id  = aws_ec2_transit_gateway_vpc_attachment.prod.id
  transit_gateway_route_table_id = aws_ec2_transit_gateway_route_table.production.id
}

# Only propagate shared services to production
resource "aws_ec2_transit_gateway_route_table_propagation" "shared_to_prod" {
  transit_gateway_attachment_id  = aws_ec2_transit_gateway_vpc_attachment.shared.id
  transit_gateway_route_table_id = aws_ec2_transit_gateway_route_table.production.id
}
```

## Multi-Region

Connect TGWs across regions via peering.

```
Region: us-east-1                    Region: eu-west-1
┌──────────────────┐                ┌──────────────────┐
│  Transit Gateway │◄──── Peering ──►│  Transit Gateway │
│    TGW-East      │                │    TGW-West      │
└────────┬─────────┘                └────────┬─────────┘
         │                                   │
    ┌────▼────┐                         ┌────▼────┐
    │  VPCs   │                         │  VPCs   │
    └─────────┘                         └─────────┘
```

### Implementation

```hcl
# In us-east-1
resource "aws_ec2_transit_gateway_peering_attachment" "east_to_west" {
  provider                = aws.east
  transit_gateway_id      = aws_ec2_transit_gateway.east.id
  peer_transit_gateway_id = aws_ec2_transit_gateway.west.id
  peer_region             = "eu-west-1"

  tags = { Name = "east-to-west-peering" }
}

# In eu-west-1 - accept the peering
resource "aws_ec2_transit_gateway_peering_attachment_accepter" "west" {
  provider                          = aws.west
  transit_gateway_attachment_id     = aws_ec2_transit_gateway_peering_attachment.east_to_west.id

  tags = { Name = "accept-east-peering" }
}

# Add static routes for cross-region traffic
resource "aws_ec2_transit_gateway_route" "to_west" {
  provider                       = aws.east
  destination_cidr_block         = "10.1.0.0/16"  # West region CIDR
  transit_gateway_attachment_id  = aws_ec2_transit_gateway_peering_attachment.east_to_west.id
  transit_gateway_route_table_id = aws_ec2_transit_gateway.east.association_default_route_table_id
}
```

## Multi-Account with AWS Organizations

Share TGW across accounts using RAM.

```
┌─────────────────────────────────────────────────────────┐
│                   AWS Organizations                      │
├─────────────────┬─────────────────┬─────────────────────┤
│  Network Account │  Account A      │  Account B          │
│  (TGW Owner)     │  (Spoke)        │  (Spoke)            │
│                  │                 │                     │
│  Transit Gateway │  VPC-A ────────►│  VPC-B ────────────►│
│       │          │       attachment│       attachment    │
│       ▼          │                 │                     │
│  RAM Share ─────►│◄────────────────│◄────────────────────│
└─────────────────┴─────────────────┴─────────────────────┘
```

### Implementation

```hcl
# Network account - share TGW
resource "aws_ram_resource_share" "tgw" {
  name                      = "transit-gateway-share"
  allow_external_principals = false  # Only within org
}

resource "aws_ram_resource_association" "tgw" {
  resource_arn       = aws_ec2_transit_gateway.main.arn
  resource_share_arn = aws_ram_resource_share.tgw.arn
}

# Share with entire organization
resource "aws_ram_principal_association" "org" {
  principal          = data.aws_organizations_organization.main.arn
  resource_share_arn = aws_ram_resource_share.tgw.arn
}

# Or share with specific OUs
resource "aws_ram_principal_association" "workloads_ou" {
  principal          = "arn:aws:organizations::111111111111:ou/o-abc123/ou-xxxx-workloads"
  resource_share_arn = aws_ram_resource_share.tgw.arn
}
```

### Spoke Account

```hcl
# In spoke account - create attachment
data "aws_ec2_transit_gateway" "shared" {
  filter {
    name   = "options.amazon-side-asn"
    values = ["64512"]  # Match the shared TGW
  }
}

resource "aws_ec2_transit_gateway_vpc_attachment" "spoke" {
  transit_gateway_id = data.aws_ec2_transit_gateway.shared.id
  vpc_id             = aws_vpc.spoke.id
  subnet_ids         = aws_subnet.private[*].id
}
```

## Centralized Egress

Route all internet traffic through a central firewall VPC.

```
                    ┌─────────────────┐
                    │  Transit Gateway │
                    └────────┬────────┘
           ┌─────────────────┼─────────────────┐
           │                 │                 │
    ┌──────▼──────┐   ┌──────▼──────┐   ┌──────▼──────┐
    │  Spoke VPC  │   │  Spoke VPC  │   │ Firewall VPC│
    │  (no IGW)   │   │  (no IGW)   │   │  NAT + FW   │
    └─────────────┘   └─────────────┘   │     │       │
                                        │     ▼       │
                                        │  Internet   │
                                        └─────────────┘
```

### Route Tables

```hcl
# Spoke VPC - route all traffic to TGW
resource "aws_route" "spoke_to_tgw" {
  route_table_id         = aws_route_table.spoke_private.id
  destination_cidr_block = "0.0.0.0/0"
  transit_gateway_id     = aws_ec2_transit_gateway.main.id
}

# TGW route table - send 0.0.0.0/0 to firewall VPC
resource "aws_ec2_transit_gateway_route" "default" {
  destination_cidr_block         = "0.0.0.0/0"
  transit_gateway_attachment_id  = aws_ec2_transit_gateway_vpc_attachment.firewall.id
  transit_gateway_route_table_id = aws_ec2_transit_gateway.main.association_default_route_table_id
}
```

## Hybrid Connectivity

Connect on-premises via VPN or Direct Connect.

```
On-Premises                      AWS
┌───────────┐                ┌─────────────────┐
│  Data     │    VPN/DX      │ Transit Gateway │
│  Center   │◄──────────────►│                 │
└───────────┘                └────────┬────────┘
                                      │
                               ┌──────┴──────┐
                               │    VPCs     │
                               └─────────────┘
```

### Site-to-Site VPN

```hcl
resource "aws_customer_gateway" "onprem" {
  bgp_asn    = 65000
  ip_address = var.onprem_vpn_ip
  type       = "ipsec.1"
}

resource "aws_vpn_connection" "onprem" {
  customer_gateway_id = aws_customer_gateway.onprem.id
  transit_gateway_id  = aws_ec2_transit_gateway.main.id
  type                = "ipsec.1"

  # Enable BGP for dynamic routing
  tunnel1_inside_cidr = "169.254.10.0/30"
  tunnel2_inside_cidr = "169.254.11.0/30"
}
```

## Best Practices

1. **Plan CIDR ranges** - No overlaps across all VPCs
2. **Use route table segmentation** - Don't let prod talk to dev
3. **Enable flow logs** - On TGW for visibility
4. **Monitor data transfer** - TGW charges $0.02/GB
5. **Use attachment appliance mode** - For stateful firewalls
6. **Name everything** - Debugging is easier with good names
