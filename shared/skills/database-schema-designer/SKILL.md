---
name: database-schema-designer
description: Database schema design for SQL (PostgreSQL, MySQL) and NoSQL (MongoDB) — normalization (1NF/2NF/3NF), indexing, constraints, zero-downtime migrations, query optimization, and N+1 prevention.
paths:
  - "**/migrations/**"
  - "**/models/**"
  - "**/*schema*"
  - "*.sql"
---

# Database Schema Designer

## Overview

This skill provides comprehensive guidance for designing robust, scalable database schemas for both SQL and NoSQL databases. Whether building from scratch or evolving existing schemas, this framework ensures data integrity, performance, and maintainability.

**When to use this skill:**
- Designing new database schemas
- Refactoring or migrating existing schemas
- Optimizing database performance
- Choosing between SQL and NoSQL
- Creating database migrations
- Establishing indexing strategies

## Core Design Principles

**1. Model the Domain, Not the UI**
- Schema reflects business entities and relationships
- Don't let UI requirements drive data structure

**2. Optimize for Reads or Writes (Not Both)**
- OLTP (transactional): Normalized, optimized for writes
- OLAP (analytical): Denormalized, optimized for reads

**3. Plan for Scale From Day One**
- Indexing strategy, partitioning, caching, read replicas

**4. Data Integrity Over Performance**
- Use constraints, foreign keys, validation
- Performance issues can be optimized later

---

## Normalization Quick Reference

### 1st Normal Form (1NF)
**Rule**: Atomic values, no repeating groups

```sql
-- ❌ Bad: Multiple values in one column
product_ids VARCHAR(255)  -- '101,102,103'

-- ✅ Good: Separate rows
CREATE TABLE order_items (
  order_id INT,
  product_id INT
);
```

### 2nd Normal Form (2NF)
**Rule**: 1NF + all columns depend on entire primary key

```sql
-- ❌ Bad: customer_name depends only on customer_id
PRIMARY KEY (order_id, product_id),
customer_name VARCHAR(100)  -- Depends on customer_id only

-- ✅ Good: Separate customer table
CREATE TABLE orders (
  id INT PRIMARY KEY,
  customer_id INT,
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);
```

### 3rd Normal Form (3NF)
**Rule**: 2NF + no transitive dependencies

```sql
-- ❌ Bad: country depends on postal_code, not id
postal_code VARCHAR(10),
country VARCHAR(50)  -- Transitive dependency

-- ✅ Good: Separate postal_codes table
CREATE TABLE customers (
  id INT PRIMARY KEY,
  postal_code VARCHAR(10),
  FOREIGN KEY (postal_code) REFERENCES postal_codes(code)
);
```

**When to denormalize:**
- Read-heavy applications (reporting, analytics)
- Frequently joined tables causing performance issues
- Pre-calculated aggregates (counts, sums)

**For complete normalization guide:** See [references/normalization-detailed.md](${CLAUDE_SKILL_DIR}/references/normalization-detailed.md)

---

## Data Types Quick Guide

### Strings
```sql
CHAR(10)      -- Fixed-length (ISO date, state code)
VARCHAR(255)  -- Variable-length (email, name)
TEXT          -- Long text (articles, descriptions)
```

### Numbers
```sql
INT           -- IDs, counts (-2.1B to 2.1B)
BIGINT        -- Large numbers (timestamps, large IDs)
DECIMAL(10,2) -- Money (exact precision)
FLOAT/DOUBLE  -- Scientific calculations (approximate)
```

### Dates
```sql
DATE          -- Date only: 2025-10-31
TIMESTAMP     -- Date + time (auto-converts timezone)
-- Always store in UTC
```

### Boolean
```sql
BOOLEAN       -- PostgreSQL
TINYINT(1)    -- MySQL
```

**For complete data type guide:** See [references/data-types-guide.md](${CLAUDE_SKILL_DIR}/references/data-types-guide.md)

---

## Indexing Strategies

### When to Create Indexes

