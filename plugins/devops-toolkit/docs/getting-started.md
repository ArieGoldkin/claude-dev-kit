# DevOps Toolkit — Getting Started Guide

A practical guide for using the plugin's skills, agents, and session continuity system.

---

## Skills

Skills are domain-specific knowledge packs that Claude loads when you invoke them with a slash command. Think of them as "expert mode" for a specific topic.

### Available Skills

| Skill | Command | Use when... |
|-------|---------|-------------|
| **Terraform AWS Modules** | `/terraform-aws-modules` | Writing multi-env Terraform, naming conventions, tagging |
| **Terraform GitLab CI** | `/terraform-gitlab-ci` | Setting up GitLab CI for Terraform with OIDC auth |
| **Terraform Lambda Containers** | `/terraform-aws-lambda-containers` | Container-native Lambda deployments with ECR + API Gateway |
| **AWS CLI Toolkit** | `/aws-cli-toolkit` | Lambda deploys, CloudWatch queries, Secrets Manager ops |
| **AWS Networking** | `/aws-networking` | VPC, Transit Gateway, PrivateLink, VPC endpoints |
| **AWS Cost Optimization** | `/aws-cost-optimization` | Savings Plans, Spot, FinOps patterns |
| **Databricks AWS** | `/databricks-aws` | Databricks workspace + Unity Catalog on AWS |
| **DevOps Deployment** | `/devops-deployment` | CI/CD pipelines, Docker, Kubernetes, IaC |
| **Observability & Monitoring** | `/observability-monitoring` | Structured logging, metrics, tracing, alerting |
| **Performance Optimization** | `/performance-optimization` | Profiling, bottleneck analysis, optimization patterns |
| **Security Checklist** | `/security-checklist` | Security reviews, threat modeling, compliance |
| **API Design Framework** | `/api-design-framework` | REST, GraphQL, gRPC design patterns |
| **Database Schema Designer** | `/database-schema-designer` | Relational and document schema design |
| **PostgreSQL Master** | `/postgresql-master` | Query optimization, migrations, indexing |
| **Testing Strategy Builder** | `/testing-strategy-builder` | Test plans, coverage strategy, test architecture |
| **Coding Standards** | `/coding-standards` | Code quality, function size limits, review patterns |
| **Code Review Playbook** | `/code-review-playbook` | Structured code review with Lambda, DB, and error handling patterns |
| **ASCII Visualizer** | `/ascii-visualizer` | Architecture diagrams, flowcharts in ASCII |

### How to Use a Skill

Just mention it at the start of your request:

```
/terraform-aws-modules  I need a reusable Lambda module with VPC support for 3 environments
```

```
/code-review-playbook  Review this PR — focus on Lambda patterns and error handling
```

```
/security-checklist  We're adding a new public API endpoint, what should I check?
```

You don't need to load the skill first — Claude will apply the relevant patterns automatically when you use the command.

---

## Agents

Agents are specialized Claude instances with constrained focus. Useful for scoped, parallelizable, or review-oriented tasks where you want a fresh perspective without mixed context.

### Available Agents

**`devops-architect`**
Designs Python AWS Lambda microservices, PostgreSQL schemas, and REST APIs. Use for architecture questions, service design, and backend patterns.
*Do NOT use for: frontend/React, UI design, or Terraform provisioning.*

**`quality-reviewer`**
Reviews code for bugs, security issues, performance, and architectural patterns. Runs linting and type checks.
*Do NOT use for: writing new features, UI design, or product strategy.*

**`web-research-analyst`**
Fetches and analyzes external documentation, API references, and technical content.
*Do NOT use for: writing code, database work, or internal codebase tasks.*

### How to Use an Agent

Reference the agent in your request:

```
Use the devops-architect agent to design the event processing service for this SQS workflow
```

```
Use the quality-reviewer agent to review the changes in hooks/src/pretool/
```

```
Use the web-research-analyst agent to find the latest AWS Lambda container image size limits
```

---

## Session Continuity (Ledger System)

The ledger system preserves your project state across Claude sessions. Without it, context is lost when a conversation ends or compacts. With it, Claude picks up exactly where you left off.

### The Three Commands

| Command | When to use |
|---------|-------------|
| `/save-state` | Periodically during long sessions to checkpoint progress |
| `/create-handoff` | At the end of a session before closing Claude |
| `/resume-session` | At the start of a new session to load previous context |

### Typical Workflow

**During a session** — run `/save-state` after completing significant work:
```
/save-state
```
Claude updates the ledger with current status, decisions made, and open questions.

**Ending a session** — run `/create-handoff` before you stop:
```
/create-handoff
```
Claude writes a structured handoff document summarizing what was done, what's next, and any blockers.

**Starting a new session** — run `/resume-session` first:
```
/resume-session
```
Claude reads the latest handoff and ledger, then gives you a summary of where things stand.

### What Gets Saved

The ledger tracks two types of content:

- **Snapshots** (replaced each update): Current status, active work, key decisions, open questions
- **History** (append-only): Session log, completed milestones, architectural decisions

**Files:**
- Ledger: `.claude/continuity/ledgers/CONTINUITY_devops-plugin.md`
- Handoffs: `.claude/continuity/handoffs/YYYY-MM-DD_topic.md`

### Tips

- Run `/save-state` before any risky operation (large refactor, schema migration, etc.)
- Run `/create-handoff` even for short sessions — the overhead is low and the payoff is high
- The handoff includes a "recommended first task" that Claude will surface when you `/resume-session`
- If context runs low mid-session, `/save-state` first — compaction preserves the hook-injected state, but a manual save ensures your latest work is captured

---

## Quick Reference

```bash
# Start session
/resume-session

# During work
/save-state                          # Checkpoint progress
/terraform-aws-modules               # Invoke a skill
/code-review-playbook                # Invoke a skill

# End session
/create-handoff
```
