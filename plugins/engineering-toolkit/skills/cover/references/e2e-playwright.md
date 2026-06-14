# E2E Testing with Playwright

## Table of Contents
- [Selector Strategy](#selector-strategy)
- [Page Object Model](#page-object-model)
- [Test Structure](#test-structure)
- [Agent-Browser Bridge](#agent-browser-bridge)
- [Visual Regression](#visual-regression)
- [Accessibility](#accessibility)
- [CI Configuration](#ci-configuration)

## Selector Strategy

Priority order (most stable to least):

1. **`data-testid`** — purpose-built, survives refactors
2. **`getByRole()`** — semantic, ensures accessibility
3. **`getByLabel()`** — form elements
4. **`getByText()`** — visible content (more brittle)

```typescript
// Preferred
await page.getByTestId('checkout-submit-btn').click();

// Good — semantic + accessible
await page.getByRole('button', { name: 'Submit Order' }).click();

// Acceptable — form elements
await page.getByLabel('Email address').fill('user@example.com');

// Avoid — coupled to implementation
await page.locator('.btn-primary.submit').click();
```

### Naming Convention for data-testid

Pattern: `{component}-{element}-{qualifier}`

```
checkout-submit-btn
login-email-input
activity-list-item-meditation    # list items use slug, never index
user-menu-dropdown
```

For dynamic list items, generate stable IDs from content:
```typescript
// Good: stable across reorders
data-testid={`activity-item-${activity.slug}`}

// Bad: breaks on reorder
data-testid={`activity-item-${index}`}
```

## Page Object Model

Encapsulate page interactions in reusable classes:

```typescript
// pages/checkout.page.ts
import { type Locator, type Page } from '@playwright/test';

export class CheckoutPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly submitButton: Locator;
  readonly successMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.getByTestId('checkout-email-input');
    this.submitButton = page.getByTestId('checkout-submit-btn');
    this.successMessage = page.getByTestId('checkout-success-msg');
  }

  async fillEmail(email: string) {
    await this.emailInput.fill(email);
  }

  async submit() {
    await this.submitButton.click();
  }

  async expectSuccess() {
    await expect(this.successMessage).toBeVisible();
  }
}
```

```typescript
// tests/checkout.spec.ts
import { test, expect } from '@playwright/test';
import { CheckoutPage } from '../pages/checkout.page';

test('complete checkout flow', async ({ page }) => {
  const checkout = new CheckoutPage(page);
  await page.goto('/checkout');
  await checkout.fillEmail('user@example.com');
  await checkout.submit();
  await checkout.expectSuccess();
});
```

## Test Structure

One file per user journey. Use `test.describe` for grouping related assertions:

```typescript
import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('successful login redirects to dashboard', async ({ page }) => {
    await page.getByLabel('Email').fill('user@example.com');
    await page.getByLabel('Password').fill('password123');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page).toHaveURL('/dashboard');
  });

  test('invalid credentials show error', async ({ page }) => {
    await page.getByLabel('Email').fill('wrong@example.com');
    await page.getByLabel('Password').fill('wrong');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page.getByTestId('login-error')).toContainText('Invalid credentials');
  });
});
```

## Agent-Browser Bridge

Use agent-browser to explore the app, then codify as Playwright:

### Exploration Phase

```bash
# Start exploring
agent-browser navigate http://localhost:3000/login
agent-browser snapshot

# Identify elements — note the refs (@e1, @e2, etc.)
# @e1 = email input, @e2 = password input, @e3 = submit button

# Walk through the flow
agent-browser type @e1 "user@example.com"
agent-browser type @e2 "password123"
agent-browser click @e3
agent-browser snapshot
# Now on dashboard — capture what's visible
```

### Translation to Playwright

Map agent-browser refs to Playwright locators:

| agent-browser | Playwright Equivalent |
|---------------|----------------------|
| `@e1` (email input) | `page.getByLabel('Email')` or `page.getByTestId('login-email')` |
| `click @e3` | `page.getByRole('button', { name: 'Sign In' }).click()` |
| `snapshot` after nav | `await expect(page).toHaveURL('/dashboard')` |
| `screenshot` | `await page.screenshot({ path: 'evidence.png' })` |

### When to Use Each

| Scenario | Tool |
|----------|------|
| Discovering the app, finding selectors | agent-browser |
| Recording a new user journey | agent-browser |
| Debugging a failing E2E test | agent-browser |
| Repeatable CI test suite | Playwright |
| Visual regression baselines | Playwright `toHaveScreenshot()` |

## Visual Regression

Use Playwright's built-in screenshot comparison:

```typescript
test('dashboard matches baseline', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page).toHaveScreenshot('dashboard.png', {
    maxDiffPixels: 100,
    mask: [page.getByTestId('timestamp')], // mask dynamic content
  });
});
```

Update baselines: `npx playwright test --update-snapshots`

## Accessibility

Integrate axe-core for WCAG 2.2 AA compliance:

```typescript
import AxeBuilder from '@axe-core/playwright';

test('checkout page is accessible', async ({ page }) => {
  await page.goto('/checkout');
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
```

## CI Configuration

```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run dev',
    port: 3000,
    reuseExistingServer: !process.env.CI,
  },
});
```

CI pipeline addition:

```yaml
e2e:
  stage: test
  script:
    - npx playwright install --with-deps
    - npx playwright test
  artifacts:
    when: always
    paths:
      - playwright-report/
      - test-results/
```
