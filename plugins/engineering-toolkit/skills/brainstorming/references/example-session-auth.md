# Example Session: Authentication Storage Design

This complete example demonstrates the brainstorming workflow for designing an authentication storage solution.

## Context

User request: "I need to add authentication to my web app but I'm not sure how to store the auth data."

## Phase 1: Understanding

### Question 1 (Clarification)
**Using AskUserQuestion tool:**

```
Question: "Where should the authentication data be stored?"
Header: "Storage Location"
Options:
  - "Session storage"
    Description: Clears on tab close, more secure, no cross-tab access
  - "Local storage"
    Description: Persists across sessions, more convenient, cross-tab access
  - "Cookies"
    Description: Works with SSR, compatible with older browsers, sent with requests
  - "Server-side session"
    Description: Most secure, requires backend session store, scales with infrastructure
```

**User selects:** "Cookies" (needs SSR compatibility)

### Question 2 (Constraints)
**Using AskUserQuestion tool:**

```
Question: "What's the primary security concern for this application?"
Header: "Security Level"
Options:
  - "Basic protection"
    Description: Standard security, public-facing app, low-risk data
  - "Enhanced security"
    Description: Financial data, user PII, requires CSRF protection
  - "Maximum security"
    Description: Healthcare/banking, requires encryption, audit logs
```

**User selects:** "Enhanced security" (handling user PII)

### Question 3 (Success Criteria)
**Open-ended:** "What would successful authentication look like for your users?"

**User response:** "Users stay logged in for 7 days, can log out from any device, get notified of new logins"

### Phase 1 Summary
- **Storage:** Cookies (for SSR compatibility)
- **Security:** Enhanced (CSRF protection, PII handling)
- **Requirements:** 7-day sessions, multi-device logout, login notifications

## Phase 1.5: Divergent Braindump

Quick idea generation based on Phase 1 findings (cookies, enhanced security, 7-day sessions, multi-device logout):

1. **JWT in httpOnly cookie** -- Stateless token, simple implementation (Testability: easy)
2. **Session ID + Redis** -- Server-side sessions, instant revocation (Testability: easy)
3. **JWT + Refresh Token** -- Short-lived access + long-lived refresh (Testability: medium)
4. **OAuth2 delegation** -- Offload to Auth0/Okta entirely (Testability: easy)
5. **Passkeys/WebAuthn** -- Passwordless, hardware-backed (Testability: hard)
6. **Magic links** -- Email-based, no passwords to store (Testability: medium)

"Any of these spark interest, or should I explore a different direction?"

**User response:** "Options 1-3 look most relevant for our use case. Skip 4-6."

Narrowing to 3 candidates for Phase 2 scoring.

## Phase 2: Exploration

### Proposed Approaches

**Using AskUserQuestion tool:**

```
Question: "Which authentication architecture should we use?"
Header: "Auth Architecture"
Options:
  - "JWT in httpOnly cookie"
    Description: Stateless, scales easily, can't revoke tokens early, 7-day expiry matches requirement
  - "Session ID with Redis"
    Description: Stateful, instant revocation, requires Redis infrastructure, supports multi-device logout
  - "JWT + Refresh Token"
    Description: Balanced, short-lived JWT (15min) + long refresh token, instant revocation of refresh, more complex
```

**Trade-off Discussion:**

**Scoring Matrix:**

| Approach | Feasibility | Complexity | Testability | Security | Fit | **Total** |
|----------|:-----------:|:----------:|:-----------:|:--------:|:---:|:---------:|
| JWT Only | 9 | 9 | 8 | 4 | 5 | **35/50** |
| Session+Redis | 7 | 6 | 8 | 8 | 9 | **38/50** |
| JWT+Refresh | 6 | 4 | 6 | 7 | 7 | **30/50** |

**Test strategies:**
- JWT Only: Unit test token generation/validation, integration test middleware
- Session+Redis: Unit test session CRUD, integration test Redis TTL + multi-device
- JWT+Refresh: Unit test both token types, integration test refresh flow + revocation

**User selects:** "Session ID with Redis" (needs instant revocation for multi-device logout)

## Phase 3: Design Presentation

### Section 1: Architecture Overview

**Present:**
```
Authentication Flow:
1. User logs in → Backend validates credentials
2. Backend creates session in Redis (7-day TTL)
3. Backend returns httpOnly cookie with session ID
4. Client sends cookie with each request
5. Backend validates session ID against Redis
6. On logout → Delete session from Redis

Session Structure in Redis:
{
  "user_id": "123",
  "created_at": "2024-01-15T10:30:00Z",
  "device_info": "Chrome/Mac",
  "last_active": "2024-01-15T10:35:00Z"
}
```

**Validate:** "Does this architecture handle your multi-device logout requirement?"

**User feedback:** "Yes, but how do we notify about new logins?"

### Section 2: Multi-Device Management

**Present:**
```
Session Management:
- Store all active sessions per user in Redis set: `user:123:sessions`
- Each login creates new session, adds to set
- On login, check if >3 sessions → send email notification
- Logout from one device → remove that session ID
- "Logout all devices" → delete entire session set

Notification Logic:
- On new session creation:
  1. Check if user has existing sessions
  2. If yes → trigger notification email/push
  3. Include: device info, IP, timestamp, "Not you?" link
```

**Validate:** "Does this notification approach work for your use case?"

**User feedback:** "Perfect, let's proceed"

### Section 3: Security Implementation

**Present:**
```
Security Measures:
1. httpOnly cookies (prevent XSS theft)
2. Secure flag (HTTPS only)
3. SameSite=Lax (CSRF protection)
4. 7-day max age, sliding window on activity
5. CSRF token in separate header for mutations
6. Rate limiting on login endpoint (5 attempts/15min)

Cookie Setup:
Set-Cookie: session_id=abc123;
  HttpOnly;
  Secure;
  SameSite=Lax;
  Max-Age=604800;
  Path=/
```

**Validate:** "Does this meet your enhanced security requirement?"

**User feedback:** "Yes, looks good"

## Final Design Summary

**Storage:** Session ID in httpOnly cookie
**Backend:** Redis for session storage (7-day TTL)
**Multi-device:** Session set per user, email notifications
**Security:** httpOnly + Secure + SameSite + CSRF tokens
**Logout:** Single-device and all-devices support

## Implementation Notes

- Use Redis with persistence (AOF or RDB)
- Consider session cleanup job for expired entries
- Monitor Redis memory usage
- Log all authentication events for audit

## Key Takeaways

1. **Cookie choice was validated early** (Phase 1) → No rework needed
2. **Trade-offs were explicit** (Phase 2) → User made informed choice
3. **Design was validated incrementally** (Phase 3) → Caught notification requirement early
4. **Security was specific** → Actual cookie configuration provided

This prevented a common pitfall: building JWT auth and realizing multi-device logout is impossible without a backend state store.
