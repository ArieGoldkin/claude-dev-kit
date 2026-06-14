# Module Design Patterns

## Table of Contents

- [Module Structure](#module-structure)
- [Design Principles](#design-principles)
  - [1. Single Responsibility](#1-single-responsibility)
  - [2. Sensible Defaults](#2-sensible-defaults)
  - [3. Explicit Over Implicit](#3-explicit-over-implicit)
  - [4. Output Everything Useful](#4-output-everything-useful)
- [Common Module Patterns](#common-module-patterns)
  - [Lambda Function Module](#lambda-function-module)
  - [Database Module with Conditional Aurora](#database-module-with-conditional-aurora)
  - [Feature Flag Pattern](#feature-flag-pattern)
- [Module Composition](#module-composition)
  - [Root Module Example](#root-module-example)
- [Testing Modules](#testing-modules)

Best practices for designing reusable Terraform modules.

## Module Structure

```
modules/
└── lambda-function/
    ├── main.tf           # Primary resources
    ├── variables.tf      # Input variables
    ├── outputs.tf        # Output values
    ├── versions.tf       # Provider requirements
    └── README.md         # Usage documentation
```

## Design Principles

### 1. Single Responsibility

Each module should do one thing well:

```
GOOD:
modules/
├── lambda-function/    # Just Lambda + IAM role
├── ecr-repository/     # Just ECR + lifecycle
└── api-gateway/        # Just API Gateway

BAD:
modules/
└── serverless-app/     # Lambda + ECR + API Gateway + RDS
```

### 2. Sensible Defaults

Provide defaults that work for 80% of use cases:

```hcl
variable "memory_size" {
  type    = number
  default = 512  # Good default for most Lambdas
}

variable "timeout" {
  type    = number
  default = 30  # Reasonable default
}

variable "log_retention_days" {
  type    = number
  default = 30  # Cost-effective default
}
```

### 3. Explicit Over Implicit

Require important configuration, even if it has a default:

```hcl
variable "environment" {
  type        = string
  description = "Environment (dev, staging, production)"
  # No default - force explicit configuration
}
```

### 4. Output Everything Useful

Expose all IDs, ARNs, and endpoints:

```hcl
output "function_name" {
  value = aws_lambda_function.main.function_name
}

output "function_arn" {
  value = aws_lambda_function.main.arn
}

output "invoke_arn" {
  value = aws_lambda_function.main.invoke_arn
}

output "role_arn" {
  value = aws_iam_role.lambda.arn
}

output "role_name" {
  value = aws_iam_role.lambda.name
}
```

## Common Module Patterns

### Lambda Function Module

```hcl
# modules/lambda-function/variables.tf
variable "function_name" { type = string }
variable "environment" { type = string }
variable "image_uri" { type = string }
variable "memory_size" { type = number, default = 512 }
variable "timeout" { type = number, default = 30 }
variable "environment_variables" { type = map(string), default = {} }
variable "vpc_config" {
  type = object({
    subnet_ids         = list(string)
    security_group_ids = list(string)
  })
  default = null
}

# modules/lambda-function/main.tf
resource "aws_iam_role" "lambda" {
  name = "${var.function_name}-role"
  assume_role_policy = jsonencode({
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

resource "aws_lambda_function" "main" {
  function_name = var.function_name
  role          = aws_iam_role.lambda.arn
  package_type  = "Image"
  image_uri     = var.image_uri
  memory_size   = var.memory_size
  timeout       = var.timeout

  dynamic "environment" {
    for_each = length(var.environment_variables) > 0 ? [1] : []
    content {
      variables = var.environment_variables
    }
  }

  dynamic "vpc_config" {
    for_each = var.vpc_config != null ? [var.vpc_config] : []
    content {
      subnet_ids         = vpc_config.value.subnet_ids
      security_group_ids = vpc_config.value.security_group_ids
    }
  }
}
```

### Database Module with Conditional Aurora

```hcl
# modules/rds/variables.tf
variable "use_aurora" {
  type        = bool
  default     = false
  description = "Use Aurora cluster instead of standalone RDS"
}

# modules/rds/main.tf
resource "aws_rds_cluster" "aurora" {
  count                  = var.use_aurora ? 1 : 0
  cluster_identifier     = var.identifier
  engine                 = "aurora-postgresql"
  engine_version         = var.engine_version
  database_name          = var.database_name
  master_username        = var.master_username
  master_password        = var.master_password
  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = var.security_group_ids
}

resource "aws_rds_cluster_instance" "aurora" {
  count              = var.use_aurora ? var.instance_count : 0
  identifier         = "${var.identifier}-${count.index}"
  cluster_identifier = aws_rds_cluster.aurora[0].id
  instance_class     = var.instance_class
  engine             = "aurora-postgresql"
}

resource "aws_db_instance" "standalone" {
  count                  = var.use_aurora ? 0 : 1
  identifier             = var.identifier
  engine                 = "postgres"
  engine_version         = var.engine_version
  instance_class         = var.instance_class
  allocated_storage      = var.allocated_storage
  db_name                = var.database_name
  username               = var.master_username
  password               = var.master_password
  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = var.security_group_ids
}

# modules/rds/outputs.tf
output "endpoint" {
  value = var.use_aurora ? aws_rds_cluster.aurora[0].endpoint : aws_db_instance.standalone[0].endpoint
}

output "port" {
  value = var.use_aurora ? aws_rds_cluster.aurora[0].port : aws_db_instance.standalone[0].port
}
```

### Feature Flag Pattern

```hcl
variable "enable_waf" {
  type    = bool
  default = false
}

resource "aws_wafv2_web_acl" "main" {
  count = var.enable_waf ? 1 : 0
  # ...
}

resource "aws_wafv2_web_acl_association" "main" {
  count        = var.enable_waf ? 1 : 0
  resource_arn = aws_apigatewayv2_stage.main.arn
  web_acl_arn  = aws_wafv2_web_acl.main[0].arn
}
```

## Module Composition

### Root Module Example

```hcl
# Root main.tf composing multiple modules

module "vpc" {
  source      = "./modules/vpc"
  environment = var.environment
  cidr_block  = var.vpc_cidr
}

module "ecr" {
  source        = "./modules/ecr-repository"
  app_name      = var.app_name
  service_name  = "api"
}

module "lambda" {
  source       = "./modules/lambda-function"
  function_name = "${var.app_name}-api-${var.environment}"
  environment   = var.environment
  image_uri     = "${module.ecr.repository_url}:${var.image_tag}"
  vpc_config = {
    subnet_ids         = module.vpc.private_subnet_ids
    security_group_ids = [module.vpc.lambda_security_group_id]
  }
}

module "database" {
  source            = "./modules/rds"
  identifier        = "${var.app_name}-${var.environment}"
  use_aurora        = var.environment == "production"
  instance_class    = var.db_instance_class
  subnet_ids        = module.vpc.database_subnet_ids
  security_group_ids = [module.vpc.database_security_group_id]
}
```

## Testing Modules

Use Terraform test framework (`.tftest.hcl`):

```hcl
# tests/lambda.tftest.hcl
run "lambda_creates_function" {
  command = plan

  variables {
    function_name = "test-function"
    environment   = "test"
    image_uri     = "123456789.dkr.ecr.us-east-1.amazonaws.com/test:latest"
  }

  assert {
    condition     = aws_lambda_function.main.memory_size == 512
    error_message = "Default memory should be 512MB"
  }
}
```
