# Environment Configuration Template
# Copy this file to vars/{environment}.tfvars and customize
#
# Usage:
#   terraform plan -var-file=vars/dev.tfvars
#   terraform apply -var-file=vars/production.tfvars

# ==============================================================================
# ENVIRONMENT
# ==============================================================================

environment = "dev"  # dev | staging | production

# ==============================================================================
# APPLICATION
# ==============================================================================

app_name     = "myapp"
service_name = "api"
team_name    = "platform"
cost_center  = "engineering"

# ==============================================================================
# COMPUTE - LAMBDA
# ==============================================================================

lambda_memory  = 512   # MB: 128, 256, 512, 1024, 2048, 4096, 8192, 10240
lambda_timeout = 30    # seconds: max 900

# Image tag for container Lambdas
image_tag = "latest"  # Use semantic version in production: v1.2.3

# ==============================================================================
# DATABASE - RDS
# ==============================================================================

# Use Aurora for production, standalone for dev/staging
use_aurora = false

# Instance class
# Dev: db.t3.micro, db.t3.small
# Staging: db.t3.medium, db.r6g.large
# Production: db.r6g.large, db.r6g.xlarge
instance_class = "db.t3.micro"

# Storage
allocated_storage     = 20   # GB (standalone RDS)
max_allocated_storage = 100  # GB (auto-scaling limit)

# Protection
enable_deletion_protection = false  # true for production
skip_final_snapshot        = true   # false for production

# ==============================================================================
# NETWORKING
# ==============================================================================

# VPC CIDR (if creating new VPC)
vpc_cidr = "10.0.0.0/16"

# CORS origins for API Gateway
cors_origins = [
  "http://localhost:3000",
  "https://dev.example.com"
]

# ==============================================================================
# FEATURE FLAGS
# ==============================================================================

enable_waf          = false  # true for staging/production
enable_xray_tracing = true
enable_vpc_lambda   = true

# ==============================================================================
# SCALING
# ==============================================================================

# Lambda concurrency (-1 for unreserved)
lambda_reserved_concurrency = -1

# SQS batch processing
sqs_batch_size = 10

# ==============================================================================
# MONITORING
# ==============================================================================

log_retention_days = 30  # 30 for dev, 90 for staging, 365 for production

# ==============================================================================
# SECRETS
# ==============================================================================

# These should be passed via CI/CD or environment variables, not committed
# database_password = "OVERRIDE_IN_CI"
