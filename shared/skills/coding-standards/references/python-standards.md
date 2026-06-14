# Python Standards

Token-optimized reference for Python code quality standards in platform (AWS Lambda).

---

## Function Standards

### Size & Complexity

| Rule | Target | Check Method |
|------|--------|--------------|
| Function length | < 50 lines | Manual count (excluding docstrings/empty lines) |
| Cyclomatic complexity | < 10 | Manual count (if/elif/else, for/while, and/or, try/except) |
| Nesting depth | < 4 levels | Manual count |
| Parameters | ≤ 5 | Count function parameters |

### Examples

✅ **Good - Under 50 lines**:
```python
def get_member_activities(member_id: str, session: Session) -> list[Activity]:
    """Fetch activities for a member with tenant isolation."""
    try:
        activities = session.query(Activity).filter_by(
            member_id=member_id
        ).all()
        return activities
    except NoResultFound:
        logger.warning("No activities found", extra={"member_id": member_id})
        return []
```

❌ **Bad - Over 50 lines, high complexity**:
```python
def process_member_data(member_id):  # 80+ lines with nested logic
    if member_id:
        member = get_member(member_id)
        if member:
            if member.email:
                if validate_email(member.email):
                    if member.subscriptions:
                        for sub in member.subscriptions:
                            if sub.active:
                                # ... 60 more lines
```

**Fix**: Extract to smaller functions:
```python
def process_member_data(member_id: str) -> ProcessedMember:
    member = validate_and_fetch_member(member_id)
    active_subs = get_active_subscriptions(member)
    return process_subscriptions(active_subs)
```

---

## Type Hints

### Required on All Function Signatures

✅ **Good**:
```python
def fetch_member(member_id: str, include_deleted: bool = False) -> Member | None:
    """Fetch member by ID."""
    query = session.query(Member).filter_by(id=member_id)
    if not include_deleted:
        query = query.filter_by(deleted=False)
    return query.first()
```

❌ **Bad - No type hints**:
```python
def fetch_member(member_id, include_deleted=False):  # No hints!
    query = session.query(Member).filter_by(id=member_id)
    # ...
```

### Common Type Patterns

| Scenario | Type Hint |
|----------|-----------|
| Optional return | `Member \| None` or `Optional[Member]` |
| List of objects | `list[Activity]` |
| Dictionary | `dict[str, Any]` |
| Union types | `str \| int` or `Union[str, int]` |
| No return | `-> None` |

---

## Pydantic Models

### Use for Request/Response Validation

✅ **Good**:
```python
from pydantic import BaseModel, Field
from datetime import datetime

class ActivityRequest(BaseModel):
    """Request model with validation."""
    action_id: str = Field(..., description="Action ID")
    completed_at: datetime
    notes: str | None = Field(None, max_length=500)

class ActivityResponse(BaseModel):
    """Response model."""
    id: str
    action_id: str
    completed_at: datetime
    created_at: datetime

    class Config:
        from_attributes = True  # SQLAlchemy ORM mode

@app.post("/activities")
def create_activity(request: ActivityRequest) -> ActivityResponse:
    activity = Activity(**request.dict())
    session.add(activity)
    session.commit()
    return ActivityResponse.from_orm(activity)
```

---

## Error Handling

### Specific Exceptions

✅ **Good**:
```python
def fetch_activity(activity_id: str) -> Activity:
    try:
        return session.query(Activity).filter_by(id=activity_id).one()
    except NoResultFound:
        logger.warning("Activity not found", extra={"activity_id": activity_id})
        raise HTTPException(status_code=404, detail="Activity not found")
    except Exception as e:
        logger.error("Database error", extra={"error": str(e)})
        raise HTTPException(status_code=500, detail="Internal server error")
```

❌ **Bad - Generic catch**:
```python
def fetch_activity(activity_id: str) -> Activity:
    try:
        return session.query(Activity).filter_by(id=activity_id).one()
    except:  # Too broad!
        return None
```

---

## AWS Lambda Patterns

### Lambda Powertools

✅ **Good - Standard Lambda structure**:
```python
from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.event_handler import APIGatewayRestResolver
from aws_lambda_powertools.utilities.typing import LambdaContext

logger = Logger()
tracer = Tracer()
app = APIGatewayRestResolver()

@app.get("/activities")
@tracer.capture_method
def get_activities():
    """Get activities for authenticated member."""
    # Extract member_id from JWT (validated by authorizer)
    member_id = app.current_event.request_context.authorizer.claims["sub"]

    # Query with tenant isolation
    activities = session.query(Activity).filter_by(member_id=member_id).all()

    # Return Pydantic models
    return [ActivityResponse.from_orm(a) for a in activities]

@logger.inject_lambda_context
@tracer.capture_lambda_handler
def handler(event: dict, context: LambdaContext) -> dict:
    return app.resolve(event, context)
```

### Logging (Structured)

✅ **Good**:
```python
logger.info("Activity created", extra={
    "member_id": member_id,
    "activity_id": activity_id,
    "action": "create_activity"
})
```

