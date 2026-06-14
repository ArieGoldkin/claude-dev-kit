-- Common Acme Platform Query Templates
-- Use these as starting points for common operations

-- =============================================================================
-- MEMBER QUERIES
-- =============================================================================

-- Get active members with subscriptions
SELECT m.id, m.email, m.first_name, m.last_name, s.plan_type, s.end_date
FROM acme_operational.members m
JOIN acme_operational.subscriptions s ON m.id = s.member_id
WHERE m.status = 'active'
  AND s.status = 'active'
  AND s.end_date > CURRENT_DATE
ORDER BY m.created_at DESC;

-- Find members by email pattern
SELECT id, email, first_name, last_name, created_at
FROM acme_operational.members
WHERE email ILIKE :email_pattern  -- e.g., '%@example.com'
ORDER BY created_at DESC
LIMIT 100;

-- Get member profile with latest activity
SELECT
    m.id,
    m.email,
    m.first_name,
    m.last_name,
    m.status,
    MAX(e.created_at) AS last_activity_at,
    COUNT(DISTINCT ma.activity_id) AS actions_started
FROM acme_operational.members m
LEFT JOIN acme_operational.events e ON m.id = e.member_id
LEFT JOIN acme_operational.member_activities ma ON m.id = ma.member_id
WHERE m.id = :member_id
GROUP BY m.id, m.email, m.first_name, m.last_name, m.status;

-- =============================================================================
-- SUBSCRIPTION QUERIES
-- =============================================================================

-- Find expiring subscriptions (next 30 days)
SELECT
    m.email,
    m.first_name,
    m.last_name,
    s.plan_type,
    s.end_date,
    s.auto_renew
FROM acme_operational.subscriptions s
JOIN acme_operational.members m ON s.member_id = m.id
WHERE s.status = 'active'
  AND s.end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
ORDER BY s.end_date ASC;

-- Subscription status breakdown
SELECT
    status,
    COUNT(*) AS count,
    COUNT(*) * 100.0 / SUM(COUNT(*)) OVER () AS percentage
FROM acme_operational.subscriptions
GROUP BY status
ORDER BY count DESC;

-- =============================================================================
-- PROGRESS TRACKING
-- =============================================================================

-- Member progress by focus area
SELECT
    fa.name AS focus_area,
    COUNT(DISTINCT ma.activity_id) AS actions_started,
    COUNT(ma.first_completion_at) AS actions_completed,
    ROUND(
        COUNT(ma.first_completion_at) * 100.0 / NULLIF(COUNT(DISTINCT ma.activity_id), 0),
        1
    ) AS completion_percentage
FROM acme_operational.member_activities ma
JOIN acme_operational.healthy_actions ha ON ma.activity_id = ha.id
JOIN acme_operational.focus_areas fa ON ha.focus_area_id = fa.id
WHERE ma.member_id = :member_id
GROUP BY fa.id, fa.name
ORDER BY completion_percentage DESC;

-- Most popular healthy actions
SELECT
    ha.title,
    fa.name AS focus_area,
    COUNT(DISTINCT ma.member_id) AS unique_members,
    COUNT(ma.first_completion_at) AS completions
FROM acme_operational.healthy_actions ha
JOIN acme_operational.focus_areas fa ON ha.focus_area_id = fa.id
LEFT JOIN acme_operational.member_activities ma ON ha.id = ma.activity_id
GROUP BY ha.id, ha.title, fa.name
ORDER BY unique_members DESC
LIMIT 20;

-- =============================================================================
-- COACH QUERIES
-- =============================================================================

-- Coach workload and capacity
SELECT
    c.id,
    c.first_name,
    c.last_name,
    c.max_members,
    COUNT(DISTINCT m.id) AS active_members,
    c.max_members - COUNT(DISTINCT m.id) AS available_capacity,
    COUNT(DISTINCT a.id) FILTER (
        WHERE a.status = 'scheduled' AND a.scheduled_at > CURRENT_TIMESTAMP
    ) AS upcoming_appointments
FROM acme_operational.coaches c
LEFT JOIN acme_operational.members m
    ON c.id = m.coach_id AND m.status = 'active'
