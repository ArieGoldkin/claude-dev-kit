# RDS PostgreSQL Operations Reference

## Table of Contents

- [Describe Instances](#describe-instances)
  - [List RDS Instances](#list-rds-instances)
  - [Get Detailed Instance Info](#get-detailed-instance-info)
- [Snapshots](#snapshots)
  - [List Recent Snapshots](#list-recent-snapshots)
  - [Create Manual Snapshot (Before Risky Operations)](#create-manual-snapshot-before-risky-operations)
- [Performance Monitoring](#performance-monitoring)
  - [CPU Utilization](#cpu-utilization)
  - [Database Connections](#database-connections)
  - [Free Storage Space](#free-storage-space)
  - [Read/Write IOPS](#readwrite-iops)
- [Troubleshooting](#troubleshooting)
  - [Instance Not Available](#instance-not-available)
  - [Connection Limit Reached](#connection-limit-reached)
  - [Security Group Access](#security-group-access)

Comprehensive guide for RDS PostgreSQL instance management, snapshots, and performance monitoring for the acme platform.

## Describe Instances

### List RDS Instances

```bash
aws rds describe-db-instances --profile acme-dev \
  --query "DBInstances[?starts_with(DBInstanceIdentifier, 'acme')].[DBInstanceIdentifier,DBInstanceStatus,Engine,EngineVersion]" \
  --output table
```

### Get Detailed Instance Info

```bash
aws rds describe-db-instances --profile acme-dev \
  --db-instance-identifier acme-db-dev \
  --query "DBInstances[0].{Status:DBInstanceStatus,Endpoint:Endpoint.Address,Port:Endpoint.Port,Storage:AllocatedStorage,Class:DBInstanceClass,MultiAZ:MultiAZ}"
```

## Snapshots

### List Recent Snapshots

```bash
aws rds describe-db-snapshots --profile acme-dev \
  --db-instance-identifier acme-db-dev \
  --query "DBSnapshots[?SnapshotType=='automated']|sort_by(@, &SnapshotCreateTime)|[-5:].[DBSnapshotIdentifier,SnapshotCreateTime,Status]" \
  --output table
```

### Create Manual Snapshot (Before Risky Operations)

```bash
aws rds create-db-snapshot --profile acme-dev \
  --db-instance-identifier acme-db-dev \
  --db-snapshot-identifier "acme-db-dev-pre-migration-$(date +%Y%m%d)"
```

## Performance Monitoring

### CPU Utilization

```bash
# CPU utilization (last hour)
aws cloudwatch get-metric-statistics --profile acme-dev \
  --namespace AWS/RDS \
  --metric-name CPUUtilization \
  --dimensions Name=DBInstanceIdentifier,Value=acme-db-dev \
  --start-time $(date -u -v-1H +%Y-%m-%dT%H:%M:%SZ) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%SZ) \
  --period 300 \
  --statistics Average Maximum \
  --output table
```

### Database Connections

```bash
aws cloudwatch get-metric-statistics --profile acme-dev \
  --namespace AWS/RDS \
  --metric-name DatabaseConnections \
  --dimensions Name=DBInstanceIdentifier,Value=acme-db-dev \
  --start-time $(date -u -v-1H +%Y-%m-%dT%H:%M:%SZ) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%SZ) \
  --period 300 \
  --statistics Average Maximum
```

### Free Storage Space

```bash
aws cloudwatch get-metric-statistics --profile acme-dev \
  --namespace AWS/RDS \
  --metric-name FreeStorageSpace \
  --dimensions Name=DBInstanceIdentifier,Value=acme-db-dev \
  --start-time $(date -u -v-1H +%Y-%m-%dT%H:%M:%SZ) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%SZ) \
  --period 3600 \
  --statistics Minimum
```

### Read/Write IOPS

```bash
# Read IOPS
aws cloudwatch get-metric-statistics --profile acme-dev \
  --namespace AWS/RDS \
  --metric-name ReadIOPS \
  --dimensions Name=DBInstanceIdentifier,Value=acme-db-dev \
  --start-time $(date -u -v-1H +%Y-%m-%dT%H:%M:%SZ) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%SZ) \
  --period 300 \
  --statistics Average Maximum

# Write IOPS
aws cloudwatch get-metric-statistics --profile acme-dev \
  --namespace AWS/RDS \
  --metric-name WriteIOPS \
  --dimensions Name=DBInstanceIdentifier,Value=acme-db-dev \
  --start-time $(date -u -v-1H +%Y-%m-%dT%H:%M:%SZ) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%SZ) \
  --period 300 \
  --statistics Average Maximum
```

## Troubleshooting

### Instance Not Available

```bash
# 1. Check status
aws rds describe-db-instances --profile acme-dev \
  --db-instance-identifier acme-db-dev \
  --query "DBInstances[0].DBInstanceStatus"

# 2. Check recent events
aws rds describe-events --profile acme-dev \
  --source-identifier acme-db-dev \
  --source-type db-instance \
  --duration 1440
```

### Connection Limit Reached

```bash
# Check current connections vs max
aws cloudwatch get-metric-statistics --profile acme-dev \
  --namespace AWS/RDS \
  --metric-name DatabaseConnections \
  --dimensions Name=DBInstanceIdentifier,Value=acme-db-dev \
  --start-time $(date -u -v-1H +%Y-%m-%dT%H:%M:%SZ) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%SZ) \
  --period 60 \
  --statistics Maximum
```

### Security Group Access

```bash
# Get RDS security groups
aws rds describe-db-instances --profile acme-dev \
  --db-instance-identifier acme-db-dev \
  --query "DBInstances[0].VpcSecurityGroups[*].VpcSecurityGroupId" --output text | \
  xargs -I {} aws ec2 describe-security-groups --profile acme-dev \
  --group-ids {} --query "SecurityGroups[0].IpPermissions"
```
