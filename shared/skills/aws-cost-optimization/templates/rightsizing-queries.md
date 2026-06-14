# Rightsizing Queries

AWS CLI commands and queries for identifying rightsizing opportunities.

## Compute Optimizer Queries

### Enable Compute Optimizer

```bash
# Check enrollment status
aws compute-optimizer get-enrollment-status

# Enable (required before getting recommendations)
aws compute-optimizer update-enrollment-status --status Active
```

### EC2 Rightsizing

```bash
# Get over-provisioned instances
aws compute-optimizer get-ec2-instance-recommendations \
  --filters name=Finding,values=OVER_PROVISIONED \
  --query 'instanceRecommendations[*].{
    Instance: instanceArn,
    Current: currentInstanceType,
    Recommended: recommendationOptions[0].instanceType,
    MonthlySavings: recommendationOptions[0].projectedUtilizationMetrics[0].value
  }' \
  --output table

# Get all recommendations with savings estimates
aws compute-optimizer get-ec2-instance-recommendations \
  --query 'instanceRecommendations[?finding!=`OPTIMIZED`]' \
  --output json | jq '.[] | {
    instance: .instanceName,
    current: .currentInstanceType,
    finding: .finding,
    recommended: .recommendationOptions[0].instanceType,
    savings: .recommendationOptions[0].projectedUtilizationMetrics
  }'
```

### EBS Volume Rightsizing

```bash
# Get underutilized volumes
aws compute-optimizer get-ebs-volume-recommendations \
  --filters name=Finding,values=NotOptimized \
  --query 'volumeRecommendations[*].{
    Volume: volumeArn,
    CurrentType: currentConfiguration.volumeType,
    CurrentSize: currentConfiguration.volumeSize,
    RecommendedType: volumeRecommendationOptions[0].configuration.volumeType,
    RecommendedSize: volumeRecommendationOptions[0].configuration.volumeSize
  }' \
  --output table
```

### Lambda Rightsizing

```bash
# Get Lambda memory recommendations
aws compute-optimizer get-lambda-function-recommendations \
  --filters name=Finding,values=NotOptimized \
  --query 'lambdaFunctionRecommendations[*].{
    Function: functionArn,
    CurrentMemory: currentMemorySize,
    RecommendedMemory: memorySizeRecommendationOptions[0].memorySize,
    Savings: memorySizeRecommendationOptions[0].projectedUtilizationMetrics
  }' \
  --output table
```

## CloudWatch Metrics Analysis

### EC2 CPU Utilization (Last 30 Days)

```bash
# Get average CPU for an instance
aws cloudwatch get-metric-statistics \
  --namespace AWS/EC2 \
  --metric-name CPUUtilization \
  --dimensions Name=InstanceId,Value=i-1234567890abcdef0 \
  --start-time $(date -d '30 days ago' --utc +%Y-%m-%dT%H:%M:%SZ) \
  --end-time $(date --utc +%Y-%m-%dT%H:%M:%SZ) \
  --period 86400 \
  --statistics Average Maximum \
  --query 'Datapoints | sort_by(@, &Timestamp)'
```

### Find Underutilized Instances

```bash
# List instances with <20% average CPU (requires cloudwatch insights)
aws logs start-query \
  --log-group-name /aws/cloudwatch/metrics \
  --start-time $(date -d '7 days ago' +%s) \
  --end-time $(date +%s) \
  --query-string '
    fields @timestamp, InstanceId, Average
    | filter MetricName = "CPUUtilization"
    | stats avg(Average) as avgCpu by InstanceId
    | filter avgCpu < 20
    | sort avgCpu asc
  '
```

## RDS Rightsizing

```bash
# Get RDS instances with low CPU
aws cloudwatch get-metric-statistics \
  --namespace AWS/RDS \
  --metric-name CPUUtilization \
  --dimensions Name=DBInstanceIdentifier,Value=mydb \
  --start-time $(date -d '14 days ago' --utc +%Y-%m-%dT%H:%M:%SZ) \
  --end-time $(date --utc +%Y-%m-%dT%H:%M:%SZ) \
  --period 3600 \
  --statistics Average Maximum \
  --query 'Datapoints | sort_by(@, &Timestamp) | [-1]'

# Check freeable memory (if high, instance may be oversized)
aws cloudwatch get-metric-statistics \
  --namespace AWS/RDS \
  --metric-name FreeableMemory \
  --dimensions Name=DBInstanceIdentifier,Value=mydb \
  --start-time $(date -d '7 days ago' --utc +%Y-%m-%dT%H:%M:%SZ) \
  --end-time $(date --utc +%Y-%m-%dT%H:%M:%SZ) \
  --period 3600 \
  --statistics Average
```

## Quick Wins

### Unattached EBS Volumes

```bash
aws ec2 describe-volumes \
  --filters Name=status,Values=available \
  --query 'Volumes[*].{
    VolumeId: VolumeId,
    Size: Size,
    Type: VolumeType,
    Created: CreateTime
  }' \
  --output table
```

### Old Snapshots

```bash
# Snapshots older than 90 days
aws ec2 describe-snapshots \
  --owner-ids self \
  --query "Snapshots[?StartTime<='$(date -d '90 days ago' +%Y-%m-%d)'].{
    Id: SnapshotId,
    Size: VolumeSize,
    Created: StartTime,
    Description: Description
  }" \
  --output table
```

### Idle Load Balancers

```bash
# ALBs with zero healthy targets
aws elbv2 describe-target-health \
  --query 'TargetHealthDescriptions[?TargetHealth.State!=`healthy`]'
```
