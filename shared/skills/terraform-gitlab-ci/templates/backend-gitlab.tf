# GitLab HTTP Backend Configuration
# State is stored in GitLab project's Terraform state API
# Backend is configured via environment variables in CI/CD

terraform {
  backend "http" {
    # These are configured via TF_HTTP_* environment variables in CI:
    # - TF_HTTP_ADDRESS: GitLab state API endpoint
    # - TF_HTTP_LOCK_ADDRESS: Lock endpoint
    # - TF_HTTP_UNLOCK_ADDRESS: Unlock endpoint
    # - TF_HTTP_USERNAME: "gitlab-ci-token"
    # - TF_HTTP_PASSWORD: CI_JOB_TOKEN
    # - TF_HTTP_LOCK_METHOD: "POST"
    # - TF_HTTP_UNLOCK_METHOD: "DELETE"
    #
    # For local development, use partial configuration:
    # terraform init \
    #   -backend-config="address=https://gitlab.com/api/v4/projects/PROJECT_ID/terraform/state/STATE_NAME" \
    #   -backend-config="lock_address=https://gitlab.com/api/v4/projects/PROJECT_ID/terraform/state/STATE_NAME/lock" \
    #   -backend-config="unlock_address=https://gitlab.com/api/v4/projects/PROJECT_ID/terraform/state/STATE_NAME/lock" \
    #   -backend-config="username=your-gitlab-username" \
    #   -backend-config="password=your-personal-access-token"
    retry_wait_min = 5
  }
}
