# SQLAlchemy ORM Patterns

## Table of Contents

- [Project ORM Setup](#project-orm-setup)
- [Modern SQLAlchemy 2.0 Query Style](#modern-sqlalchemy-20-query-style)
- [Relationship Loading Strategies](#relationship-loading-strategies)
- [Bulk Operations](#bulk-operations)
- [Transaction Management](#transaction-management)
- [Handling Relationships](#handling-relationships)
- [Common Pitfalls](#common-pitfalls)
- [Query Patterns](#query-patterns)
- [Performance Tips](#performance-tips)
- [Project-Specific Patterns](#project-specific-patterns)
- [Testing with ORM](#testing-with-orm)
- [Additional Resources](#additional-resources)


Best practices for SQLAlchemy 2.0+ with the acme platform.

## Project ORM Setup

**Models location**: `utils/database/models/acme_operational/`
**Base class**: `utils/database/base.py`
**Engine creation**: `utils/database/db_utils.py`

---

## Modern SQLAlchemy 2.0 Query Style

### Select Statements

```python
from sqlalchemy import select
from utils.database.models.acme_operational import Member, Subscription

# ✅ SQLAlchemy 2.0 style
stmt = select(Member).where(Member.email == "user@example.com")
member = session.scalars(stmt).first()

# ✅ With joins
stmt = (
    select(Member, Subscription)
    .join(Subscription, Member.id == Subscription.member_id)
    .where(Subscription.status == "active")
)
results = session.execute(stmt).all()

# ❌ Legacy 1.x style (still works but deprecated)
member = session.query(Member).filter(Member.email == "user@example.com").first()
```

---

## Relationship Loading Strategies

### N+1 Query Prevention

```python
from sqlalchemy.orm import selectinload, joinedload

# ❌ BAD: N+1 queries
members = session.scalars(select(Member)).all()
for member in members:
    print(member.subscriptions)  # Separate query for EACH member

# ✅ GOOD: selectinload (2 queries total, no N+1)
stmt = select(Member).options(selectinload(Member.subscriptions))
members = session.scalars(stmt).all()
for member in members:
    print(member.subscriptions)  # No additional queries

# ✅ GOOD: joinedload (single query with LEFT JOIN)
stmt = select(Member).options(joinedload(Member.subscriptions))
members = session.scalars(stmt).unique().all()  # unique() needed with joinedload
```

### When to Use Each Strategy

**`selectinload`** (Recommended for most cases):
- Separate SELECT with IN clause
- Efficient for one-to-many relationships
- No cartesian product
- Use: Member → Subscriptions, Member → Events

**`joinedload`**:
- Single query with LEFT JOIN
- Can create cartesian product with multiple relationships
- Use: Member → Profile (one-to-one)

**`lazyload`** (default, avoid in loops):
- Queries on attribute access
- Causes N+1 problems in loops
- Use: Only for single-record access

---

## Bulk Operations

### Bulk Insert

```python
from sqlalchemy import insert

# ✅ GOOD: Bulk insert with executemany
members_data = [
    {"email": "user1@example.com", "first_name": "User1"},
    {"email": "user2@example.com", "first_name": "User2"},
]

session.execute(insert(Member), members_data)
session.commit()

# ⚠️ ACCEPTABLE: session.add_all (ORM overhead)
members = [Member(**data) for data in members_data]
session.add_all(members)
session.commit()
```

### Bulk Update

```python
from sqlalchemy import update

# ✅ GOOD: Bulk update
stmt = (
    update(Member)
    .where(Member.status == "inactive")
    .values(status="archived")
)
session.execute(stmt)
session.commit()

# ❌ BAD: Update in loop
members = session.scalars(select(Member).where(Member.status == "inactive")).all()
for member in members:
    member.status = "archived"
session.commit()  # Generates UPDATE for each member
```

---

## Transaction Management

### Context Manager Pattern

```python
from sqlalchemy.orm import Session

# ✅ GOOD: Automatic commit/rollback
with Session(engine) as session:
    member = Member(email="user@example.com")
    session.add(member)
    session.commit()  # Commits on success, rolls back on exception

# ✅ GOOD: Nested transactions with savepoints
with Session(engine) as session:
    with session.begin_nested():  # SAVEPOINT
        # Try risky operation
        member = Member(email="duplicate@example.com")
        session.add(member)
        session.flush()  # May fail on unique constraint

    session.commit()  # Commit outer transaction
```

### Explicit Transaction Control

```python
# ✅ GOOD: Manual transaction control
session = Session(engine)
try:
    member = Member(email="user@example.com")
    session.add(member)
    session.commit()
except Exception as e:
    session.rollback()
    raise
finally:
    session.close()
```

---

## Handling Relationships

### Accessing Related Objects

```python
# ✅ GOOD: Relationship defined in model
class Member(Base):
    __tablename__ = "members"
    id = Column(Integer, primary_key=True)

    # Relationship
    subscriptions = relationship("Subscription", back_populates="member")

# Access related objects
member = session.get(Member, 1)
subscriptions = member.subscriptions  # Uses relationship (lazy load by default)

# ✅ GOOD: Eager load to avoid N+1
stmt = select(Member).options(selectinload(Member.subscriptions))
member = session.scalars(stmt).first()
subscriptions = member.subscriptions  # Already loaded, no query
```

### Adding Related Objects

```python
# ✅ GOOD: Add via relationship
member = Member(email="user@example.com")
subscription = Subscription(plan_type="premium", status="active")
member.subscriptions.append(subscription)

session.add(member)  # Also adds subscription
session.commit()

# ✅ GOOD: Add with foreign key
member = session.get(Member, 1)
subscription = Subscription(
    member_id=member.id,
    plan_type="premium",
    status="active"
)
session.add(subscription)
session.commit()
```

---

## Common Pitfalls

### Detached Objects

```python
# ❌ PROBLEM: Object detached after session closes
def get_member(member_id):
    with Session(engine) as session:
        member = session.get(Member, member_id)
        return member  # Detached after with block

member = get_member(1)
member.email  # Works (scalar attribute loaded)
member.subscriptions  # ❌ Error! Lazy load fails on detached object

# ✅ SOLUTION 1: Eager load relationships
def get_member(member_id):
    with Session(engine) as session:
        stmt = select(Member).options(selectinload(Member.subscriptions)).where(Member.id == member_id)
        member = session.scalars(stmt).first()
        return member  # Relationships already loaded

# ✅ SOLUTION 2: Reattach to new session
member = get_member(1)
with Session(engine) as new_session:
    new_session.add(member)  # Reattach
    member.subscriptions  # Works
```

### Flushing vs Committing

```python
# flush() - Sends SQL to database but doesn't commit
# commit() - Commits transaction (includes implicit flush)

with Session(engine) as session:
    member = Member(email="user@example.com")
    session.add(member)

    session.flush()  # Generates INSERT, assigns member.id, but not committed
    print(member.id)  # Available after flush

    # If exception occurs here, member is NOT in database (rollback)

    session.commit()  # Commits transaction
```

---

## Query Patterns

### Filtering

```python
from sqlalchemy import and_, or_

# ✅ Multiple filters (AND)
stmt = select(Member).where(
    Member.status == "active",
    Member.email.like("%@example.com")
)

# ✅ OR conditions
stmt = select(Member).where(
    or_(
        Member.first_name == "John",
        Member.last_name == "Doe"
    )
)

# ✅ IN clause
member_ids = [1, 2, 3]
stmt = select(Member).where(Member.id.in_(member_ids))
```

### Ordering and Limiting

```python
# ✅ Order by
stmt = select(Member).order_by(Member.created_at.desc())

# ✅ Limit and offset
stmt = select(Member).limit(100).offset(0)

# ✅ Distinct
stmt = select(Member.email).distinct()
```

### Aggregations

```python
from sqlalchemy import func

# ✅ Count
stmt = select(func.count()).select_from(Member).where(Member.status == "active")
count = session.scalar(stmt)

# ✅ Group by
stmt = (
    select(Member.status, func.count())
    .group_by(Member.status)
)
results = session.execute(stmt).all()
```

---

## Performance Tips

1. **Use `session.scalars()`** for single-column selects (returns values, not Row objects)
2. **Use `session.execute()`** for multi-column selects or joins
3. **Avoid `.all()`** unless needed - iterate results instead
4. **Use `yield_per()`** for large result sets (streaming)
5. **Always eager-load relationships** used in loops
6. **Use bulk operations** for batch inserts/updates
7. **Minimize session lifespan** - use context managers
8. **Don't query in loops** - query once, process in memory

---

## Project-Specific Patterns

### Getting a Session

```python
from utils.database.db_utils import get_session

# Get sessionmaker
SessionLocal = get_session(db_secret, db_name, db_host, db_port)

# Use with context manager
with SessionLocal() as session:
    member = session.get(Member, 1)
    # ... operations
    session.commit()
```

### Lambda Handler Pattern

```python
def lambda_handler(event, context):
    SessionLocal = get_session(
        db_secret=os.environ["DB_SECRET_NAME"],
        db_name=os.environ["DB_NAME"],
        db_host=os.environ["DB_HOST"],
        db_port=os.environ["DB_PORT"]
    )

    with SessionLocal() as session:
        # Database operations
        member = session.get(Member, event["member_id"])
        # ... logic
        session.commit()

    return {"statusCode": 200, "body": "Success"}
```

---

## Testing with ORM

### In-Memory SQLite for Tests

```python
from sqlalchemy import create_engine
from utils.database.base import Base

# Create in-memory database
engine = create_engine("sqlite:///:memory:")
Base.metadata.create_all(engine)

# Use in tests
with Session(engine) as session:
    member = Member(email="test@example.com")
    session.add(member)
    session.commit()

    # Assert
    assert session.get(Member, member.id) is not None
```

---

## Additional Resources

- SQLAlchemy 2.0 Documentation: https://docs.sqlalchemy.org/en/20/
- ORM Tutorial: https://docs.sqlalchemy.org/en/20/orm/tutorial.html
- Project models: `utils/database/models/acme_operational/`
- SQL patterns: See `references/sql-patterns.md`
