# Real Service Detection

## Detection Logic

Scan for real service infrastructure before generating integration tests. Prefer real services over mocks when available.

### Docker Compose Detection

Scan for docker-compose files (in priority order):

```
docker-compose.test.yml
docker-compose.test.yaml
docker-compose.ci.yml
docker-compose.override.yml
docker-compose.yml
docker-compose.yaml
compose.yml
compose.yaml
```

Extract service names and ports from the compose file. Common patterns:

| Service | Image Pattern | Default Port |
|---------|--------------|-------------|
| PostgreSQL | `postgres:*` | 5432 |
| Redis | `redis:*` | 6379 |
| MongoDB | `mongo:*` | 27017 |
| MySQL | `mysql:*` | 3306 |
| Elasticsearch | `elasticsearch:*` | 9200 |
| RabbitMQ | `rabbitmq:*` | 5672 |

### Testcontainers Detection

Check for testcontainers dependencies:

```bash
# Node.js — check package.json
grep -q "testcontainers" package.json

# Python — check requirements or pyproject
grep -q "testcontainers" requirements*.txt pyproject.toml
```

### Connection Strings

When real services are detected, use environment variables for connection:

```bash
DATABASE_URL=postgresql://test:test@localhost:5432/testdb
REDIS_URL=redis://localhost:6379/1
```

### Decision Matrix

| Docker Compose | Testcontainers | `--real-services` | Strategy |
|---------------|----------------|-------------------|----------|
| Found | - | - | Use docker-compose services |
| - | Found | - | Use testcontainers |
| Found | Found | - | Prefer docker-compose (faster startup) |
| - | - | Set | Error: no real service infrastructure found |
| - | - | Not set | Use network-level mocks (MSW / VCR.py) |

### Startup and Cleanup

When using docker-compose for tests:

```bash
# Before tests
docker compose -f docker-compose.test.yml up -d --wait

# Run tests
npm test -- --run

# After tests (cleanup volumes to reset state)
docker compose -f docker-compose.test.yml down -v
```

When using testcontainers, the framework handles lifecycle automatically — no manual startup/cleanup needed.
