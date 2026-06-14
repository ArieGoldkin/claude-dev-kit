# Savings Plans Strategy Guide

Deep dive on choosing between Savings Plans and Reserved Instances.

## Savings Plans Types

### Compute Savings Plans

**Best for:** Variable workloads, multi-service usage, flexibility

- Applies to: EC2, Fargate, Lambda
- Flexibility: Any instance family, size, OS, tenancy, region
- Discount: 10-20% (varies by commitment level)
- Commitment: $/hour for 1 or 3 years

**Example scenario:**
- Team uses m5.xlarge today, may migrate to m6i or Graviton
- Also running Fargate tasks and Lambda functions
- Compute SP automatically applies to all

### EC2 Instance Savings Plans

**Best for:** Predictable EC2 workloads with known instance family

- Applies to: EC2 only (specific instance family in a region)
- Flexibility: Any size within family, any OS, any tenancy
- Discount: 20-30% (higher than Compute SP)
- Commitment: $/hour for 1 or 3 years

**Example scenario:**
- Running 10x m5.xlarge consistently
- Can scale to m5.2xlarge or down to m5.large
- Won't migrate to different family soon

## Reserved Instances

### Standard RIs

**Best for:** Stable baseline with maximum savings

- Discount: 30-40% (1-year), 60-72% (3-year)
- Flexibility: None - specific instance type, OS, tenancy
- Can sell on RI Marketplace if unused

### Convertible RIs

**Best for:** Long-term commitment with some flexibility

- Discount: 20-30% (1-year), 50-55% (3-year)
- Flexibility: Can exchange for different instance types
- Cannot sell on marketplace

## Decision Framework

### Use Compute Savings Plans When:

1. **Mixed compute usage** - EC2 + Fargate + Lambda
2. **Uncertain future** - May migrate regions, instance families
3. **First commitment** - Start conservative, add specificity later
4. **Graviton migration planned** - SP covers x86 and ARM

### Use EC2 Instance Savings Plans When:

1. **Stable instance family** - Know you'll stay on m5/m6i family
2. **Want more savings** - 5-10% more than Compute SP
3. **EC2-only workloads** - No Fargate/Lambda usage

### Use Reserved Instances When:

1. **Maximum savings needed** - 3-year Standard RI for baseline
2. **Predictable baseline** - Database instances, core services
3. **Specific requirements** - Dedicated tenancy, specific OS

## Blended Strategy

Optimal approach layers commitments:

```
┌─────────────────────────────────────────────────────────────┐
│                    Total Compute Spend                       │
├─────────────────────────────────────────────────────────────┤
│ Layer 1: Reserved Instances (20-30%)                        │
│ - 3-year Standard RIs for predictable baseline              │
│ - RDS Reserved Instances for databases                      │
│ - ElastiCache Reserved Nodes                                │
├─────────────────────────────────────────────────────────────┤
│ Layer 2: Compute Savings Plans (40-50%)                     │
│ - Covers variable EC2, Fargate, Lambda                      │
│ - Provides flexibility for architecture changes             │
├─────────────────────────────────────────────────────────────┤
│ Layer 3: EC2 Instance SP (10-15%)                           │
│ - Known stable workloads in specific families               │
├─────────────────────────────────────────────────────────────┤
│ Layer 4: Spot + On-Demand (10-20%)                          │
│ - Spot for fault-tolerant batch jobs                        │
│ - On-Demand for spikes and new workloads                    │
└─────────────────────────────────────────────────────────────┘
```

## Coverage vs Utilization

### Coverage
- **Definition:** % of eligible spend covered by commitments
- **Target:** 70-80%
- **Too low (<60%):** Missing savings opportunities
- **Too high (>90%):** Risk of paying for unused commitments

### Utilization
- **Definition:** % of committed spend actually used
- **Target:** >90%
- **Below 80%:** Over-committed, wasting money
- **Action:** Reduce future commitments, wait for usage to grow

## Purchase Timing

### When to Buy

1. **After 30-60 days of stable usage** - Not before
2. **Monthly review cadence** - Check recommendations monthly
3. **Before major launches** - If confident in growth

### When NOT to Buy

1. **During architecture migration** - Wait until settled
2. **When utilization <80%** - Use existing commitments first
3. **For volatile workloads** - Use Spot instead

## Example Calculation

**Current state:**
- Monthly On-Demand spend: $50,000
- Coverage: 0%

**Optimized state:**

| Layer | Coverage | Discount | Monthly Cost | Savings |
|-------|----------|----------|--------------|---------|
| 3-year Standard RI | 25% | 40% | $7,500 | $5,000 |
| Compute SP (1-year) | 45% | 17% | $18,675 | $3,825 |
| Spot instances | 15% | 70% | $2,250 | $5,250 |
| On-Demand | 15% | 0% | $7,500 | $0 |
| **Total** | **100%** | **28%** | **$35,925** | **$14,075** |

**Annual savings: $168,900**

## Monitoring

### Weekly Review
- Check utilization - should be >85%
- Review any unused commitments

### Monthly Review
- Run `savings-plan-analysis.sh`
- Compare recommendations vs current state
- Adjust future purchases

### Quarterly Review
- Evaluate commitment strategy
- Plan for expiring commitments (60-90 days ahead)
- Assess architecture changes impact
