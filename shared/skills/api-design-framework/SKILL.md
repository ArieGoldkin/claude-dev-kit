---
name: api-design-framework
description: REST, GraphQL, and gRPC API design — endpoint patterns, versioning (URL/header/content negotiation), error handling, pagination, authentication (JWT, OAuth2, API keys), and OpenAPI/AsyncAPI templates.
effort: low
paths:
  - "**/*api*"
  - "**/routes/**"
  - "**/endpoints/**"
  - "openapi.*"
---

# API Design Framework

## Workflow

1. **Choose protocol**: REST for CRUD resources, GraphQL for flexible client queries, gRPC for internal service-to-service
2. **Start from template**: Copy the relevant template below and customize
3. **Run checklist**: Validate against the design checklist before implementation

## Key Conventions

- URL versioning: `/api/v1/` prefix (not header-based)
- Resource naming: plural nouns, kebab-case (`/api/v1/care-plans`)
- Pagination: cursor-based for large collections, offset for small
- Auth: JWT Bearer tokens for APIs, API keys for service-to-service
- Errors: RFC 7807 Problem Details format

## Resources

- [OpenAPI Template](${CLAUDE_SKILL_DIR}/templates/openapi-template.yaml) - Starter OpenAPI 3.1 spec with reusable components
- [AsyncAPI Template](${CLAUDE_SKILL_DIR}/templates/asyncapi-template.yaml) - Starter AsyncAPI 3.0 spec for event-driven APIs
- [API Design Checklist](checklists/api-design-checklist.md) - Review checklist for API design
