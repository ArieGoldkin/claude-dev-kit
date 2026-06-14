# Changelog

All notable changes to the devops-toolkit (`dtk`) plugin will be documented in this file.

## [2.0.5] - 2026-06-14 — first open-source release

DevOps, infrastructure, and backend development: AWS, Terraform, CI/CD, Salesforce, Lambda container patterns, and Husky pre-commit setup. 15 skills, 2 agents, 13 commands, plus the `repo-access-guard` hook.

### Highlights

- **`repo-access-guard`** restricts configured repos to AWS Bedrock users; ships with an empty default policy (`bedrock_only: []`) — add your own patterns via `.claude/repo-access-policy.json`.
- MIT licensed.

_First public release at 2.0.5; earlier version history was internal and has been omitted._
