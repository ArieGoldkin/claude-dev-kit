# Loading and Feedback Patterns

Patterns for communicating system state to users: skeleton screens, optimistic UI, toast notifications, and error recovery.

---

## Table of Contents

- [Skeleton Screens](#skeleton-screens)
- [Shimmer Animation](#shimmer-animation)
- [Progressive Loading](#progressive-loading)
- [Optimistic UI](#optimistic-ui)
- [Toast and Notification Patterns](#toast-and-notification-patterns)
- [Error Recovery](#error-recovery)

---

## Skeleton Screens

Skeleton screens replace content areas with placeholder shapes that match the layout of the data being loaded. They reduce perceived wait time by giving users a visual framework before content arrives.

### Rules

- Use skeletons for any data fetch expected to take longer than 200ms.
- Skeleton shapes must match the layout of the real content (card skeleton for cards, table row skeleton for tables).
- Never use a single centered spinner for content areas. Spinners are acceptable only for small inline actions (button submit, icon refresh).
- Set `aria-busy="true"` on the container while loading. Remove it when content arrives.
- Provide `aria-label="Loading content"` on the skeleton container for screen readers.

### React + TypeScript Example

```tsx
interface SkeletonProps {
  width?: string;
  height?: string;
  borderRadius?: string;
  className?: string;
}

function Skeleton({
  width = "100%",
  height = "1rem",
  borderRadius = "4px",
  className = "",
}: SkeletonProps) {
  return (
    <div
      className={`animate-pulse bg-gray-200 dark:bg-gray-700 ${className}`}
      style={{ width, height, borderRadius }}
      aria-hidden="true"
    />
  );
}

function CardSkeleton() {
  return (
    <div
      className="rounded-lg border border-gray-200 p-4 space-y-3"
      aria-busy="true"
      aria-label="Loading card content"
    >
      <Skeleton width="60%" height="1.25rem" />
      <Skeleton width="100%" height="0.875rem" />
      <Skeleton width="100%" height="0.875rem" />
      <Skeleton width="40%" height="0.875rem" />
    </div>
  );
}
```

### Tailwind Shimmer Animation

The built-in `animate-pulse` works for simple cases. For a shimmer sweep effect:

```css
@keyframes shimmer {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}

.skeleton-shimmer {
  background: linear-gradient(
    90deg,
    theme("colors.gray.200") 25%,
    theme("colors.gray.100") 50%,
    theme("colors.gray.200") 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
}
```

---

## Shimmer Animation

### Tailwind Utility Class Approach

```tsx
function ShimmerBlock({ className }: { className?: string }) {
  return (
    <div
      className={`
        bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200
        dark:from-gray-700 dark:via-gray-600 dark:to-gray-700
        bg-[length:200%_100%] animate-[shimmer_1.5s_ease-in-out_infinite]
        rounded ${className ?? ""}
      `}
      aria-hidden="true"
    />
  );
}
```

Add to `tailwind.config.ts`:

```ts
export default {
  theme: {
    extend: {
      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        shimmer: "shimmer 1.5s ease-in-out infinite",
      },
    },
  },
};
```

### Accessibility: `prefers-reduced-motion`

Always respect motion preferences. The shimmer animation should stop for users who prefer reduced motion:

```css
@media (prefers-reduced-motion: reduce) {
  .skeleton-shimmer,
  .animate-shimmer {
    animation: none;
    background: theme("colors.gray.200");
  }
}
```

In Tailwind, use `motion-reduce:animate-none` on shimmer elements.

---

## Progressive Loading

Progressive loading shows content incrementally as it becomes available, rather than waiting for all data before rendering.

### Patterns

1. **Above-the-fold first** -- Render visible content immediately; lazy-load below-fold sections.
2. **Staggered skeleton replacement** -- Replace skeletons one section at a time as data arrives, top to bottom.
3. **Image progressive loading** -- Use `loading="lazy"` on images, blur-up placeholders for hero images.

### React Example: Staggered Loading

```tsx
function DashboardPage() {
  const { data: header, isLoading: headerLoading } = useQuery({
    queryKey: ["header"],
    queryFn: fetchHeader,
  });
  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ["metrics"],
    queryFn: fetchMetrics,
  });
  const { data: activity, isLoading: activityLoading } = useQuery({
    queryKey: ["activity"],
    queryFn: fetchActivity,
  });

  return (
    <main>
      <section aria-busy={headerLoading}>
        {headerLoading ? <HeaderSkeleton /> : <Header data={header} />}
      </section>
      <section aria-busy={metricsLoading}>
        {metricsLoading ? <MetricsSkeleton /> : <MetricsGrid data={metrics} />}
      </section>
      <section aria-busy={activityLoading}>
        {activityLoading ? <ActivitySkeleton /> : <ActivityFeed data={activity} />}
      </section>
    </main>
  );
}
```

---

## Optimistic UI

Optimistic UI immediately reflects the expected result of a user action before the server confirms it. If the server rejects the change, the UI rolls back and notifies the user.

### When to Use

- Write operations with a low failure rate (less than 5%).
- Actions where perceived speed matters (likes, toggles, inline edits, status changes).
- NOT for irreversible destructive actions (delete, payment, account changes).

### Rules

1. Apply the expected state change instantly in the UI.
2. Show a subtle sync indicator (small spinner or "Saving..." text) while the request is in flight.
3. On failure, revert to the previous state and show an error toast with a retry option.
4. Announce the rollback to screen readers via `aria-live="assertive"`.

### React + TypeScript Example

```tsx
import { useMutation, useQueryClient } from "@tanstack/react-query";

interface Task {
  id: string;
  title: string;
  completed: boolean;
}

function useToggleTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (task: Task) =>
      fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        body: JSON.stringify({ completed: !task.completed }),
        headers: { "Content-Type": "application/json" },
      }).then((res) => {
        if (!res.ok) throw new Error("Failed to update task");
        return res.json() as Promise<Task>;
      }),

    // Optimistic update
    onMutate: async (task) => {
      await queryClient.cancelQueries({ queryKey: ["tasks"] });
      const previous = queryClient.getQueryData<Task[]>(["tasks"]);

      queryClient.setQueryData<Task[]>(["tasks"], (old) =>
        old?.map((t) =>
          t.id === task.id ? { ...t, completed: !t.completed } : t
        )
      );

      return { previous };
    },

    // Rollback on error
    onError: (_err, _task, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["tasks"], context.previous);
      }
      // Toast notification handles user-facing error (see Toast section)
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}
```

### Sync Indicator

Show a subtle indicator while the mutation is pending:

```tsx
function TaskItem({ task }: { task: Task }) {
  const toggle = useToggleTask();

  return (
    <li className="flex items-center gap-2">
      <button
        onClick={() => toggle.mutate(task)}
        disabled={toggle.isPending}
        aria-label={`Mark "${task.title}" as ${task.completed ? "incomplete" : "complete"}`}
      >
        {task.completed ? <CheckIcon /> : <CircleIcon />}
      </button>
      <span className={task.completed ? "line-through text-gray-400" : ""}>
        {task.title}
      </span>
      {toggle.isPending && (
        <span className="text-xs text-gray-400" aria-live="polite">
          Saving...
        </span>
      )}
    </li>
  );
}
```

---

## Toast and Notification Patterns

Toast notifications provide non-blocking feedback for completed actions, errors, or informational messages. They must not interrupt screen reader users unexpectedly.

### Rules

1. Use `role="status"` and `aria-live="polite"` for success and info toasts.
2. Use `role="alert"` and `aria-live="assertive"` for error toasts that require attention.
3. Auto-dismiss success toasts after 5 seconds. Error toasts must persist until dismissed.
4. Include a visible close button with `aria-label="Dismiss notification"`.
5. Action buttons in toasts (e.g., "Undo", "Retry") must be keyboard-focusable.
6. Stack toasts vertically. Limit visible toasts to 3; queue additional ones.
7. New toasts should not push existing content or shift layout (use fixed positioning).

### Toast Component

```tsx
import { useCallback, useEffect, useRef } from "react";

type ToastVariant = "success" | "error" | "info" | "warning";

interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
  action?: { label: string; onClick: () => void };
  autoDismissMs?: number;
}

const variantStyles: Record<ToastVariant, string> = {
  success: "bg-green-50 border-green-200 text-green-800 dark:bg-green-950 dark:border-green-800 dark:text-green-200",
  error: "bg-red-50 border-red-200 text-red-800 dark:bg-red-950 dark:border-red-800 dark:text-red-200",
  info: "bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-200",
  warning: "bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-200",
};

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: (id: string) => void;
}) {
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const isError = toast.variant === "error";
  const autoDismiss = toast.autoDismissMs ?? (isError ? undefined : 5000);

  useEffect(() => {
    if (autoDismiss) {
      timerRef.current = setTimeout(() => onDismiss(toast.id), autoDismiss);
      return () => clearTimeout(timerRef.current);
    }
  }, [autoDismiss, onDismiss, toast.id]);

  const handleMouseEnter = useCallback(() => {
    clearTimeout(timerRef.current);
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (autoDismiss) {
      timerRef.current = setTimeout(() => onDismiss(toast.id), autoDismiss);
    }
  }, [autoDismiss, onDismiss, toast.id]);

  return (
    <div
      role={isError ? "alert" : "status"}
      aria-live={isError ? "assertive" : "polite"}
      className={`
        flex items-center gap-3 rounded-lg border px-4 py-3 shadow-md
        animate-in slide-in-from-right-full duration-300
        ${variantStyles[toast.variant]}
      `}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <p className="flex-1 text-sm font-medium">{toast.message}</p>
      {toast.action && (
        <button
          onClick={toast.action.onClick}
          className="text-sm font-semibold underline underline-offset-2 hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          {toast.action.label}
        </button>
      )}
      <button
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss notification"
        className="rounded p-1 hover:bg-black/5 dark:hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <XIcon className="h-4 w-4" />
      </button>
    </div>
  );
}

function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}) {
  const visible = toasts.slice(0, 3);

  return (
    <div
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-full max-w-sm"
      aria-label="Notifications"
    >
      {visible.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}
```

### Pause on Hover

The example above pauses auto-dismiss when the user hovers over a toast. This is critical for users who need more time to read or interact with action buttons.

---

## Error Recovery

Error recovery patterns handle failures gracefully so users can continue their task without losing work.

### Error Boundaries

React error boundaries catch render errors and display a fallback UI with a retry mechanism.

```tsx
import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.props.onError?.(error, info);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div
          role="alert"
          className="flex flex-col items-center gap-4 rounded-lg border border-red-200 bg-red-50 p-6 text-center dark:border-red-800 dark:bg-red-950"
        >
          <p className="text-sm text-red-800 dark:text-red-200">
            Something went wrong loading this section.
          </p>
          <button
            onClick={this.handleRetry}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
```

### Retry with Exponential Backoff

For network requests, retry with increasing delays before showing a failure state:

```tsx
async function fetchWithRetry<T>(
  fn: () => Promise<T>,
  options: { maxRetries?: number; baseDelay?: number } = {}
): Promise<T> {
  const { maxRetries = 3, baseDelay = 1000 } = options;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries) throw error;
      const delay = baseDelay * 2 ** attempt + Math.random() * 500;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // Unreachable, but satisfies TypeScript
  throw new Error("Retry exhausted");
}
```

### Graceful Degradation Pattern

When a non-critical feature fails, hide it gracefully instead of breaking the page:

```tsx
function DegradableSection({
  children,
  featureName,
}: {
  children: ReactNode;
  featureName: string;
}) {
  return (
    <ErrorBoundary
      fallback={
        <p className="text-xs text-gray-400 italic p-2">
          {featureName} is temporarily unavailable.
        </p>
      }
      onError={(error) => {
        console.error(`[${featureName}] degraded:`, error);
        // Report to error tracking service
      }}
    >
      {children}
    </ErrorBoundary>
  );
}

// Usage
function Dashboard() {
  return (
    <main>
      <Header />
      <MetricsGrid />
      <DegradableSection featureName="Activity feed">
        <ActivityFeed />
      </DegradableSection>
      <DegradableSection featureName="Recommendations">
        <RecommendationPanel />
      </DegradableSection>
    </main>
  );
}
```

### User-Facing Error States

Every error state must include:

1. **What happened** -- Clear, non-technical description.
2. **What the user can do** -- Retry button, alternative action, or contact information.
3. **Focus management** -- Move focus to the error message or retry button so keyboard and screen reader users are aware of the change.

```tsx
function NetworkError({ onRetry }: { onRetry: () => void }) {
  const retryRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    retryRef.current?.focus();
  }, []);

  return (
    <div role="alert" className="flex flex-col items-center gap-3 p-6 text-center">
      <WifiOffIcon className="h-8 w-8 text-gray-400" />
      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
        Unable to load data. Check your connection and try again.
      </p>
      <button
        ref={retryRef}
        onClick={onRetry}
        className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 focus-visible:outline-2 focus-visible:outline-offset-2 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200"
      >
        Retry
      </button>
    </div>
  );
}
```
