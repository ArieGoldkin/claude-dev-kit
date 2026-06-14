# Navigation and Disclosure Patterns

Patterns for revealing content, navigating datasets, and rearranging items: modals, drawers, inline expansion, progressive disclosure, pagination, infinite scroll, and drag-and-drop.

---

## Table of Contents

- [Modal Dialogs](#modal-dialogs)
- [Drawer Panels](#drawer-panels)
- [Inline Expansion](#inline-expansion)
- [Progressive Disclosure and Step Wizards](#progressive-disclosure-and-step-wizards)
- [Pagination](#pagination)
- [Infinite Scroll](#infinite-scroll)
- [Drag and Drop](#drag-and-drop)

---

## Modal Dialogs

Modals block interaction with the rest of the page to focus the user on a single task. Use them sparingly -- they interrupt flow.

### When to Use

- Destructive confirmations ("Delete this item?").
- Short, focused tasks (rename, quick edit, confirm action).
- Critical information that must be acknowledged.

### When NOT to Use

- Displaying large amounts of content (use a page or drawer instead).
- Onboarding flows (use inline progressive disclosure).
- Notifications (use toasts).

### Accessibility Requirements

1. **Focus trap** -- Tab and Shift+Tab must cycle within the modal. Focus must not escape to the page behind.
2. **Initial focus** -- Move focus to the first interactive element (or the close button) when the modal opens.
3. **Return focus** -- On close, return focus to the element that triggered the modal.
4. **Escape to close** -- Pressing Escape must close the modal.
5. **Scroll lock** -- Prevent background scroll while the modal is open.
6. **ARIA attributes** -- `role="dialog"`, `aria-modal="true"`, `aria-labelledby` pointing to the modal title.

### React + Radix UI Example

```tsx
import * as Dialog from "@radix-ui/react-dialog";

interface ConfirmModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  onConfirm: () => void;
  confirmLabel?: string;
  variant?: "danger" | "default";
}

function ConfirmModal({
  open,
  onOpenChange,
  title,
  description,
  onConfirm,
  confirmLabel = "Confirm",
  variant = "default",
}: ConfirmModalProps) {
  const confirmClass =
    variant === "danger"
      ? "bg-red-600 text-white hover:bg-red-700 focus-visible:outline-red-600"
      : "bg-gray-900 text-white hover:bg-gray-800 focus-visible:outline-gray-900 dark:bg-gray-100 dark:text-gray-900";

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-gray-900 animate-in fade-in zoom-in-95 duration-200"
          aria-describedby="modal-description"
        >
          <Dialog.Title className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {title}
          </Dialog.Title>
          <Dialog.Description
            id="modal-description"
            className="mt-2 text-sm text-gray-600 dark:text-gray-400"
          >
            {description}
          </Dialog.Description>
          <div className="mt-6 flex justify-end gap-3">
            <Dialog.Close asChild>
              <button className="rounded-md px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 focus-visible:outline-2 focus-visible:outline-offset-2">
                Cancel
              </button>
            </Dialog.Close>
            <button
              onClick={() => {
                onConfirm();
                onOpenChange(false);
              }}
              className={`rounded-md px-4 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 ${confirmClass}`}
            >
              {confirmLabel}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

Radix UI handles focus trapping, Escape to close, and return focus automatically. If using a custom implementation, you must handle all of these manually.

### Scroll Lock

Radix Dialog handles scroll lock. For custom implementations:

```tsx
import { useEffect } from "react";

function useScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return;
    const scrollY = window.scrollY;
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";

    return () => {
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.width = "";
      window.scrollTo(0, scrollY);
    };
  }, [locked]);
}
```

---

## Drawer Panels

Drawers are side panels that slide in from the edge of the screen. They share the same accessibility requirements as modals but are better suited for secondary content, filters, and navigation.

### When to Use

- Filter panels on list/search pages.
- Navigation menus on mobile.
- Detail views that supplement the main content.
- Settings or configuration panels.

### Accessibility

Same as modals: focus trap, Escape to close, scroll lock, return focus. Additionally:

- On mobile, support swipe-to-dismiss in the direction the drawer came from.
- Drawer must not cover the entire viewport on desktop (that is a modal). Keep width to 320--480px.

### React + Radix UI Example

```tsx
import * as Dialog from "@radix-ui/react-dialog";

interface DrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: React.ReactNode;
  side?: "left" | "right";
}

function Drawer({
  open,
  onOpenChange,
  title,
  children,
  side = "right",
}: DrawerProps) {
  const slideClass =
    side === "right"
      ? "right-0 animate-in slide-in-from-right duration-300"
      : "left-0 animate-in slide-in-from-left duration-300";

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 animate-in fade-in duration-200" />
        <Dialog.Content
          className={`fixed top-0 bottom-0 w-full max-w-md bg-white shadow-xl dark:bg-gray-900 flex flex-col ${slideClass}`}
        >
          <div className="flex items-center justify-between border-b px-4 py-3 dark:border-gray-800">
            <Dialog.Title className="text-base font-semibold text-gray-900 dark:text-gray-100">
              {title}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                aria-label="Close drawer"
                className="rounded p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                <XIcon className="h-5 w-5" />
              </button>
            </Dialog.Close>
          </div>
          <div className="flex-1 overflow-y-auto p-4">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

---

## Inline Expansion

Inline expansion reveals additional content within the current layout without opening a separate container. Use for low-interruption detail reveals.

### Patterns

- **Accordion** -- Mutually exclusive panels (only one open at a time) or independent panels.
- **Collapsible section** -- Single expand/collapse toggle.
- **Tooltip** -- Hover/focus-triggered brief text. Not for interactive content.

### Accessibility

- Toggle button must have `aria-expanded="true|false"`.
- Toggle button must have `aria-controls` pointing to the content panel ID.
- Content panel should have `role="region"` and `aria-labelledby` pointing to the toggle.
- Tooltips must use `role="tooltip"` and be associated via `aria-describedby`.

### Accordion Example

```tsx
import * as Accordion from "@radix-ui/react-accordion";

interface AccordionItem {
  value: string;
  title: string;
  content: React.ReactNode;
}

function AccordionGroup({ items }: { items: AccordionItem[] }) {
  return (
    <Accordion.Root type="single" collapsible className="space-y-1">
      {items.map((item) => (
        <Accordion.Item
          key={item.value}
          value={item.value}
          className="rounded-lg border border-gray-200 dark:border-gray-800"
        >
          <Accordion.Header>
            <Accordion.Trigger className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-gray-900 hover:bg-gray-50 dark:text-gray-100 dark:hover:bg-gray-800/50 focus-visible:outline-2 focus-visible:outline-offset-2 rounded-lg [&[data-state=open]>svg]:rotate-180">
              {item.title}
              <ChevronDownIcon className="h-4 w-4 text-gray-500 transition-transform duration-200" />
            </Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Content className="overflow-hidden text-sm text-gray-600 dark:text-gray-400 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:slide-in-from-top-1 data-[state=closed]:slide-out-to-top-1 duration-200">
            <div className="px-4 pb-3">{item.content}</div>
          </Accordion.Content>
        </Accordion.Item>
      ))}
    </Accordion.Root>
  );
}
```

### Collapsible Section Example

```tsx
import * as Collapsible from "@radix-ui/react-collapsible";

function CollapsibleSection({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <Collapsible.Root defaultOpen={defaultOpen}>
      <Collapsible.Trigger className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100 focus-visible:outline-2 focus-visible:outline-offset-2 [&[data-state=open]>svg]:rotate-90">
        <ChevronRightIcon className="h-4 w-4 transition-transform duration-150" />
        {title}
      </Collapsible.Trigger>
      <Collapsible.Content className="mt-2 pl-6 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in data-[state=closed]:fade-out duration-200">
        {children}
      </Collapsible.Content>
    </Collapsible.Root>
  );
}
```

---

## Progressive Disclosure and Step Wizards

Progressive disclosure breaks complex tasks into sequential steps, showing only the information and controls relevant to the current step.

### When to Use

- Multi-step forms (registration, onboarding, checkout).
- Configuration flows with dependent options.
- Guided workflows where later steps depend on earlier choices.

### Rules

1. Show a step indicator with the current step, total steps, and step labels.
2. Allow navigating back to previous steps without losing data.
3. Validate each step before allowing progression.
4. Announce step changes to screen readers: "Step 2 of 4: Contact Information".
5. Preserve form state when navigating between steps.

### Step Wizard Example

```tsx
import { useState, useCallback } from "react";

interface Step {
  id: string;
  label: string;
  content: React.ReactNode;
  validate?: () => boolean;
}

function StepWizard({ steps, onComplete }: { steps: Step[]; onComplete: () => void }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const current = steps[currentIndex];
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === steps.length - 1;

  const goNext = useCallback(() => {
    if (current.validate && !current.validate()) return;
    if (isLast) {
      onComplete();
    } else {
      setCurrentIndex((i) => i + 1);
    }
  }, [current, isLast, onComplete]);

  const goBack = useCallback(() => {
    if (!isFirst) setCurrentIndex((i) => i - 1);
  }, [isFirst]);

  return (
    <div>
      {/* Step indicator */}
      <nav aria-label="Progress">
        <ol className="flex items-center gap-2" role="list">
          {steps.map((step, i) => (
            <li key={step.id} className="flex items-center gap-2">
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                  i < currentIndex
                    ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                    : i === currentIndex
                      ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900"
                      : "bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500"
                }`}
                aria-current={i === currentIndex ? "step" : undefined}
              >
                {i < currentIndex ? <CheckIcon className="h-4 w-4" /> : i + 1}
              </span>
              <span
                className={`text-sm hidden sm:inline ${
                  i === currentIndex
                    ? "font-medium text-gray-900 dark:text-gray-100"
                    : "text-gray-400 dark:text-gray-500"
                }`}
              >
                {step.label}
              </span>
              {i < steps.length - 1 && (
                <div className="h-px w-8 bg-gray-200 dark:bg-gray-700" />
              )}
            </li>
          ))}
        </ol>
      </nav>

      {/* Step content with announcement */}
      <div
        role="region"
        aria-live="polite"
        aria-label={`Step ${currentIndex + 1} of ${steps.length}: ${current.label}`}
        className="mt-6"
      >
        {current.content}
      </div>

      {/* Navigation */}
      <div className="mt-6 flex justify-between">
        <button
          onClick={goBack}
          disabled={isFirst}
          className="rounded-md px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:invisible dark:text-gray-300 dark:hover:bg-gray-800 focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          Back
        </button>
        <button
          onClick={goNext}
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200 focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          {isLast ? "Complete" : "Continue"}
        </button>
      </div>
    </div>
  );
}
```

---

## Pagination

Pagination divides a dataset into discrete pages with navigation controls.

### When to Use

- Known, finite datasets where users may need to jump to a specific page.
- SEO-sensitive content (each page gets its own URL).
- Tabular data, search results, product listings.

### Rules

1. Use `nav` with `aria-label="Pagination"`.
2. Current page link must have `aria-current="page"`.
3. All page links must be keyboard-navigable.
4. Include Previous/Next controls. Disable (not hide) them when at the first/last page.
5. For large page counts, show first, last, current neighborhood, and ellipsis.
6. Sync page state with the URL (`?page=3`) for shareability and back-button support.

### Pagination Component

```tsx
interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  const pages = getPaginationRange(currentPage, totalPages);

  return (
    <nav aria-label="Pagination" className="flex items-center gap-1">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        aria-label="Previous page"
        className="rounded-md p-2 text-gray-500 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed dark:hover:bg-gray-800 focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <ChevronLeftIcon className="h-4 w-4" />
      </button>

      {pages.map((page, i) =>
        page === "ellipsis" ? (
          <span key={`ellipsis-${i}`} className="px-2 text-gray-400">
            ...
          </span>
        ) : (
          <button
            key={page}
            onClick={() => onPageChange(page)}
            aria-current={page === currentPage ? "page" : undefined}
            className={`min-w-[2rem] rounded-md px-2 py-1 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 ${
              page === currentPage
                ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900"
                : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
            }`}
          >
            {page}
          </button>
        )
      )}

      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        aria-label="Next page"
        className="rounded-md p-2 text-gray-500 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed dark:hover:bg-gray-800 focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <ChevronRightIcon className="h-4 w-4" />
      </button>
    </nav>
  );
}

