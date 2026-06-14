# Saved Test Flows

## Table of Contents
- [Overview](#overview)
- [Directory Convention](#directory-convention)
- [YAML Schema](#yaml-schema)
- [Selector Fallback Strategy](#selector-fallback-strategy)
- [Variable Substitution](#variable-substitution)
- [Conditional Steps](#conditional-steps)
- [Flow Composition](#flow-composition)
- [Example Flows](#example-flows)
  - [Login Flow](#login-flow)
  - [Checkout Flow](#checkout-flow)
  - [Contact Form Flow](#contact-form-flow)
- [Troubleshooting](#troubleshooting)

## Overview

Saved test flows are reusable YAML definitions that describe user journeys through an application. They serve as the bridge between manual E2E exploration (via agent-browser) and repeatable Playwright test suites.

Use saved flows when:
- The same user journey (login, checkout, onboarding) appears across multiple test suites
- You want to version-control critical paths alongside application code
- The `/cover --tier=e2e` skill needs a pre-defined flow instead of live exploration
- New team members need a catalog of testable user journeys

A saved flow captures **what** to do (navigate, fill, click, assert) without coupling to a specific test framework. The `/cover` skill reads these flows and generates Playwright tests from them.

## Directory Convention

Store flows in `.cover/flows/` at the project root:

```
project-root/
├── .cover/
│   └── flows/
│       ├── login.yaml
│       ├── checkout.yaml
│       ├── contact-form.yaml
│       └── admin/
│           ├── user-management.yaml
│           └── settings.yaml
├── src/
└── tests/
```

- One YAML file per user journey
- Subdirectories for grouping related flows (e.g., `admin/`, `onboarding/`)
- File name becomes the flow identifier (e.g., `login`, `admin/user-management`)

## YAML Schema

### Top-Level Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Human-readable flow name |
| `description` | string | Yes | What this flow tests and why it matters |
| `url` | string | Yes | Starting URL (can use variable substitution) |
| `env` | object | No | Required environment variables with descriptions |
| `setup` | string | No | Name of another flow to run first (see [Flow Composition](#flow-composition)) |
| `steps` | list | Yes | Ordered list of step objects |

### Step Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `action` | string | Yes | One of: `navigate`, `fill`, `click`, `select`, `assert`, `wait` |
| `selector` | string | Conditional | Primary CSS or `data-testid` selector (required for `fill`, `click`, `select`, `assert`) |
| `fallback_role` | string | No | ARIA role for `getByRole()` fallback (e.g., `button`, `textbox`, `link`) |
| `fallback_label` | string | No | Label text for `getByLabel()` fallback |
| `value` | string | Conditional | Input value for `fill` and `select` actions |
| `expected` | string | Conditional | Expected content for `assert` action |
| `timeout` | number | No | Custom timeout in milliseconds (default: 5000) |
| `when` | string | No | Conditional expression — step runs only if truthy (see [Conditional Steps](#conditional-steps)) |
| `description` | string | No | Human-readable description of this step |

### Action Types

| Action | Required Fields | Behavior |
|--------|----------------|----------|
| `navigate` | `value` (URL) | Navigate the browser to the given URL |
| `fill` | `selector`, `value` | Clear the field and type the value |
| `click` | `selector` | Click the element |
| `select` | `selector`, `value` | Select an option from a dropdown |
| `assert` | `selector`, `expected` | Assert element contains expected text or is visible |
| `wait` | `selector` or `timeout` | Wait for element to appear, or pause for `timeout` ms |

### Minimal Example

```yaml
name: Login
description: Standard email/password authentication flow
url: ${BASE_URL}/login
env:
  BASE_URL: Application base URL (e.g., http://localhost:3000)
  TEST_USER_EMAIL: Test account email
  TEST_USER_PASSWORD: Test account password
steps:
  - action: fill
    selector: '[data-testid="login-email-input"]'
    fallback_role: textbox
    fallback_label: Email
    value: ${from_env:TEST_USER_EMAIL}

  - action: fill
    selector: '[data-testid="login-password-input"]'
    fallback_label: Password
    value: ${from_env:TEST_USER_PASSWORD}

  - action: click
    selector: '[data-testid="login-submit-btn"]'
    fallback_role: button
    fallback_label: Sign In

  - action: assert
    selector: '[data-testid="dashboard-welcome-msg"]'
    expected: Welcome
    timeout: 10000
```

## Selector Fallback Strategy

Each step can define up to three selectors. The generated Playwright test tries them in order:

```
1. selector (primary)     →  page.locator('[data-testid="login-email-input"]')
2. fallback_role          →  page.getByRole('textbox', { name: /email/i })
3. fallback_label         →  page.getByLabel('Email')
4. heal (automatic)       →  agent-browser snapshot + re-discover
```

### How Fallback Works in Generated Code

```typescript
// Generated from a step with all three selectors defined
async function resolveLocator(page: Page) {
  const primary = page.locator('[data-testid="login-email-input"]');
  if (await primary.isVisible({ timeout: 2000 }).catch(() => false)) {
    return primary;
  }

  const byRole = page.getByRole('textbox', { name: /email/i });
  if (await byRole.isVisible({ timeout: 2000 }).catch(() => false)) {
    return byRole;
  }

  const byLabel = page.getByLabel('Email');
  if (await byLabel.isVisible({ timeout: 2000 }).catch(() => false)) {
    return byLabel;
  }

  throw new Error('All selectors failed for step: fill email');
}
```

### Heal Phase Integration

When all three selectors fail during the heal loop (Phase 5), the `/cover` skill:

1. Runs `agent-browser snapshot` to capture current page state
2. Searches for the element by semantic meaning (description, nearby text)
3. Updates the flow YAML with the new working selector
4. Re-runs the failing test

This keeps saved flows self-healing across UI refactors.

## Variable Substitution

Three substitution patterns are supported in `url` and `value` fields:

| Pattern | Resolves To | Example |
|---------|------------|---------|
| `${VAR}` | Flow-level variable or env var | `${BASE_URL}/login` |
| `${from_env:VAR}` | Environment variable (fails if missing) | `${from_env:TEST_USER_EMAIL}` |
| `${from_env:VAR:default}` | Environment variable with default | `${from_env:API_PORT:3000}` |

### Resolution Order

1. Variables defined in the flow's `env` block
2. Process environment variables (`process.env`)
3. Default value (if `:default` syntax used)
4. Error (if no default and variable is missing)

### Examples

```yaml
url: ${from_env:BASE_URL:http://localhost:3000}/checkout

steps:
  - action: fill
    selector: '[data-testid="checkout-email-input"]'
    value: ${from_env:TEST_USER_EMAIL}

  - action: fill
    selector: '[data-testid="checkout-card-number"]'
    value: ${from_env:TEST_CARD_NUMBER:4242424242424242}
```

## Conditional Steps

Use `when:` to skip steps based on environment or context:

```yaml
steps:
  - action: click
    selector: '[data-testid="cookie-accept-btn"]'
    when: env.COOKIE_BANNER_ENABLED
    description: Dismiss cookie banner if enabled

  - action: click
    selector: '[data-testid="mfa-skip-btn"]'
    when: env.SKIP_MFA
    description: Skip MFA prompt in test environments
```

### Supported Expressions

| Expression | Truthy When |
|-----------|------------|
| `env.VAR_NAME` | Environment variable is set and non-empty |
| `!env.VAR_NAME` | Environment variable is unset or empty |
| `env.VAR_NAME == "value"` | Environment variable equals the literal string |
| `env.VAR_NAME != "value"` | Environment variable does not equal the literal string |

Conditional steps that evaluate to falsy are logged as skipped in the test output but do not cause failures.

## Flow Composition

Complex journeys often share a common prefix (e.g., login). Use the `setup` field to reference another flow:

```yaml
# .cover/flows/checkout.yaml
name: Checkout
description: Complete purchase flow (requires authentication)
url: ${from_env:BASE_URL:http://localhost:3000}/products
setup: login
steps:
  - action: click
    selector: '[data-testid="product-item-wireless-headphones"]'
    description: Select a product
  # ... rest of checkout steps
```

### Composition Rules

- `setup` references a flow by filename (without `.yaml` extension)
- The setup flow runs completely before the current flow's steps begin
- Setup flows can themselves reference other setup flows (max depth: 3)
- If the setup flow fails, the dependent flow is skipped with an error

### Nested Example

```
login.yaml          ← standalone, no setup
checkout.yaml       ← setup: login
checkout-guest.yaml ← no setup (guest checkout has its own auth)
refund.yaml         ← setup: checkout (login -> checkout -> refund)
```

## Example Flows

### Login Flow

```yaml
# .cover/flows/login.yaml
name: Login
description: Authenticate with email and password, verify dashboard landing
url: ${from_env:BASE_URL:http://localhost:3000}/login
env:
  BASE_URL: Application base URL
  TEST_USER_EMAIL: Valid test account email address
  TEST_USER_PASSWORD: Password for test account
steps:
  - action: click
    selector: '[data-testid="cookie-accept-btn"]'
    when: env.COOKIE_BANNER_ENABLED
    description: Dismiss cookie consent banner

  - action: fill
    selector: '[data-testid="login-email-input"]'
    fallback_role: textbox
    fallback_label: Email address
    value: ${from_env:TEST_USER_EMAIL}
    description: Enter email

  - action: fill
    selector: '[data-testid="login-password-input"]'
    fallback_label: Password
    value: ${from_env:TEST_USER_PASSWORD}
    description: Enter password

  - action: click
    selector: '[data-testid="login-submit-btn"]'
    fallback_role: button
    fallback_label: Sign In
    description: Submit credentials

  - action: wait
    selector: '[data-testid="dashboard-welcome-msg"]'
    timeout: 10000
    description: Wait for dashboard to load

  - action: assert
    selector: '[data-testid="dashboard-welcome-msg"]'
    expected: Welcome
    description: Verify welcome message is displayed

  - action: assert
    selector: '[data-testid="user-avatar"]'
    expected: visible
    description: Verify user avatar appears in header
```

### Checkout Flow

```yaml
# .cover/flows/checkout.yaml
name: Checkout
description: Multi-step purchase flow — product selection, cart, shipping, payment, confirmation
url: ${from_env:BASE_URL:http://localhost:3000}/products
setup: login
env:
  BASE_URL: Application base URL
  TEST_CARD_NUMBER: Stripe test card number
  TEST_CARD_EXPIRY: Card expiry (MM/YY format)
  TEST_CARD_CVC: Card CVC code
steps:
  # Step 1: Select product
  - action: click
    selector: '[data-testid="product-item-wireless-headphones"]'
    description: Click on product card

  - action: click
    selector: '[data-testid="product-add-to-cart-btn"]'
    fallback_role: button
    fallback_label: Add to Cart
    description: Add product to cart

  - action: assert
    selector: '[data-testid="cart-badge-count"]'
    expected: "1"
    description: Verify cart shows 1 item

  # Step 2: Open cart and proceed
  - action: click
    selector: '[data-testid="header-cart-btn"]'
    fallback_role: link
    fallback_label: Cart
    description: Open cart

  - action: assert
    selector: '[data-testid="cart-item-wireless-headphones"]'
    expected: Wireless Headphones
    description: Verify product in cart

  - action: click
    selector: '[data-testid="cart-checkout-btn"]'
    fallback_role: button
    fallback_label: Proceed to Checkout
    description: Go to checkout

  # Step 3: Shipping information
  - action: fill
    selector: '[data-testid="shipping-address-input"]'
    fallback_label: Street Address
    value: 123 Test Street
    description: Enter street address

  - action: fill
    selector: '[data-testid="shipping-city-input"]'
    fallback_label: City
    value: San Francisco
    description: Enter city

  - action: select
    selector: '[data-testid="shipping-state-select"]'
    fallback_label: State
    value: CA
    description: Select state

  - action: fill
    selector: '[data-testid="shipping-zip-input"]'
    fallback_label: ZIP Code
    value: "94102"
    description: Enter ZIP code

  - action: click
    selector: '[data-testid="shipping-continue-btn"]'
    fallback_role: button
    fallback_label: Continue to Payment
    description: Proceed to payment step

  # Step 4: Payment
  - action: fill
    selector: '[data-testid="payment-card-number-input"]'
    fallback_label: Card Number
    value: ${from_env:TEST_CARD_NUMBER:4242424242424242}
    description: Enter card number

  - action: fill
    selector: '[data-testid="payment-card-expiry-input"]'
    fallback_label: Expiration
    value: ${from_env:TEST_CARD_EXPIRY:12/28}
    description: Enter card expiry

  - action: fill
    selector: '[data-testid="payment-card-cvc-input"]'
    fallback_label: CVC
    value: ${from_env:TEST_CARD_CVC:123}
    description: Enter CVC

  - action: click
    selector: '[data-testid="payment-submit-btn"]'
    fallback_role: button
    fallback_label: Place Order
    description: Submit payment

  # Step 5: Confirmation
  - action: wait
    selector: '[data-testid="order-confirmation-msg"]'
    timeout: 15000
    description: Wait for order processing

  - action: assert
    selector: '[data-testid="order-confirmation-msg"]'
    expected: Order Confirmed
    description: Verify order confirmation message

  - action: assert
    selector: '[data-testid="order-number"]'
    expected: visible
    description: Verify order number is displayed
```

### Contact Form Flow

```yaml
# .cover/flows/contact-form.yaml
name: Contact Form Submission
description: Fill and submit the contact form with validation checks
url: ${from_env:BASE_URL:http://localhost:3000}/contact
env:
  BASE_URL: Application base URL
steps:
  # Test client-side validation first
  - action: click
    selector: '[data-testid="contact-submit-btn"]'
    fallback_role: button
    fallback_label: Send Message
    description: Submit empty form to trigger validation

  - action: assert
    selector: '[data-testid="contact-name-error"]'
    expected: Name is required
    description: Verify name validation error

  - action: assert
    selector: '[data-testid="contact-email-error"]'
    expected: Email is required
    description: Verify email validation error

  # Fill with invalid email
  - action: fill
    selector: '[data-testid="contact-name-input"]'
    fallback_label: Full Name
    value: Jane Doe
    description: Enter name

  - action: fill
    selector: '[data-testid="contact-email-input"]'
    fallback_role: textbox
    fallback_label: Email Address
    value: not-an-email
    description: Enter invalid email to test format validation

  - action: click
    selector: '[data-testid="contact-submit-btn"]'
    fallback_role: button
    fallback_label: Send Message
    description: Submit with invalid email

  - action: assert
    selector: '[data-testid="contact-email-error"]'
    expected: valid email
    description: Verify email format validation error

  # Fill correctly and submit
  - action: fill
    selector: '[data-testid="contact-email-input"]'
    fallback_role: textbox
    fallback_label: Email Address
    value: jane.doe@example.com
    description: Enter valid email

  - action: fill
    selector: '[data-testid="contact-phone-input"]'
    fallback_label: Phone Number
    value: "+1 (555) 123-4567"
    description: Enter phone number (optional field)

  - action: select
    selector: '[data-testid="contact-subject-select"]'
    fallback_label: Subject
    value: support
    description: Select subject category

  - action: fill
    selector: '[data-testid="contact-message-input"]'
    fallback_label: Message
    value: I need help with my recent order. The tracking number does not seem to work.
    description: Enter message body

  - action: click
    selector: '[data-testid="contact-terms-checkbox"]'
    fallback_role: checkbox
    fallback_label: I agree to the terms
    description: Accept terms and conditions

  - action: click
    selector: '[data-testid="contact-submit-btn"]'
    fallback_role: button
    fallback_label: Send Message
    description: Submit completed form

  - action: wait
    selector: '[data-testid="contact-success-msg"]'
    timeout: 10000
    description: Wait for submission confirmation

  - action: assert
    selector: '[data-testid="contact-success-msg"]'
    expected: Thank you
    description: Verify success message

  - action: assert
    selector: '[data-testid="contact-reference-number"]'
    expected: visible
    description: Verify reference number is shown
```

## Troubleshooting

### Missing Environment Variables

**Symptom**: Test fails with `Variable not found: TEST_USER_EMAIL`

**Cause**: A `${from_env:VAR}` reference has no matching environment variable and no default.

**Fix**: Either set the variable before running tests or add a default:

```bash
# Option 1: Set in .env or shell
export TEST_USER_EMAIL=test@example.com

# Option 2: Add a default in the flow
value: ${from_env:TEST_USER_EMAIL:test@example.com}
```

Check which variables a flow requires by reading its `env` block.

### Stale Selectors

**Symptom**: `Element not found` for a `data-testid` that previously worked.

**Cause**: A UI refactor changed or removed the `data-testid` attribute.

**Fix**:

1. Run `agent-browser navigate <url>` and `agent-browser snapshot` to inspect current page state
2. Find the new selector for the target element
3. Update the flow YAML `selector` field
4. If the element was removed entirely, the flow step may need to be removed or replaced

The heal loop (Phase 5) handles this automatically during `/cover --tier=e2e` execution, but you may need to update flows manually if the UI changed significantly.

### Flow Not Found

**Symptom**: `/cover --tier=e2e --flow=checkout` fails with `Flow not found: checkout`

**Cause**: The flow file does not exist at the expected path.

**Fix**: Verify the file exists:

```bash
ls .cover/flows/checkout.yaml
```

Common mistakes:
- File is in wrong directory (e.g., `flows/` instead of `.cover/flows/`)
- File extension is `.yml` instead of `.yaml` (use `.yaml` consistently)
- Flow is in a subdirectory but referenced without the prefix (use `admin/settings`, not `settings`)

### Setup Flow Failures

**Symptom**: Flow skipped with `Setup flow 'login' failed`

**Cause**: The referenced setup flow encountered an error during execution.

**Fix**:

1. Run the setup flow independently: `/cover --tier=e2e --flow=login`
2. Fix any failures in the setup flow first
3. Re-run the dependent flow

### Circular Setup References

**Symptom**: `Maximum setup depth (3) exceeded`

**Cause**: Flow A references flow B as setup, and flow B references flow A (or the chain exceeds 3 levels).

**Fix**: Restructure flows so setup chains are linear and shallow:

```
login.yaml              ← no setup (depth 0)
checkout.yaml           ← setup: login (depth 1)
refund.yaml             ← setup: checkout (depth 2, max recommended)
```

Keep setup chains to a maximum of 2-3 levels. If you need deeper composition, extract shared steps into a dedicated setup flow.