```sql
-- ✅ Foreign keys
CREATE INDEX idx_orders_customer_id ON orders(customer_id);

-- ✅ Frequently queried columns
CREATE INDEX idx_users_email ON users(email);

-- ✅ WHERE, ORDER BY, GROUP BY columns
CREATE INDEX idx_orders_created_at ON orders(created_at);

-- ✅ Composite index (order matters!)
CREATE INDEX idx_orders_customer_status ON orders(customer_id, status);
```

### Index Types

| Type | Use Case | Example |
|------|----------|---------|
| **B-Tree** (default) | Equality, ranges | `price > 100` |
| **Hash** | Exact matches only | `email = 'user@example.com'` |
| **Full-Text** | Text search | `MATCH(title, content)` |
| **Partial** (PostgreSQL) | Conditional rows | `WHERE is_active = TRUE` |

### Composite Index Rules

```sql
CREATE INDEX idx_orders_customer_status ON orders(customer_id, status);

-- ✅ Uses index
WHERE customer_id = 123 AND status = 'pending'
WHERE customer_id = 123

-- ❌ Doesn't use index (status is second column)
WHERE status = 'pending'
```

**Rule**: Put most selective column first, or most frequently queried alone.

**For complete indexing patterns:** See [references/indexing-strategies.md](${CLAUDE_SKILL_DIR}/references/indexing-strategies.md)

---

## Constraints

### Primary Key
```sql
-- Auto-incrementing
id INT AUTO_INCREMENT PRIMARY KEY

-- UUID (distributed systems)
id CHAR(36) PRIMARY KEY DEFAULT (UUID())
```

### Foreign Key
```sql
FOREIGN KEY (customer_id) REFERENCES customers(id)
  ON DELETE CASCADE      -- Delete child when parent deleted
  ON DELETE RESTRICT     -- Prevent deletion if referenced
  ON DELETE SET NULL     -- Set to NULL when parent deleted
```

### Unique, Check, Not Null
```sql
email VARCHAR(255) UNIQUE NOT NULL
price DECIMAL(10,2) CHECK (price >= 0)
discount_percent INT CHECK (discount_percent BETWEEN 0 AND 100)
```

---

## Common Schema Patterns

### One-to-Many (Orders → Items)
```sql
CREATE TABLE orders (
  id INT PRIMARY KEY,
  customer_id INT NOT NULL
);

CREATE TABLE order_items (
  id INT PRIMARY KEY,
  order_id INT NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);
```

### Many-to-Many (Students ↔ Courses)
```sql
CREATE TABLE enrollments (
  student_id INT,
  course_id INT,
  enrolled_at TIMESTAMP,
  PRIMARY KEY (student_id, course_id),
  FOREIGN KEY (student_id) REFERENCES students(id),
  FOREIGN KEY (course_id) REFERENCES courses(id)
);
```

### Self-Referencing (Employees → Manager)
```sql
CREATE TABLE employees (
  id INT PRIMARY KEY,
  manager_id INT,
  FOREIGN KEY (manager_id) REFERENCES employees(id)
);
```

---

## NoSQL Database Design (MongoDB)

### Embedding vs Referencing

**Embedding (Denormalization):**
```json
{
  "_id": "order_123",
  "customer": { "id": "cust_456", "name": "Jane" },
  "items": [
    { "product_id": "prod_789", "quantity": 2, "price": 29.99 }
  ]
}
```

**When to embed:**
- Data accessed together frequently
- 1:few relationships
- Child documents don't need independent existence

**Referencing (Normalization):**
```json
{
  "_id": "order_123",
  "customer_id": "cust_456",
  "item_ids": ["item_1", "item_2"]
}
```

**When to reference:**
- Data accessed independently
- 1:many relationships (many items)
- Large documents (approaching 16MB limit)

**For complete NoSQL patterns:** See [references/nosql-patterns.md](${CLAUDE_SKILL_DIR}/references/nosql-patterns.md)

---

## Database Migrations

### Best Practices