/** Produces an array like [1, 'ellipsis', 4, 5, 6, 'ellipsis', 20] */
function getPaginationRange(
  current: number,
  total: number,
  siblings: number = 1
): (number | "ellipsis")[] {
  const range: (number | "ellipsis")[] = [];
  const left = Math.max(2, current - siblings);
  const right = Math.min(total - 1, current + siblings);

  range.push(1);
  if (left > 2) range.push("ellipsis");
  for (let i = left; i <= right; i++) range.push(i);
  if (right < total - 1) range.push("ellipsis");
  if (total > 1) range.push(total);

  return range;
}
```

---

## Infinite Scroll

Infinite scroll automatically loads more content as the user scrolls near the bottom of the list.

### When to Use

- Casual browsing: social feeds, image galleries, news streams.
- Content where users rarely need to reach a specific item.

### When NOT to Use

- When users need to find a specific item (use pagination or search).
- When footer content must be accessible (infinite scroll pushes the footer forever).
- When items have a small, known total count.

### Rules

1. Use `IntersectionObserver` on a sentinel element near the bottom to trigger loading.
2. **Always provide a "Load more" button as a keyboard fallback.** Screen reader and keyboard users cannot reliably trigger scroll-based loading.
3. Announce new content via `aria-live="polite"` on the list container.
4. Show a loading indicator below existing content while fetching.
5. Provide a count of loaded vs total items when possible.
6. Support scroll restoration on back-navigation (store scroll position).

### React Example with IntersectionObserver

```tsx
import { useEffect, useRef, useCallback } from "react";

