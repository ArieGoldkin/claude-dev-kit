#!/bin/bash
# Savings Plan Analysis Commands
# Run these to analyze coverage and get recommendations

set -euo pipefail

# Configuration
START_DATE="${START_DATE:-$(date -d '30 days ago' +%Y-%m-%d)}"
END_DATE="${END_DATE:-$(date +%Y-%m-%d)}"
OUTPUT_DIR="${OUTPUT_DIR:-./cost-analysis}"

mkdir -p "$OUTPUT_DIR"

echo "=== Savings Plans Analysis ==="
echo "Period: $START_DATE to $END_DATE"
echo ""

# 1. Current Savings Plans coverage
echo "1. Checking current coverage..."
aws ce get-savings-plans-coverage \
  --time-period "Start=$START_DATE,End=$END_DATE" \
  --granularity MONTHLY \
  --metrics "CoveragePercentage,SpendCoveredBySavingsPlans,OnDemandCost" \
  --output json > "$OUTPUT_DIR/sp-coverage.json"

echo "Coverage saved to $OUTPUT_DIR/sp-coverage.json"

# 2. Savings Plans utilization
echo ""
echo "2. Checking utilization..."
aws ce get-savings-plans-utilization \
  --time-period "Start=$START_DATE,End=$END_DATE" \
  --granularity MONTHLY \
  --output json > "$OUTPUT_DIR/sp-utilization.json"

echo "Utilization saved to $OUTPUT_DIR/sp-utilization.json"

# 3. Purchase recommendations - Compute SP
echo ""
echo "3. Getting Compute SP recommendations..."
aws ce get-savings-plans-purchase-recommendation \
  --savings-plans-type COMPUTE_SP \
  --lookback-period-in-days SIXTY_DAYS \
  --term-in-years ONE_YEAR \
  --payment-option NO_UPFRONT \
  --output json > "$OUTPUT_DIR/sp-recommendations-compute.json"

echo "Compute SP recommendations saved"

# 4. Purchase recommendations - EC2 Instance SP
echo ""
echo "4. Getting EC2 Instance SP recommendations..."
aws ce get-savings-plans-purchase-recommendation \
  --savings-plans-type EC2_INSTANCE_SP \
  --lookback-period-in-days SIXTY_DAYS \
  --term-in-years ONE_YEAR \
  --payment-option NO_UPFRONT \
  --output json > "$OUTPUT_DIR/sp-recommendations-ec2.json"

echo "EC2 Instance SP recommendations saved"

# 5. Reserved Instance recommendations (for comparison)
echo ""
echo "5. Getting RI recommendations..."
aws ce get-reservation-purchase-recommendation \
  --service "Amazon Elastic Compute Cloud - Compute" \
  --lookback-period-in-days SIXTY_DAYS \
  --term-in-years ONE_YEAR \
  --payment-option NO_UPFRONT \
  --output json > "$OUTPUT_DIR/ri-recommendations.json"

echo "RI recommendations saved"

# 6. Cost breakdown by service
echo ""
echo "6. Getting cost breakdown..."
aws ce get-cost-and-usage \
  --time-period "Start=$START_DATE,End=$END_DATE" \
  --granularity MONTHLY \
  --metrics "UnblendedCost" \
  --group-by Type=DIMENSION,Key=SERVICE \
  --output json > "$OUTPUT_DIR/cost-by-service.json"

echo "Cost breakdown saved"

# Summary report
echo ""
echo "=== Summary Report ==="
echo ""

# Parse coverage
COVERAGE=$(jq -r '.SavingsPlansCoverages[0].Coverage.CoveragePercentage // "N/A"' "$OUTPUT_DIR/sp-coverage.json")
echo "Current SP Coverage: ${COVERAGE}%"

# Parse utilization
UTILIZATION=$(jq -r '.SavingsPlanUtilizations[0].Utilization.UtilizationPercentage // "N/A"' "$OUTPUT_DIR/sp-utilization.json")
echo "Current SP Utilization: ${UTILIZATION}%"

# Parse recommendations
COMPUTE_SAVINGS=$(jq -r '.SavingsPlansPurchaseRecommendation.SavingsPlansPurchaseRecommendationSummary.EstimatedMonthlySavingsAmount // "0"' "$OUTPUT_DIR/sp-recommendations-compute.json")
echo "Potential Monthly Savings (Compute SP): \$${COMPUTE_SAVINGS}"

echo ""
echo "All reports saved to: $OUTPUT_DIR/"
echo ""
echo "Next steps:"
echo "  1. Review sp-recommendations-compute.json for Compute SP opportunities"
echo "  2. Review ri-recommendations.json for stable workload RIs"
echo "  3. If coverage < 70%, consider purchasing more commitments"
echo "  4. If utilization < 80%, review if current SPs are right-sized"