LEFT JOIN acme_operational.appointments a
    ON c.id = a.coach_id
WHERE c.is_active = true
GROUP BY c.id, c.first_name, c.last_name, c.max_members
ORDER BY available_capacity DESC;

-- Coach notes summary for member
SELECT
    n.id,
    n.note_type,
    n.content,
    n.created_at,
    c.first_name AS coach_first_name,
    c.last_name AS coach_last_name
FROM acme_operational.notes n
JOIN acme_operational.coaches c ON n.coach_id = c.id
WHERE n.member_id = :member_id
ORDER BY n.created_at DESC
LIMIT 10;

-- =============================================================================
-- EVENTS AND ANALYTICS
-- =============================================================================

-- Member engagement timeline (last 30 days)
SELECT
    DATE_TRUNC('day', created_at) AS date,
    event_type,
    COUNT(*) AS event_count
FROM acme_operational.events
WHERE member_id = :member_id
  AND created_at > CURRENT_DATE - INTERVAL '30 days'
GROUP BY date, event_type
ORDER BY date DESC, event_count DESC;

-- Daily active members
SELECT
    DATE(created_at) AS date,
    COUNT(DISTINCT member_id) AS unique_members
FROM acme_operational.events
WHERE event_type = 'login'
  AND created_at > CURRENT_DATE - INTERVAL '30 days'
GROUP BY date
ORDER BY date DESC;

-- Event type distribution
SELECT
    event_type,
    COUNT(*) AS count,
    COUNT(DISTINCT member_id) AS unique_members,
    MIN(created_at) AS first_occurrence,
    MAX(created_at) AS last_occurrence
FROM acme_operational.events
WHERE created_at > CURRENT_DATE - INTERVAL '7 days'
GROUP BY event_type
ORDER BY count DESC;

-- =============================================================================
-- APPOINTMENTS
-- =============================================================================

-- Upcoming appointments for a coach
SELECT
    a.id,
    a.scheduled_at,
    a.duration,
    m.first_name AS member_first_name,
    m.last_name AS member_last_name,
    m.email AS member_email,
    a.meeting_link
FROM acme_operational.appointments a
JOIN acme_operational.members m ON a.member_id = m.id
WHERE a.coach_id = :coach_id
  AND a.status = 'scheduled'
  AND a.scheduled_at > CURRENT_TIMESTAMP
ORDER BY a.scheduled_at ASC;

-- Appointment completion rate by coach
SELECT
    c.first_name,
    c.last_name,
    COUNT(*) AS total_appointments,
    COUNT(*) FILTER (WHERE a.status = 'completed') AS completed,
    COUNT(*) FILTER (WHERE a.status = 'no-show') AS no_shows,
    ROUND(
        COUNT(*) FILTER (WHERE a.status = 'completed') * 100.0 / COUNT(*),
        1
    ) AS completion_rate
FROM acme_operational.appointments a
JOIN acme_operational.coaches c ON a.coach_id = c.id
WHERE a.scheduled_at > CURRENT_DATE - INTERVAL '90 days'
GROUP BY c.id, c.first_name, c.last_name
ORDER BY completion_rate DESC;

-- =============================================================================
-- DATA QUALITY CHECKS
-- =============================================================================

-- Find members without subscriptions
SELECT m.id, m.email, m.status, m.created_at
FROM acme_operational.members m
LEFT JOIN acme_operational.subscriptions s ON m.id = s.member_id
WHERE s.id IS NULL;

-- Find orphaned records (member_activities without members)
SELECT ma.id, ma.member_id, ma.activity_id
FROM acme_operational.member_activities ma
LEFT JOIN acme_operational.members m ON ma.member_id = m.id
WHERE m.id IS NULL;

-- Detect duplicate emails
SELECT email, COUNT(*) AS count
FROM acme_operational.members
GROUP BY email
HAVING COUNT(*) > 1;

-- =============================================================================
-- PERFORMANCE QUERIES
-- =============================================================================

-- Table sizes
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
    pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS table_size,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) AS indexes_size
FROM pg_tables
WHERE schemaname = 'acme_operational'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Index usage statistics
SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
WHERE schemaname = 'acme_operational'
ORDER BY idx_scan DESC;
