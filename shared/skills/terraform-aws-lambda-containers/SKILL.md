---
name: terraform-aws-lambda-containers
description: |
  Container-native AWS Lambda deployment patterns with Terraform. Use when deploying Lambda
  functions from ECR images, setting up ECR repositories with lifecycle policies, configuring
  VPC-connected Lambdas, or integrating with API Gateway. Covers Docker multi-stage builds
  optimized for Lambda, X-Ray tracing setup, environment variables and secrets integration,
  and IAM role configuration. Includes templates for reusable Lambda modules, ECR lifecycle
  management, and production-ready Dockerfiles.
paths:
  - "terraform/**"
  - "*.tf"
  - "Dockerfile*"
  - "**/*lambda*"
  - "**/*ecr*"
---

# Terraform AWS Lambda Containers Skill

Container-native AWS Lambda deployment patterns using Terraform and ECR.

## When to Use

- Deploying Lambda functions from container images
- Setting up ECR repositories with lifecycle policies
- Configuring VPC-connected Lambdas
- Integrating Lambdas with API Gateway
- Building Docker images optimized for Lambda runtime

## Architecture Overview

```
┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
│   Docker    │──▶│    ECR      │──▶│   Lambda    │──▶│ API Gateway │
│   Build     │   │  Registry   │   │  Function   │   │  (Optional) │
└─────────────┘   └─────────────┘   └─────────────┘   └─────────────┘
       │                 │                 │                 │
       ▼                 ▼                 ▼                 ▼
   Multi-stage      Lifecycle         VPC Config        HTTP/REST
   Slim Image        Policies         IAM Role           Routes
```

## Key Concepts

### ECR Repository Setup

Container images are stored in Amazon ECR:

```hcl
resource "aws_ecr_repository" "lambda" {
  name                 = "${var.app_name}-${var.function_name}"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "AES256"
  }
}
```

**Best Practices**:
- Enable `scan_on_push` for vulnerability detection
- Use lifecycle policies to limit image count
- Immutable tags for production (`IMMUTABLE`)

> See `${CLAUDE_SKILL_DIR}/templates/ecr-repository.tf` for complete configuration

### Lifecycle Policies

Automatically clean up old images:

```hcl
resource "aws_ecr_lifecycle_policy" "lambda" {
  repository = aws_ecr_repository.lambda.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Keep last 10 images"
        selection = {
          tagStatus   = "any"
          countType   = "imageCountMoreThan"
          countNumber = 10
        }
        action = {
          type = "expire"
        }
      }
    ]
  })
}
```

### Lambda from Container Image

Reference ECR image in Lambda:

```hcl
resource "aws_lambda_function" "main" {
  function_name = "${var.app_name}-${var.function_name}-${var.environment}"
  role          = aws_iam_role.lambda.arn
  package_type  = "Image"
  image_uri     = "${aws_ecr_repository.lambda.repository_url}:${var.image_tag}"

  memory_size = var.memory_size
  timeout     = var.timeout

  environment {
    variables = var.environment_variables
  }
}
```

**Key settings**:
- `package_type = "Image"` enables container mode
- `image_uri` points to ECR repository with tag
- Memory: 128MB-10GB
- Timeout: up to 15 minutes

> See `${CLAUDE_SKILL_DIR}/templates/lambda-module.tf` for complete module

### VPC Configuration

Connect Lambda to private resources:

```hcl
resource "aws_lambda_function" "main" {
  # ... other config

  vpc_config {
    subnet_ids         = var.private_subnet_ids
    security_group_ids = [aws_security_group.lambda.id]
  }
}
```

**Requirements**:
- Private subnets with NAT Gateway (for internet access)
- Security group for outbound rules
- VPC execution role permissions

> See `${CLAUDE_SKILL_DIR}/references/vpc-configuration.md` for networking details

### X-Ray Tracing

Enable distributed tracing:

```hcl
resource "aws_lambda_function" "main" {
  tracing_config {
    mode = "Active"  # or "PassThrough"
  }
}
```

**Modes**:
- `Active`: Lambda creates trace segments
- `PassThrough`: Lambda only forwards upstream traces

### Docker Multi-Stage Build

Optimized Dockerfile for Lambda:

```dockerfile
# Stage 1: Build
FROM public.ecr.aws/lambda/python:3.12 AS builder
COPY requirements.txt .
RUN pip install -r requirements.txt -t /opt/python

# Stage 2: Runtime
FROM public.ecr.aws/lambda/python:3.12
COPY --from=builder /opt/python ${LAMBDA_TASK_ROOT}
COPY src/ ${LAMBDA_TASK_ROOT}/
CMD ["app.handler"]
```

**Best Practices**:
- Use AWS base images for compatibility
- Multi-stage builds reduce image size
- Copy only production dependencies
- Set `CMD` to handler location