❌ **Bad**:
```python
print(f"Activity created for {member.email}")  # PII in logs!
logger.info(f"Member {member.name} completed activity")  # PII!
```

---

## Database (SQLAlchemy)

### Tenant Isolation (CRITICAL)

✅ **Good - Always filter by tenant**:
```python
# Filter by member_id (tenant isolation)
activities = session.query(Activity).filter_by(member_id=member_id).all()

# Filter by coach_id (tenant isolation)
members = session.query(Member).filter_by(coach_id=coach_id).all()
```

❌ **Bad - No tenant filter (SECURITY VULNERABILITY!)**:
```python
# Returns ALL activities across ALL members - data breach!
all_activities = session.query(Activity).all()
```

### Query Patterns

✅ **Good - Parameterized queries**:
```python
activities = session.query(Activity).filter(
    Activity.member_id == member_id,
    Activity.created_at >= start_date
).all()
```

❌ **Bad - String concatenation (SQL injection risk!)**:
```python
query = f"SELECT * FROM activities WHERE member_id = '{member_id}'"  # DON'T!
session.execute(query)
```

---

## Code Quality

### DRY Principle

❌ **Bad - Duplication**:
```python
def get_member_activities(member_id: str) -> list[Activity]:
    return session.query(Activity).filter_by(member_id=member_id).all()

def get_member_goals(member_id: str) -> list[Goal]:
    return session.query(Goal).filter_by(member_id=member_id).all()
```

✅ **Good - Generic function**:
```python
def get_member_entities(
    model: type[Base],
    member_id: str
) -> list[Base]:
    return session.query(model).filter_by(member_id=member_id).all()

# Usage
activities = get_member_entities(Activity, member_id)
goals = get_member_entities(Goal, member_id)
```

### Clear Naming

| Type | Convention | Example |
|------|-----------|---------|
| Variables | `snake_case` | `member_data`, `is_active` |
| Functions | `snake_case` | `fetch_activities()`, `validate_email()` |
| Classes | `PascalCase` | `ActivityList`, `MemberProfile` |
| Constants | `SCREAMING_SNAKE_CASE` | `MAX_RETRIES`, `API_BASE_URL` |
| Private | `_leading_underscore` | `_internal_helper()` |

---

## Docstrings

### Google Style (Recommended)

✅ **Good**:
```python
def create_activity(
    member_id: str,
    action_id: str,
    completed_at: datetime
) -> Activity:
    """Create a new activity for a member.

    Args:
        member_id: UUID of the member
        action_id: UUID of the action being completed
        completed_at: Timestamp when activity was completed

    Returns:
        Created Activity instance

    Raises:
        ValidationError: If action_id doesn't exist
        DatabaseError: If database operation fails
    """
    # Implementation
```

### When to Add Docstrings

- ✅ Public functions/classes (always)
- ✅ Complex logic (when not self-evident)
- ❌ Simple getters/setters (self-documenting)
- ❌ Obvious functions (`get_member_by_id` doesn't need docstring)

---

## Platform Specifics

### No PII in Logs

❌ **Bad**:
```python
logger.info(f"Member {member.name} completed activity")  # Name is PII
print(f"Processing {member.email}")  # Email is PII
```

✅ **Good**:
```python
logger.info("Activity completed", extra={
    "member_id": member_id,
    "activity_id": activity_id
})
```

### Tenant Isolation Tests

✅ **Good - Negative tests required**:
```python
def test_member_cannot_access_other_member_data():
    """Verify tenant isolation."""
    # Create activity for member A
    activity_a = create_activity(member_id="member-a")

    # Member B tries to access
    response = client.get(
        f"/activities/{activity_a.id}",
        headers=auth_for_member_b()
    )

    assert response.status_code == 403  # Forbidden
```

---

## Tool Enforcement

| Standard | Manual | Tool Enforced |
|----------|--------|---------------|
| Function < 50 lines | ✅ | ❌ |
| Complexity < 10 | ✅ | ❌ (ruff gap) |
| Type hints | ✅ | ❌ (mypy not configured) |
| Import sorting | ✅ | ❌ (ruff gap) |
| Naming conventions | ✅ | ❌ (ruff gap) |
| Line length | ✅ | ❌ (ruff gap) |
| **ALL Python linting** | ✅ | ❌ **CRITICAL: ruff has ZERO rules enabled** |

See `tool-configs/actual-tool-configs.md` for critical gaps.

---

## Quick Checklist

**Before submitting code:**

- [ ] Functions < 50 lines
- [ ] Complexity < 10 (count branches manually)
- [ ] Type hints on all function signatures
- [ ] Pydantic models for request/response
- [ ] Try/except for database operations
- [ ] Clear function names (snake_case)
- [ ] No PII in logs (member_id only)
- [ ] Tenant isolation: ALL queries filter by member_id/coach_id
- [ ] No string concatenation in SQL (use ORM)
- [ ] Structured logging with extra fields
- [ ] Tests include negative tests (tenant isolation)

**See also:**
- `typescript-standards.md` for frontend patterns
- `naming-conventions.md` for naming rules
- `../tool-configs/gaps-and-recommendations.md` for ruff configuration needed
