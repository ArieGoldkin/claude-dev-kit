# Cognitive Load Principles and Ethical Design

Laws of UX with enforceable thresholds and code examples, plus a dark pattern detection checklist for DSA Article 25 compliance.

---

## Table of Contents

- [Miller's Law](#millers-law)
- [Hick's Law](#hicks-law)
- [Doherty Threshold](#doherty-threshold)
- [Fitts's Law](#fittss-law)
- [Cognitive Load Quick Reference](#cognitive-load-quick-reference)
- [Dark Pattern Detection](#dark-pattern-detection)
- [Dark Pattern Checklist](#dark-pattern-checklist)
- [DSA Article 25 Compliance](#dsa-article-25-compliance)

---

## Miller's Law

**The average person can hold 7 (plus or minus 2) items in working memory.**

This does not mean "always use 7 items." It means ungrouped lists of more than 5--9 items overwhelm short-term memory. Group, chunk, or progressively disclose to stay within limits.

### Enforceable Rules

- Navigation menus: maximum 7 top-level items. Use dropdowns or mega-menus for additional items.
- Form fields per visible step: maximum 5--7 fields before requiring a "next step" or collapsible section.
- Dashboard widgets: maximum 5--7 cards visible without scrolling. Group related metrics.
- Select dropdowns: if more than 7 options, add search/filter or group with optgroups.

### Code Example: Chunked Navigation

```tsx
interface NavItem {
  label: string;
  href: string;
  children?: NavItem[];
}

/**
 * Enforces Miller's Law: throws at build time if top-level
 * navigation exceeds the cognitive limit.
 */
function validateNavigation(items: NavItem[], maxTopLevel: number = 7): void {
  if (items.length > maxTopLevel) {
    throw new Error(
      `Navigation has ${items.length} top-level items (max ${maxTopLevel}). ` +
      `Group related items into dropdowns to reduce cognitive load.`
    );
  }
}

function PrimaryNav({ items }: { items: NavItem[] }) {
  // Validate during development
  if (process.env.NODE_ENV === "development") {
    validateNavigation(items);
  }

  return (
    <nav aria-label="Primary navigation">
      <ul className="flex items-center gap-1" role="list">
        {items.map((item) => (
          <li key={item.href}>
            {item.children ? (
              <NavDropdown item={item} />
            ) : (
              <a
                href={item.href}
                className="rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                {item.label}
              </a>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}
```

### Code Example: Grouped Select with Search

```tsx
import { useState, useMemo } from "react";

interface Option {
  value: string;
  label: string;
  group?: string;
}

function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Select...",
}: {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  const filtered = useMemo(
    () =>
      options.filter((o) =>
        o.label.toLowerCase().includes(search.toLowerCase())
      ),
    [options, search]
  );

  const grouped = useMemo(() => {
    const groups = new Map<string, Option[]>();
    for (const opt of filtered) {
      const key = opt.group ?? "";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(opt);
    }
    return groups;
  }, [filtered]);

  const shouldSearch = options.length > 7;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="flex w-full items-center justify-between rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <span className={value ? "text-gray-900 dark:text-gray-100" : "text-gray-400"}>
          {options.find((o) => o.value === value)?.label ?? placeholder}
        </span>
        <ChevronDownIcon className="h-4 w-4 text-gray-400" />
      </button>

      {open && (
        <div className="absolute z-10 mt-1 w-full rounded-md border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900">
          {shouldSearch && (
            <div className="border-b border-gray-200 p-2 dark:border-gray-700">
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                className="w-full rounded border-0 bg-gray-50 px-2 py-1.5 text-sm dark:bg-gray-800 focus-visible:outline-2 focus-visible:outline-offset-2"
                aria-label="Search options"
                autoFocus
              />
            </div>
          )}
          <ul role="listbox" className="max-h-60 overflow-y-auto py-1">
            {[...grouped.entries()].map(([group, opts]) => (
              <li key={group} role="group" aria-label={group || undefined}>
                {group && (
                  <span className="block px-3 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    {group}
                  </span>
                )}
                {opts.map((opt) => (
                  <button
                    key={opt.value}
                    role="option"
                    aria-selected={opt.value === value}
                    onClick={() => {
                      onChange(opt.value);
                      setOpen(false);
                      setSearch("");
                    }}
                    className={`flex w-full items-center px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 ${
                      opt.value === value
                        ? "font-medium text-gray-900 dark:text-gray-100"
                        : "text-gray-600 dark:text-gray-400"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
```

---

## Hick's Law

**The time to make a decision increases logarithmically with the number and complexity of choices.**

`Decision time = a + b * log2(n)` where `n` is the number of equally probable choices.

### Enforceable Rules

- At any single decision point, present no more than 7 options without grouping, search, or filtering.
- For pricing pages: maximum 3--4 plan tiers.
- For action buttons: 1 primary action, at most 2 secondary actions per context.
- For settings pages: group related settings under collapsible categories.

### Code Example: Action Button Constraint

```tsx
interface Action {
  label: string;
  onClick: () => void;
  variant: "primary" | "secondary" | "tertiary";
}

/**
 * Validates Hick's Law for action groups.
 * Maximum 1 primary, 2 secondary actions visible at once.
 */
function ActionBar({ actions }: { actions: Action[] }) {
  const primary = actions.filter((a) => a.variant === "primary");
  const secondary = actions.filter((a) => a.variant === "secondary");

  if (process.env.NODE_ENV === "development") {
    if (primary.length > 1) {
      console.warn(
        "[Hick's Law] Multiple primary actions detected. " +
        "Users cannot distinguish the main action when multiple CTAs compete."
      );
    }
    if (secondary.length > 2) {
      console.warn(
        "[Hick's Law] More than 2 secondary actions. " +
        "Consider moving extras into an overflow menu."
      );
    }
  }

  const visible = [...primary, ...secondary.slice(0, 2)];
  const overflow = [...secondary.slice(2), ...actions.filter((a) => a.variant === "tertiary")];

  return (
    <div className="flex items-center gap-2">
      {visible.map((action) => (
        <button
          key={action.label}
          onClick={action.onClick}
          className={
            action.variant === "primary"
              ? "rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200 focus-visible:outline-2 focus-visible:outline-offset-2"
              : "rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800 focus-visible:outline-2 focus-visible:outline-offset-2"
          }
        >
          {action.label}
        </button>
      ))}
      {overflow.length > 0 && (
        <OverflowMenu actions={overflow} />
      )}
    </div>
  );
}
```

---

## Doherty Threshold

**Productivity soars when a computer and its users interact at a pace (<400ms) that ensures neither has to wait on the other.**

If the system does not respond within 400ms, users perceive it as slow and lose flow state. Under 100ms feels instantaneous.

### Enforceable Rules

- All button clicks must produce visible feedback within 100ms (state change, animation, or loading indicator).
- All navigation transitions must begin within 400ms (skeleton screen, page transition animation).
- If a server response takes longer than 400ms, show a loading state immediately -- do not wait for the response to decide whether to show loading.
- Use optimistic UI for write operations to provide sub-100ms feedback.

### Code Example: Loading Threshold Hook

```tsx
import { useState, useEffect, useRef } from "react";

/**
 * Returns `true` if the operation has been pending for longer
 * than `delayMs`. Use to show loading states only when the
 * Doherty threshold is exceeded.
 *
 * For operations expected to be fast, this avoids flashing
 * a loading indicator for sub-200ms responses while still
 * showing one if the response is slow.
 */
function useDelayedLoading(isPending: boolean, delayMs: number = 200): boolean {
  const [showLoading, setShowLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (isPending) {
      timerRef.current = setTimeout(() => setShowLoading(true), delayMs);
    } else {
      clearTimeout(timerRef.current);
      setShowLoading(false);
    }
    return () => clearTimeout(timerRef.current);
  }, [isPending, delayMs]);

  return showLoading;
}

// Usage
function SubmitButton({ isPending, onClick }: {
  isPending: boolean;
  onClick: () => void;
}) {
  const showSpinner = useDelayedLoading(isPending, 200);

  return (
    <button
      onClick={onClick}
      disabled={isPending}
      className="relative rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-70 dark:bg-gray-100 dark:text-gray-900 focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      {showSpinner && (
        <span className="absolute inset-0 flex items-center justify-center">
          <LoaderIcon className="h-4 w-4 animate-spin" />
        </span>
      )}
      <span className={showSpinner ? "invisible" : ""}>{isPending ? "Saving..." : "Save"}</span>
    </button>
  );
}
```

### Code Example: Performance Budget Monitor

```tsx
/**
 * Logs a warning when any user-initiated action exceeds the
 * Doherty threshold. Use in development to catch slow interactions.
 */
function useDohertMonitor(label: string) {
  const startRef = useRef<number>();

  const start = () => {
    startRef.current = performance.now();
  };

  const end = () => {
    if (startRef.current === undefined) return;
    const elapsed = performance.now() - startRef.current;
    if (elapsed > 400) {
      console.warn(
        `[Doherty] "${label}" took ${elapsed.toFixed(0)}ms — exceeds 400ms threshold. ` +
        `Add a loading indicator or optimize the operation.`
      );
    }
    startRef.current = undefined;
  };

  return { start, end };
}
```

---

## Fitts's Law

**The time to reach a target is a function of the distance to the target divided by its size.**

`Movement time = a + b * log2(distance / width + 1)`

Larger targets closer to the cursor are faster to reach.

### Enforceable Rules

- Primary action buttons: minimum 44x44px touch target (WCAG 2.5.8), minimum 32px on desktop.
- Destructive actions must NOT be placed adjacent to primary actions without spacing (minimum 16px gap).
- Mobile: Place primary actions in the thumb zone (bottom of screen).
- Expand clickable area with padding, not just visual size -- use Tailwind's `p-*` or negative margins.

### Code Example: Touch Target Enforcement

```tsx
/**
 * Wrapper that enforces minimum touch target size via CSS.
 * Expands the clickable area without changing visual size.
 */
function TouchTarget({ children }: { children: React.ReactNode }) {
  return (
    <span className="relative inline-flex">
      {children}
      {/* Invisible expanded touch area */}
      <span
        className="absolute -inset-2 z-10"
        aria-hidden="true"
      />
    </span>
  );
}

// Usage: small icon button with adequate touch target
function IconButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="relative rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-300 focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      <Icon className="h-5 w-5" />
      {/* Ensures minimum 44x44px touch target */}
      <span className="absolute -inset-1.5" aria-hidden="true" />
    </button>
  );
}
```

### Code Example: Action Button Spacing Validator

```tsx
/**
 * Development-time validation: warns if a destructive button
 * is placed too close to a primary action button.
 */
function ActionGroup({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development" || !ref.current) return;

    const buttons = ref.current.querySelectorAll("button");
    const rects = Array.from(buttons).map((btn) => ({
      el: btn,
      rect: btn.getBoundingClientRect(),
      isDanger: btn.dataset.variant === "danger" || btn.classList.contains("bg-red-600"),
    }));

    for (const danger of rects.filter((r) => r.isDanger)) {
      for (const other of rects.filter((r) => !r.isDanger)) {
        const gap = Math.abs(danger.rect.left - other.rect.right);
        const gapRight = Math.abs(other.rect.left - danger.rect.right);
        const minGap = Math.min(gap, gapRight);
        if (minGap < 16) {
          console.warn(
            `[Fitts's Law] Destructive button "${danger.el.textContent}" is only ` +
            `${minGap.toFixed(0)}px from "${other.el.textContent}". ` +
            `Minimum 16px gap required to prevent accidental clicks.`
          );
        }
      }
    }
  }, []);

  return (
    <div ref={ref} className="flex items-center gap-3">
      {children}
    </div>
  );
}
```

---

## Cognitive Load Quick Reference

| Law | Threshold | Rule | Enforcement |
|---|---|---|---|
| Miller's Law | 7 plus/minus 2 | Max 7 ungrouped items at a decision point | Dev-time validation, linting |
| Hick's Law | log2(n) decision time | Max 1 primary + 2 secondary actions visible | Component constraint, overflow menu |
| Doherty Threshold | 400ms | Visual feedback within 400ms for all actions | Performance monitor, delayed loading hook |
| Fitts's Law | distance/size ratio | 44px min touch target, 16px gap for destructive actions | CSS enforcement, spacing validator |

---

## Dark Pattern Detection

Dark patterns are deceptive UX practices that trick users into actions they did not intend. The EU Digital Services Act (DSA) Article 25 explicitly prohibits dark patterns on platforms.

### Categories

#### 1. Confirmshaming

Guilting users into accepting by making the decline option emotionally manipulative.

**Bad:**
```
[ Start Free Trial ]
[ No thanks, I don't care about my health ]
```

**Good:**
```
[ Start Free Trial ]
[ No thanks ]
```

**Rule:** Decline options must use neutral, factual language. No emotional manipulation, no first-person guilt phrases.

#### 2. Roach Motels

Making it easy to get into a situation (subscription, account) but deliberately hard to get out.

**Signs:**
- Sign up in 1 click, cancellation requires calling a phone number.
- Unsubscribe buried 4+ levels deep in settings.
- "Are you sure?" followed by multiple retention screens.

**Rule:** The effort to reverse an action must be proportional to the effort to take it. If sign-up is 2 clicks, cancellation must be reachable in 2 clicks.

#### 3. Forced Continuity

Charging users after a free trial ends without clear, timely notice.

**Rules:**
- Send a reminder email at least 3 days before trial-to-paid conversion.
- The trial start screen must clearly state when charging begins and the exact amount.
- Cancellation must be available during the trial with no penalty.

#### 4. Misdirection

Using visual hierarchy, color, or layout to draw attention away from options that benefit the user.

**Signs:**
- Decline button is gray, tiny, or styled as a link while Accept is a large colored button.
- Pre-checked boxes for additional purchases or data sharing.
- The "free" option is visually de-emphasized compared to paid options.

**Rule:** All options at a decision point must have equal visual weight. Pre-checked boxes for non-essential consent are prohibited.

#### 5. Hidden Costs

Revealing additional fees, taxes, or charges only at the final step of a purchase flow.

**Rule:** The total cost (including all fees) must be visible from the first screen where a price is shown.

#### 6. Trick Questions

Using double negatives or confusing language to obtain consent.

**Bad:**
```
[ ] Uncheck this box if you prefer not to not receive emails
```

**Good:**
```
[ ] Send me product updates via email
```

**Rule:** Consent language must be affirmative, clear, and free of double negatives.

#### 7. Disguised Ads

Making advertisements look like content, navigation, or system notifications.

**Rule:** All paid or sponsored content must be clearly labeled with visible "Ad" or "Sponsored" indicators.

---

## Dark Pattern Checklist

Use this checklist during UX review or code review to detect dark patterns.

### Consent and Opt-In

- [ ] All consent checkboxes are unchecked by default.
- [ ] Consent language is affirmative and uses no double negatives.
- [ ] Declining consent uses neutral language (no confirmshaming).
- [ ] All options at a decision point have proportional visual weight.

### Cancellation and Reversal

- [ ] Cancellation is reachable within the same number of steps as sign-up.
- [ ] No retention dark patterns (guilt screens, hidden cancel buttons).
- [ ] Trial-to-paid transitions include advance notice with exact amount and date.
- [ ] Account deletion is available in settings, not only via support ticket.

### Pricing and Cost

- [ ] Total cost (including fees, taxes, shipping) is shown on the first price screen.
- [ ] No items are pre-added to cart.
- [ ] Price comparison does not use inflated "original" prices.

### Visual Honesty

- [ ] Primary and decline buttons have proportional visual weight.
- [ ] No pre-selected upsells or add-ons.
- [ ] Ads are clearly labeled and visually distinct from content.
- [ ] Cookie banners make "Reject all" as prominent as "Accept all".

### Data and Privacy

- [ ] Data collection checkboxes are granular (not bundled "agree to all").
- [ ] Privacy settings default to the most restrictive option.
- [ ] "Share with partners" is opt-in, not opt-out.

---

## DSA Article 25 Compliance

The EU Digital Services Act Article 25 (effective February 2024) prohibits online platforms from:

1. **Designing interfaces that deceive or manipulate users** into making decisions they would not otherwise make.
2. **Giving disproportionate visual prominence** to certain choices to subvert user autonomy.
3. **Making it unreasonably difficult** to terminate a service or withdraw consent.
4. **Using repetitive prompts** to pressure users into decisions after they have already declined.

### Implementation Requirements

For platforms subject to DSA:

- Audit all user-facing flows against the dark pattern checklist above.
- Document the audit with screenshots and rationale.
- Ensure "Reject" / "Decline" / "Cancel" actions are visually equal to their affirmative counterparts.
- Do not repeat prompts for a declined action within the same session.
- Provide a single-step "withdraw consent" mechanism for any previously granted consent.

### Code Example: Balanced Choice Buttons

```tsx
/**
 * Presents two options with equal visual weight.
 * Neither option is visually privileged over the other.
 * Compliant with DSA Article 25 proportional prominence.
 */
function BalancedChoice({
  acceptLabel,
  declineLabel,
  onAccept,
  onDecline,
}: {
  acceptLabel: string;
  declineLabel: string;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const buttonClass =
    "flex-1 rounded-md border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800 focus-visible:outline-2 focus-visible:outline-offset-2";

  return (
    <div className="flex gap-3">
      <button onClick={onDecline} className={buttonClass}>
        {declineLabel}
      </button>
      <button onClick={onAccept} className={buttonClass}>
        {acceptLabel}
      </button>
    </div>
  );
}
```

### Code Example: Cookie Consent (DSA-Compliant)

```tsx
function CookieConsent({
  onAcceptAll,
  onRejectAll,
  onCustomize,
}: {
  onAcceptAll: () => void;
  onRejectAll: () => void;
  onCustomize: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-label="Cookie preferences"
      className="fixed bottom-0 inset-x-0 z-50 border-t border-gray-200 bg-white p-4 shadow-lg dark:border-gray-800 dark:bg-gray-900 sm:flex sm:items-center sm:justify-between sm:gap-4"
    >
      <p className="text-sm text-gray-600 dark:text-gray-400">
        We use cookies for essential site functionality. Optional cookies help us
        improve your experience.
      </p>
      <div className="mt-3 flex gap-2 sm:mt-0 sm:flex-shrink-0">
        {/* Reject and Accept have identical styling -- DSA Art. 25 */}
        <button
          onClick={onRejectAll}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800 focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          Reject all
        </button>
        <button
          onClick={onCustomize}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800 focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          Customize
        </button>
        <button
          onClick={onAcceptAll}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800 focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          Accept all
        </button>
      </div>
    </div>
  );
}
```