function useIntersectionLoader(
  onIntersect: () => void,
  options: { enabled?: boolean; rootMargin?: string } = {}
) {
  const { enabled = true, rootMargin = "200px" } = options;
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!enabled || !sentinelRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) onIntersect();
      },
      { rootMargin }
    );

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [enabled, onIntersect, rootMargin]);

  return sentinelRef;
}

interface InfiniteListProps<T> {
  items: T[];
  renderItem: (item: T) => React.ReactNode;
  hasMore: boolean;
  isLoading: boolean;
  onLoadMore: () => void;
  totalCount?: number;
}

function InfiniteList<T extends { id: string }>({
  items,
  renderItem,
  hasMore,
  isLoading,
  onLoadMore,
  totalCount,
}: InfiniteListProps<T>) {
  const loadMore = useCallback(() => {
    if (!isLoading && hasMore) onLoadMore();
  }, [isLoading, hasMore, onLoadMore]);

  const sentinelRef = useIntersectionLoader(loadMore, {
    enabled: hasMore && !isLoading,
  });

  return (
    <div>
      {totalCount !== undefined && (
        <p className="text-sm text-gray-500 mb-2" aria-live="polite">
          Showing {items.length} of {totalCount} items
        </p>
      )}

      <ul aria-live="polite" className="space-y-2">
        {items.map((item) => (
          <li key={item.id}>{renderItem(item)}</li>
        ))}
      </ul>

      {/* Sentinel for IntersectionObserver */}
      {hasMore && <div ref={sentinelRef} className="h-px" aria-hidden="true" />}

      {/* Loading indicator */}
      {isLoading && (
        <div className="py-4 text-center text-sm text-gray-400" aria-busy="true">
          Loading more items...
        </div>
      )}

      {/* Keyboard fallback */}
      {hasMore && !isLoading && (
        <div className="py-4 text-center">
          <button
            onClick={onLoadMore}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800 focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            Load more
          </button>
        </div>
      )}
    </div>
  );
}
```

---

## Drag and Drop

Drag and drop enables reordering items, moving items between lists, and spatial arrangement. Every drag-and-drop interaction **must** have a keyboard alternative.

### Library: `@dnd-kit/core`

`@dnd-kit` is the recommended library for React drag-and-drop. It provides built-in keyboard support, screen reader announcements, and accessible drag handles.

### Rules

1. **Mandatory keyboard alternative** -- Every draggable item must be operable via keyboard (arrow keys to move, Space/Enter to pick up/drop).
2. Use `@dnd-kit/core` `KeyboardSensor` alongside `PointerSensor` and `TouchSensor`.
3. Provide screen reader announcements for pick up, move, and drop events via `announcements`.
4. Drag handles must be focusable with `tabindex="0"` and have `aria-label` or `aria-roledescription`.
5. The draggable item must have `aria-roledescription="sortable"` for sortable lists.

### Sortable List Example

```tsx
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface SortableItemProps {
  id: string;
  children: React.ReactNode;
}

