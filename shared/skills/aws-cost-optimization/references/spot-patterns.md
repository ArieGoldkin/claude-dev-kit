# Spot Instance Patterns

Best practices for using Spot instances effectively.

## When to Use Spot

### Good Candidates
- Batch processing jobs
- CI/CD build agents
- Data processing pipelines
- Machine learning training
- Stateless web workers (with proper load balancing)
- Development/test environments

### Poor Candidates
- Databases (use RIs instead)
- Long-running stateful services
- Real-time trading systems
- Single points of failure

## Spot Fleet Strategies

### Capacity Optimized (Recommended)

Prioritizes pools with highest available capacity, reducing interruptions.

```hcl
resource "aws_spot_fleet_request" "workers" {
  allocation_strategy = "capacityOptimized"
  target_capacity     = 10

  # Diversify across multiple instance types
  launch_template_config {
    launch_template_specification {
      id      = aws_launch_template.worker.id
      version = "$Latest"
    }
    overrides {
      instance_type = "m6i.xlarge"
      subnet_id     = aws_subnet.az_a.id
    }
    overrides {
      instance_type = "m6a.xlarge"
      subnet_id     = aws_subnet.az_b.id
    }
    overrides {
      instance_type = "m5.xlarge"
      subnet_id     = aws_subnet.az_a.id
    }
    overrides {
      instance_type = "c6i.xlarge"
      subnet_id     = aws_subnet.az_b.id
    }
  }
}
```

### Price Capacity Optimized

Balances price and capacity - good for cost-sensitive batch jobs.

```hcl
allocation_strategy = "priceCapacityOptimized"
```

### Lowest Price (Avoid)

Highest interruption rate - only for very fault-tolerant workloads.

## Interruption Handling

### 2-Minute Warning

AWS provides 2-minute notice via:
1. Instance metadata
2. CloudWatch Events

### Metadata Polling

```bash
# Check for interruption notice (poll every 5 seconds)
#!/bin/bash
TOKEN=$(curl -X PUT "http://169.254.169.254/latest/api/token" \
  -H "X-aws-ec2-metadata-token-ttl-seconds: 21600")

while true; do
  RESPONSE=$(curl -s -H "X-aws-ec2-metadata-token: $TOKEN" \
    http://169.254.169.254/latest/meta-data/spot/instance-action)

  if [[ "$RESPONSE" != *"404"* ]]; then
    echo "Spot interruption detected: $RESPONSE"
    # Trigger graceful shutdown
    /opt/scripts/graceful-shutdown.sh
    break
  fi
  sleep 5
done
```

### EventBridge Rule

```hcl
resource "aws_cloudwatch_event_rule" "spot_interruption" {
  name        = "spot-interruption-handler"
  description = "Handle Spot instance interruption warnings"

  event_pattern = jsonencode({
    source      = ["aws.ec2"]
    detail-type = ["EC2 Spot Instance Interruption Warning"]
  })
}

resource "aws_cloudwatch_event_target" "lambda" {
  rule      = aws_cloudwatch_event_rule.spot_interruption.name
  target_id = "SpotInterruptionHandler"
  arn       = aws_lambda_function.spot_handler.arn
}
```

### Lambda Handler

```python
import boto3
import json

def handler(event, context):
    """Handle Spot interruption with graceful shutdown."""
    instance_id = event['detail']['instance-id']
    action = event['detail']['instance-action']

    print(f"Spot interruption: {instance_id}, action: {action}")

    ssm = boto3.client('ssm')
    asg = boto3.client('autoscaling')

    # 1. Drain from load balancer (if applicable)
    # 2. Stop accepting new work
    # 3. Complete in-flight tasks
    # 4. Checkpoint state to S3

    ssm.send_command(
        InstanceIds=[instance_id],
        DocumentName='AWS-RunShellScript',
        Parameters={
            'commands': [
                '#!/bin/bash',
                'systemctl stop worker',
                'aws s3 sync /var/checkpoint s3://my-bucket/checkpoints/',
            ]
        }
    )

    # Set instance to unhealthy to trigger replacement
    try:
        asg.set_instance_health(
            InstanceId=instance_id,
            HealthStatus='Unhealthy'
        )
    except:
        pass  # Instance may not be in ASG

    return {'statusCode': 200}
```

## Checkpointing Strategies

### Periodic Checkpointing

Save state every N minutes/items processed:

```python
import boto3
import pickle
from datetime import datetime

s3 = boto3.client('s3')
CHECKPOINT_BUCKET = 'my-checkpoints'

def save_checkpoint(job_id, state):
    """Save processing state to S3."""
    key = f"checkpoints/{job_id}/latest.pkl"
    s3.put_object(
        Bucket=CHECKPOINT_BUCKET,
        Key=key,
        Body=pickle.dumps(state)
    )

def load_checkpoint(job_id):
    """Resume from last checkpoint."""
    try:
        response = s3.get_object(
            Bucket=CHECKPOINT_BUCKET,
            Key=f"checkpoints/{job_id}/latest.pkl"
        )
        return pickle.loads(response['Body'].read())
    except s3.exceptions.NoSuchKey:
        return None

# Usage in batch job
def process_batch(job_id, items):
    state = load_checkpoint(job_id) or {'processed': 0, 'results': []}

    for i, item in enumerate(items[state['processed']:], state['processed']):
        result = process_item(item)
        state['results'].append(result)
        state['processed'] = i + 1

        # Checkpoint every 100 items
        if i % 100 == 0:
            save_checkpoint(job_id, state)

    return state['results']
```

## Mixed Instance Policies

### Auto Scaling Group

```hcl
resource "aws_autoscaling_group" "workers" {
  name                = "worker-asg"
  desired_capacity    = 10
  min_size            = 5
  max_size            = 20
  vpc_zone_identifier = var.subnet_ids

  mixed_instances_policy {
    instances_distribution {
      on_demand_base_capacity                  = 2  # Always have 2 on-demand
      on_demand_percentage_above_base_capacity = 20 # 20% on-demand above base
      spot_allocation_strategy                 = "capacity-optimized"
    }

    launch_template {
      launch_template_specification {
        launch_template_id = aws_launch_template.worker.id
        version            = "$Latest"
      }

      override {
        instance_type = "m6i.xlarge"
      }
      override {
        instance_type = "m6a.xlarge"
      }
      override {
        instance_type = "m5.xlarge"
      }
      override {
        instance_type = "c6i.xlarge"
      }
    }
  }
}
```

## Spot Best Practices

1. **Diversify instance types** - Use 4+ instance types across families
2. **Diversify AZs** - Spread across all available AZs
3. **Use capacity-optimized** - Lower interruption than lowest-price
4. **Design for failure** - Assume any instance can disappear
5. **Checkpoint frequently** - Minimize lost work on interruption
6. **Monitor interruption rate** - Track by instance type/AZ
7. **Set max price** - Usually 90% of on-demand to avoid surprises
8. **Use Spot placement scores** - Check capacity before launching