**1. Always Reversible**
```sql
-- Up migration
ALTER TABLE users ADD COLUMN phone VARCHAR(20);

-- Down migration
ALTER TABLE users DROP COLUMN phone;
```

**2. Backward Compatible**
```sql
-- ✅ Add nullable column
ALTER TABLE users ADD COLUMN middle_name VARCHAR(50);

-- ❌ Add required column (breaks existing code)
ALTER TABLE users ADD COLUMN middle_name VARCHAR(50) NOT NULL;
```

**3. Test on Production Copy**
- Test on staging with production data snapshot
- Measure migration duration
- Plan for downtime (if needed)

### Zero-Downtime Migrations (Quick Pattern)

**Adding a Column:**
1. Add nullable column
2. Deploy code that writes to new column
3. Backfill existing rows
4. Make column required (if needed)

**Renaming a Column:**
1. Add new column
2. Copy data
3. Deploy code that reads from new column
4. Drop old column

**For complete migration patterns:** See [references/migration-patterns.md](${CLAUDE_SKILL_DIR}/references/migration-patterns.md)

---

## Performance Optimization

### Query Optimization

```sql
-- Use EXPLAIN to analyze
EXPLAIN SELECT * FROM orders WHERE customer_id = 123;
```

**Look for:**
- **Type**: ALL (bad), index, ref (good)
- **Key**: Index actually used
- **Rows**: Estimated rows scanned

**Optimization techniques:**
- Add indexes on WHERE, ORDER BY, GROUP BY columns
- Avoid SELECT * (fetch only needed columns)
- Use LIMIT for pagination

### N+1 Query Problem

```python
# ❌ Bad: N+1 queries
orders = db.query("SELECT * FROM orders")
for order in orders:
    customer = db.query(f"SELECT * FROM customers WHERE id = {order.customer_id}")

# ✅ Good: Single query with JOIN
results = db.query("""
    SELECT orders.*, customers.name
    FROM orders
    JOIN customers ON orders.customer_id = customers.id
""")
```

**For complete optimization guide:** See [references/performance-tuning.md](${CLAUDE_SKILL_DIR}/references/performance-tuning.md)

---

## Quick Start Checklist

When designing a new schema:

- [ ] Identify entities and relationships
- [ ] Choose SQL or NoSQL based on requirements
- [ ] Normalize to 3NF (SQL) or decide embed/reference (NoSQL)
- [ ] Define primary keys (INT auto-increment or UUID)
- [ ] Add foreign key constraints
- [ ] Choose appropriate data types
- [ ] Add unique constraints where needed
- [ ] Plan indexing strategy (foreign keys, WHERE columns)
- [ ] Add NOT NULL constraints for required fields
- [ ] Create CHECK constraints for validation
- [ ] Plan for soft deletes (deleted_at column) if needed
- [ ] Add timestamps (created_at, updated_at)
- [ ] Design migration scripts (up and down)
- [ ] Test migrations on staging

---

## Detailed References

**For comprehensive database design patterns:**
- [Normalization Detailed](${CLAUDE_SKILL_DIR}/references/normalization-detailed.md) - Complete 1NF-3NF examples with explanations
- [Data Types Guide](${CLAUDE_SKILL_DIR}/references/data-types-guide.md) - Comprehensive data type selection
- [Indexing Strategies](${CLAUDE_SKILL_DIR}/references/indexing-strategies.md) - B-Tree, Hash, Full-Text, Partial indexes
- [NoSQL Patterns](${CLAUDE_SKILL_DIR}/references/nosql-patterns.md) - MongoDB embedding vs referencing, document design
- [Migration Patterns](${CLAUDE_SKILL_DIR}/references/migration-patterns.md) - Zero-downtime migrations, backward compatibility
- [Performance Tuning](${CLAUDE_SKILL_DIR}/references/performance-tuning.md) - Query optimization, EXPLAIN, N+1 queries

---

**Skill Version**: 2.0.0 (Optimized with Progressive Disclosure)
**Last Updated**: 2025-12-30
**Token Optimization**: 719 lines → 297 lines (59% reduction)