> See `${CLAUDE_SKILL_DIR}/templates/Dockerfile.lambda` for examples

## Quick Start

### 1. Create ECR Repository

```hcl
module "ecr" {
  source = "./modules/ecr-repository"

  app_name      = "myapp"
  function_name = "api-handler"
  max_images    = 10
}
```

### 2. Build and Push Image

```bash
# Authenticate to ECR
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin ${ACCOUNT_ID}.dkr.ecr.us-east-1.amazonaws.com

# Build image
docker build -t myapp-api-handler .

# Tag for ECR
docker tag myapp-api-handler:latest ${ACCOUNT_ID}.dkr.ecr.us-east-1.amazonaws.com/myapp-api-handler:latest

# Push
docker push ${ACCOUNT_ID}.dkr.ecr.us-east-1.amazonaws.com/myapp-api-handler:latest
```

### 3. Deploy Lambda

```hcl
module "lambda" {
  source = "./modules/lambda-function"

  app_name      = "myapp"
  function_name = "api-handler"
  environment   = "production"

  ecr_repository_url = module.ecr.repository_url
  image_tag          = "latest"

  memory_size = 512
  timeout     = 30

  environment_variables = {
    DATABASE_URL = "postgresql://..."
    LOG_LEVEL    = "INFO"
  }
}
```

## Common Patterns

### API Gateway Integration

```hcl
resource "aws_apigatewayv2_api" "main" {
  name          = "${var.app_name}-api"
  protocol_type = "HTTP"
}

resource "aws_apigatewayv2_integration" "lambda" {
  api_id             = aws_apigatewayv2_api.main.id
  integration_type   = "AWS_PROXY"
  integration_uri    = aws_lambda_function.main.invoke_arn
  integration_method = "POST"
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "main" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "ANY /{proxy+}"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}
```

### Secrets Manager Integration

```hcl
data "aws_secretsmanager_secret_version" "db" {
  secret_id = "myapp/database"
}

resource "aws_lambda_function" "main" {
  environment {
    variables = {
      DATABASE_SECRET_ARN = data.aws_secretsmanager_secret_version.db.arn
    }
  }
}

# Lambda IAM policy for secrets access
resource "aws_iam_role_policy" "secrets" {
  role = aws_iam_role.lambda.id
  policy = jsonencode({
    Statement = [{
      Effect   = "Allow"
      Action   = ["secretsmanager:GetSecretValue"]
      Resource = [data.aws_secretsmanager_secret_version.db.arn]
    }]
  })
}
```

### CloudWatch Logs

```hcl
resource "aws_cloudwatch_log_group" "lambda" {
  name              = "/aws/lambda/${aws_lambda_function.main.function_name}"
  retention_in_days = 30
}
```

### Provisioned Concurrency

Reduce cold starts for critical functions:

```hcl
resource "aws_lambda_alias" "live" {
  name             = "live"
  function_name    = aws_lambda_function.main.function_name
  function_version = aws_lambda_function.main.version
}

resource "aws_lambda_provisioned_concurrency_config" "main" {
  function_name                     = aws_lambda_alias.live.function_name
  provisioned_concurrent_executions = 5
  qualifier                         = aws_lambda_alias.live.name
}
```

## IAM Best Practices

### Minimal Permissions

```hcl
resource "aws_iam_role" "lambda" {
  name = "${var.app_name}-${var.function_name}-role"

  assume_role_policy = jsonencode({
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "lambda.amazonaws.com"
      }
    }]
  })
}

# Basic execution (CloudWatch Logs)
resource "aws_iam_role_policy_attachment" "basic" {
  role       = aws_iam_role.lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# VPC access (if needed)
resource "aws_iam_role_policy_attachment" "vpc" {
  count      = var.vpc_enabled ? 1 : 0
  role       = aws_iam_role.lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}
```

## Troubleshooting

### Image Pull Errors

```
Error: InvalidParameterValueException: Source image does not exist
```

**Check**:
- ECR repository exists
- Image tag is correct
- Lambda role has `ecr:GetDownloadUrlForLayer` permission

### Cold Start Issues

Container Lambdas have longer cold starts (~1-3s). Mitigate with:
- Provisioned concurrency
- Smaller images (< 500MB)
- Optimize initialization code

### VPC Timeout

```
Task timed out after 30.00 seconds
```

**Check**:
- NAT Gateway in public subnet
- Route table for private subnet → NAT
- Security group allows outbound

## Templates Reference

| Template | Purpose |
|----------|---------|
| `lambda-module.tf` | Reusable Lambda module |
| `ecr-repository.tf` | ECR with lifecycle policies |
| `Dockerfile.lambda` | Multi-stage Lambda build |

## References

- `${CLAUDE_SKILL_DIR}/references/vpc-configuration.md` - VPC networking for Lambda
