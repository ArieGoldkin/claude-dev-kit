# ADR Writing Guide

Detailed examples and guidance for writing Architecture Decision Records. This is a companion to the main [SKILL.md](../SKILL.md) which covers the ADR format structure.

## Table of Contents

- [Context Examples](#context-examples)
- [Decision Examples](#decision-examples)
- [Consequences Examples](#consequences-examples)
- [Alternatives Considered](#alternatives-considered)
- [Common Pitfalls to Avoid](#common-pitfalls-to-avoid)

---

## Context Examples

The Context section should capture the problem, constraints, and forces driving the decision. Here is a full example:

```markdown
## Context

Our monolithic application is experiencing scalability issues:
- Database connection pool exhausted during peak traffic
- Deployment of any feature requires full application restart
- Teams blocked waiting for shared resources
- 45-minute build times impacting developer productivity

Business requirements:
- Support 10x traffic growth over next 12 months
- Enable independent team deployments
- Improve time-to-market for new features

Technical constraints:
- Team familiar with Node.js and Python
- AWS infrastructure already in place
- Budget for 2 senior devops engineers
```

**Key patterns:** Lead with the problem statement, then layer in business requirements and technical constraints. Quantify where possible (e.g., "45-minute build times", "10x traffic growth").

## Decision Examples

The Decision section should be specific and actionable. Avoid hedging language like "we will consider" -- state what you are doing.

- "We will adopt microservices architecture using Node.js with Express"
- "We will consider using microservices"

Here is a full example:

```markdown
## Decision

We will migrate from our monolithic architecture to microservices using:

**Technology Stack:**
- Node.js 20+ with Express for service implementation
- PostgreSQL for transactional data (per service)
- Redis for caching and session management
- RabbitMQ for async communication between services
- Docker + Kubernetes for deployment orchestration

**Service Boundaries:**
- User Service: Authentication, profiles, preferences
- Order Service: Order processing, payment integration
- Inventory Service: Product catalog, stock management
- Notification Service: Email, SMS, push notifications

**Migration Strategy:**
- Strangler Fig pattern: Gradually extract services from monolith
- Start with Notification Service (lowest risk, clear boundaries)
- Complete migration within 6 months (Q1-Q2 2026)

**Responsibility:**
- Backend Architect: Service design and API contracts
- DevOps Team: Kubernetes setup and deployment pipelines
- Team Leads: Migration execution per service
```

**Key patterns:** Break the decision into technology stack, boundaries, migration strategy, and responsibility. Each section answers a different aspect of "what will change."

## Consequences Examples

Be honest about trade-offs. Organize into Positive, Negative, and Neutral outcomes.

```markdown
## Consequences

### Positive
- **Scalability**: Each service can scale independently based on load
- **Development Velocity**: Teams can deploy services without coordination
- **Technology Freedom**: Services can use different tech stacks if needed
- **Fault Isolation**: Failure in one service doesn't crash entire system
- **Faster Build Times**: Services build in 2-5 minutes vs 45 minutes

### Negative
- **Operational Complexity**: Managing 4+ services vs 1 application
- **Network Latency**: Inter-service calls add 10-50ms per hop
- **Distributed Debugging**: Harder to trace requests across services
- **Data Consistency**: Eventually consistent vs immediate consistency
- **Learning Curve**: Team needs to learn Kubernetes, service mesh concepts
- **Initial Slowdown**: 2-3 months of infrastructure setup before benefits

### Neutral
- **Testing Strategy**: Shift from integration tests to contract tests
- **Monitoring**: Need distributed tracing (Jaeger) vs simple logs
- **Cost**: Higher infrastructure costs offset by improved developer productivity
```

**Key patterns:** Negative consequences are as important as positive ones. Include timeline impacts ("2-3 months of infrastructure setup") and quantified trade-offs ("10-50ms per hop").

## Alternatives Considered

Document at least 2 alternatives for every ADR. For each alternative, explain what it was, why it was considered, and why it was not chosen.

### Alternative 1: Optimize Existing Monolith

```markdown
**Description:**
- Add read replicas for database
- Implement caching layer (Redis)
- Use horizontal scaling with load balancer

**Pros:**
- Lower complexity, team already familiar
- Faster implementation (4-6 weeks)
- No architectural re-work needed

**Cons:**
- Doesn't solve deployment coupling
- Limited scalability ceiling
- Build times remain slow
- Teams still blocked on shared resources

**Why not chosen:**
This addresses symptoms but not root causes. We'd face the same issues again in 12-18 months as we continue growing.
```

### Alternative 2: Serverless Architecture (AWS Lambda)

```markdown
**Description:**
- Break application into Lambda functions
- Use API Gateway for routing
- DynamoDB for storage

**Pros:**
- Extreme scalability
- Pay-per-use pricing model
- No server management

**Cons:**
- Vendor lock-in to AWS
- Cold start latency (500ms+)
- Limited to 15-minute execution time
- Team has no serverless experience
- Harder to debug and test locally

**Why not chosen:**
Risk too high given team inexperience. Cold starts unacceptable for our real-time features. Microservices provide similar benefits with more control.
```

## Common Pitfalls to Avoid

| Pitfall | Bad Example | Good Example |
|---------|-------------|--------------|
| **Too Technical** | "We'll use Kubernetes with these 50 YAML configs..." | "We'll use Kubernetes for container orchestration because..." |
| **Too Vague** | "We'll use a better database" | "We'll use PostgreSQL 15+ for transactional data because..." |
| **No Alternatives** | Only documenting the chosen solution | Document why alternatives weren't chosen |
| **Missing Consequences** | Only listing benefits | Honest about costs and trade-offs |
| **No Context** | "We decided to use Redis" | "Given our 1M+ concurrent users and sub-50ms latency requirement..." |