function SortableItem({ id, children }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 rounded-lg border bg-white px-4 py-3 dark:bg-gray-900 ${
        isDragging
          ? "border-blue-400 shadow-lg opacity-90 z-10"
          : "border-gray-200 dark:border-gray-800"
      }`}
    >
      <button
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
        className="cursor-grab rounded p-1 text-gray-400 hover:text-gray-600 active:cursor-grabbing focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <GripVerticalIcon className="h-4 w-4" />
      </button>
      <span className="flex-1">{children}</span>
    </li>
  );
}

function SortableList({
  items,
  onReorder,
}: {
  items: { id: string; label: string }[];
  onReorder: (items: { id: string; label: string }[]) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(TouchSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex((item) => item.id === active.id);
      const newIndex = items.findIndex((item) => item.id === over.id);
      onReorder(arrayMove(items, oldIndex, newIndex));
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
      accessibility={{
        announcements: {
          onDragStart({ active }) {
            return `Picked up item ${active.id}. Use arrow keys to move, Space to drop.`;
          },
          onDragOver({ active, over }) {
            if (over) {
              return `Item ${active.id} is over position ${over.id}.`;
            }
            return `Item ${active.id} is no longer over a droppable area.`;
          },
          onDragEnd({ active, over }) {
            if (over) {
              return `Item ${active.id} was dropped at position ${over.id}.`;
            }
            return `Item ${active.id} was dropped.`;
          },
          onDragCancel({ active }) {
            return `Dragging of item ${active.id} was cancelled.`;
          },
        },
      }}
    >
      <SortableContext items={items} strategy={verticalListSortingStrategy}>
        <ul className="space-y-2" role="list" aria-label="Reorderable list">
          {items.map((item) => (
            <SortableItem key={item.id} id={item.id}>
              {item.label}
            </SortableItem>
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}
```

### Keyboard-Only Alternative (Without Drag Library)

When `@dnd-kit` is not available, provide a move menu:

```tsx
function MoveMenu({ index, total, onMove }: {
  index: number;
  total: number;
  onMove: (from: number, to: number) => void;
}) {
  return (
    <div role="group" aria-label="Reorder controls">
      <button
        onClick={() => onMove(index, index - 1)}
        disabled={index === 0}
        aria-label="Move up"
        className="rounded p-1 disabled:opacity-30 hover:bg-gray-100 dark:hover:bg-gray-800 focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <ArrowUpIcon className="h-4 w-4" />
      </button>
      <button
        onClick={() => onMove(index, index + 1)}
        disabled={index === total - 1}
        aria-label="Move down"
        className="rounded p-1 disabled:opacity-30 hover:bg-gray-100 dark:hover:bg-gray-800 focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <ArrowDownIcon className="h-4 w-4" />
      </button>
    </div>
  );
}
```
