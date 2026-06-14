# Forms and Validation

React Hook Form v7 + Zod validation patterns with accessible error handling, field composition, and multi-step form architecture.

---

## Table of Contents

- [Foundation: React Hook Form + Zod](#foundation-react-hook-form--zod)
- [Field-Level Error Display](#field-level-error-display)
- [Composable FormField Component](#composable-formfield-component)
- [Accessible Error Messaging](#accessible-error-messaging)
- [Common Zod Schemas](#common-zod-schemas)
- [Async Validation](#async-validation)
- [Dependent Fields](#dependent-fields)
- [Multi-Step Forms](#multi-step-forms)
- [Form Submission States](#form-submission-states)
- [Server-Side Validation Errors](#server-side-validation-errors)
- [Accessibility Checklist for Forms](#accessibility-checklist-for-forms)

---

## Foundation: React Hook Form + Zod

React Hook Form manages form state with uncontrolled inputs for performance. Zod provides schema-based validation that integrates via `@hookform/resolvers/zod`.

### Basic setup

```tsx
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().min(1, "Email is required").email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

function LoginForm() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(data: LoginFormValues) {
    await loginUser(data);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <div>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? "email-error" : undefined}
          {...register("email")}
        />
        {errors.email && (
          <p id="email-error" role="alert" className="text-sm text-destructive mt-1">
            {errors.email.message}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          aria-invalid={!!errors.password}
          aria-describedby={errors.password ? "password-error" : undefined}
          {...register("password")}
        />
        {errors.password && (
          <p id="password-error" role="alert" className="text-sm text-destructive mt-1">
            {errors.password.message}
          </p>
        )}
      </div>

      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}
```

### Key principles

1. Always pass `noValidate` to `<form>` -- Zod handles validation, browser defaults conflict
2. Use `defaultValues` to avoid uncontrolled-to-controlled warnings
3. Set `mode: "onBlur"` or `mode: "onTouched"` for validation on field exit (not every keystroke)
4. Use `aria-invalid` and `aria-describedby` to connect errors to fields for screen readers

---

## Field-Level Error Display

### Validation modes

```tsx
const form = useForm<FormValues>({
  resolver: zodResolver(schema),
  mode: "onTouched",     // Validate on blur, then re-validate on change after first error
  // mode: "onBlur",     // Validate only on blur
  // mode: "onChange",    // Validate on every keystroke (expensive, use for short fields)
  // mode: "onSubmit",   // Validate only on submit (default)
  // mode: "all",        // Validate on blur AND change
});
```

**Recommended**: `mode: "onTouched"` provides the best UX -- users see errors after leaving a field, and errors clear as they fix them.

### Error message styling

```tsx
// Consistent error message component
function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;

  return (
    <p
      id={id}
      role="alert"
      className="mt-1.5 text-sm font-medium text-destructive animate-in fade-in-0 slide-in-from-top-1 duration-200"
    >
      {message}
    </p>
  );
}
```

### Input with error state

```tsx
import { cn } from "@/lib/utils";

interface FormInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
}

const FormInput = React.forwardRef<HTMLInputElement, FormInputProps>(
  ({ className, error, id, ...props }, ref) => (
    <input
      ref={ref}
      id={id}
      className={cn(
        "flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm",
        "placeholder:text-muted-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "disabled:cursor-not-allowed disabled:opacity-50",
        error
          ? "border-destructive focus-visible:ring-destructive"
          : "border-input",
        className
      )}
      aria-invalid={!!error}
      aria-describedby={error ? `${id}-error` : undefined}
      {...props}
    />
  )
);
FormInput.displayName = "FormInput";
```

---

## Composable FormField Component

A reusable molecule that combines label, input, helper text, and error message.

```tsx
import { useFormContext, Controller, type FieldPath, type FieldValues } from "react-hook-form";

interface FormFieldProps<T extends FieldValues> {
  name: FieldPath<T>;
  label: string;
  description?: string;
  required?: boolean;
  children: (field: {
    value: unknown;
    onChange: (...event: unknown[]) => void;
    onBlur: () => void;
    ref: React.Ref<unknown>;
    error?: string;
    id: string;
  }) => React.ReactNode;
}

function FormField<T extends FieldValues>({
  name,
  label,
  description,
  required,
  children,
}: FormFieldProps<T>) {
  const { control } = useFormContext<T>();
  const id = `field-${name}`;
  const descriptionId = `${id}-description`;
  const errorId = `${id}-error`;

  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <div className="space-y-1.5">
          <label htmlFor={id} className="text-sm font-medium leading-none">
            {label}
            {required && <span className="text-destructive ml-0.5" aria-hidden="true">*</span>}
            {required && <span className="sr-only">(required)</span>}
          </label>

          {description && (
            <p id={descriptionId} className="text-sm text-muted-foreground">
              {description}
            </p>
          )}

          {children({
            ...field,
            error: fieldState.error?.message,
            id,
          })}

          {fieldState.error?.message && (
            <p id={errorId} role="alert" className="text-sm font-medium text-destructive">
              {fieldState.error.message}
            </p>
          )}
        </div>
      )}
    />
  );
}
```

### Usage with FormProvider

```tsx
import { FormProvider } from "react-hook-form";

function ProfileForm() {
  const form = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    mode: "onTouched",
  });

  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <FormField<ProfileValues> name="displayName" label="Display Name" required>
          {({ id, error, ...field }) => (
            <FormInput id={id} error={error} placeholder="Jane Doe" {...field} />
          )}
        </FormField>

        <FormField<ProfileValues> name="bio" label="Bio" description="Brief description, max 160 characters.">
          {({ id, error, ...field }) => (
            <textarea
              id={id}
              className={cn("min-h-[80px] w-full rounded-md border p-3 text-sm", error && "border-destructive")}
              aria-invalid={!!error}
              {...field}
            />
          )}
        </FormField>
      </form>
    </FormProvider>
  );
}
```

---

## Accessible Error Messaging

### Error summary on submit

When a form has multiple errors after submission, provide an error summary at the top with links to each field.

```tsx
function ErrorSummary({ errors }: { errors: Record<string, { message?: string }> }) {
  const errorEntries = Object.entries(errors).filter(([, err]) => err.message);
  if (errorEntries.length === 0) return null;

  return (
    <div
      role="alert"
      aria-label="Form errors"
      className="rounded-md border border-destructive/50 bg-destructive/10 p-4"
      tabIndex={-1}
      ref={(el) => el?.focus()}
    >
      <h3 className="text-sm font-semibold text-destructive">
        Please fix {errorEntries.length} {errorEntries.length === 1 ? "error" : "errors"}:
      </h3>
      <ul className="mt-2 list-disc pl-5 text-sm text-destructive">
        {errorEntries.map(([name, error]) => (
          <li key={name}>
            <a href={`#field-${name}`} className="underline hover:no-underline">
              {error.message}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

### Live region for async validation

```tsx
function AsyncFieldStatus({ isValidating, error }: { isValidating: boolean; error?: string }) {
  return (
    <div aria-live="polite" aria-atomic="true" className="text-sm mt-1">
      {isValidating && <span className="text-muted-foreground">Checking...</span>}
      {error && <span className="text-destructive">{error}</span>}
      {!isValidating && !error && <span className="sr-only">Valid</span>}
    </div>
  );
}
```

---

## Common Zod Schemas

### Email and password

```tsx
const emailSchema = z.string().min(1, "Email is required").email("Enter a valid email address");

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Must include an uppercase letter")
  .regex(/[a-z]/, "Must include a lowercase letter")
  .regex(/[0-9]/, "Must include a number");

const confirmPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
```

### Optional fields with transforms

```tsx
const profileSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  phone: z
    .string()
    .transform((val) => val.replace(/\D/g, ""))
    .pipe(z.string().length(10, "Phone must be 10 digits"))
    .optional()
    .or(z.literal("")),
  age: z.coerce.number().int().min(18, "Must be 18 or older").max(120),
  website: z.string().url("Enter a valid URL").optional().or(z.literal("")),
});
```

### Date ranges

```tsx
const dateRangeSchema = z
  .object({
    startDate: z.coerce.date({ required_error: "Start date is required" }),
    endDate: z.coerce.date({ required_error: "End date is required" }),
  })
  .refine((data) => data.endDate > data.startDate, {
    message: "End date must be after start date",
    path: ["endDate"],
  });
```

---

## Async Validation

For validating against a server (e.g., checking username availability):

```tsx
const usernameSchema = z.object({
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(20, "Username must be at most 20 characters")
    .regex(/^[a-z0-9_-]+$/, "Only lowercase letters, numbers, hyphens, and underscores"),
});

function SignupForm() {
  const form = useForm<z.infer<typeof usernameSchema>>({
    resolver: zodResolver(usernameSchema),
    mode: "onTouched",
  });

  // Async validation after schema validation passes
  const username = form.watch("username");
  const debouncedUsername = useDebounce(username, 500);

  React.useEffect(() => {
    if (!debouncedUsername || form.formState.errors.username) return;

    let cancelled = false;

    async function checkAvailability() {
      const available = await checkUsernameAvailable(debouncedUsername);
      if (cancelled) return;
      if (!available) {
        form.setError("username", { type: "manual", message: "Username is already taken" });
      } else {
        form.clearErrors("username");
      }
    }

    checkAvailability();
    return () => { cancelled = true; };
  }, [debouncedUsername, form]);

  // ... form JSX
}
```

---

## Dependent Fields

When field B's options or validation depend on field A:

```tsx
const addressSchema = z.object({
  country: z.string().min(1, "Select a country"),
  state: z.string().min(1, "Select a state"),
  postalCode: z.string().min(1, "Enter postal code"),
});

function AddressForm() {
  const form = useForm<z.infer<typeof addressSchema>>({
    resolver: zodResolver(addressSchema),
  });

  const country = form.watch("country");

  // Reset dependent field when parent changes
  React.useEffect(() => {
    form.setValue("state", "");
  }, [country, form]);

  const states = useStatesForCountry(country);

  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <FormField name="country" label="Country" required>
          {({ id, ...field }) => (
            <select id={id} {...field}>
              <option value="">Select country</option>
              {countries.map((c) => (
                <option key={c.code} value={c.code}>{c.name}</option>
              ))}
            </select>
          )}
        </FormField>

        <FormField name="state" label="State / Province" required>
          {({ id, ...field }) => (
            <select id={id} disabled={!country} {...field}>
              <option value="">Select state</option>
              {states.map((s) => (
                <option key={s.code} value={s.code}>{s.name}</option>
              ))}
            </select>
          )}
        </FormField>
      </form>
    </FormProvider>
  );
}
```

---

## Multi-Step Forms

### Architecture

```
Step 1: Personal Info  -->  Step 2: Preferences  -->  Step 3: Review & Submit
     (sub-schema 1)            (sub-schema 2)           (full schema)
```

```tsx
const step1Schema = z.object({
  firstName: z.string().min(1, "Required"),
  lastName: z.string().min(1, "Required"),
  email: z.string().email("Enter a valid email"),
});

const step2Schema = z.object({
  frequency: z.enum(["daily", "weekly", "monthly"]),
  topics: z.array(z.string()).min(1, "Select at least one topic"),
});

const fullSchema = step1Schema.merge(step2Schema);
type FullFormValues = z.infer<typeof fullSchema>;

function MultiStepForm() {
  const [step, setStep] = React.useState(0);
  const schemas = [step1Schema, step2Schema, fullSchema];

  const form = useForm<FullFormValues>({
    resolver: zodResolver(schemas[step]),
    mode: "onTouched",
    defaultValues: {
      firstName: "", lastName: "", email: "",
      frequency: "weekly", topics: [],
    },
  });

  async function handleNext() {
    const valid = await form.trigger(); // Validate current step
    if (valid) setStep((s) => s + 1);
  }

  function handleBack() {
    setStep((s) => s - 1);
  }

  async function onSubmit(data: FullFormValues) {
    await submitForm(data);
  }

  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
        {/* Progress indicator */}
        <nav aria-label="Form progress">
          <ol className="flex gap-2" role="list">
            {["Personal Info", "Preferences", "Review"].map((label, i) => (
              <li
                key={label}
                className={cn("text-sm", i === step ? "font-semibold text-primary" : "text-muted-foreground")}
                aria-current={i === step ? "step" : undefined}
              >
                {label}
              </li>
            ))}
          </ol>
        </nav>

        {/* Step content */}
        <div role="group" aria-label={`Step ${step + 1}`}>
          {step === 0 && <Step1Fields />}
          {step === 1 && <Step2Fields />}
          {step === 2 && <ReviewStep />}
        </div>

        {/* Navigation */}
        <div className="flex justify-between mt-6">
          {step > 0 && (
            <button type="button" onClick={handleBack}>Back</button>
          )}
          {step < 2 ? (
            <button type="button" onClick={handleNext}>Continue</button>
          ) : (
            <button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Submitting..." : "Submit"}
            </button>
          )}
        </div>
      </form>
    </FormProvider>
  );
}
```

---

## Form Submission States

### Optimistic submission with error recovery

```tsx
async function onSubmit(data: FormValues) {
  try {
    await submitToApi(data);
    toast.success("Saved successfully");
    form.reset();
  } catch (error) {
    if (isValidationError(error)) {
      // Server returned field-level errors
      for (const [field, message] of Object.entries(error.fields)) {
        form.setError(field as keyof FormValues, { type: "server", message });
      }
    } else {
      // Generic server error
      form.setError("root", { type: "server", message: "Something went wrong. Please try again." });
    }
  }
}

// Display root errors
{form.formState.errors.root && (
  <div role="alert" className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
    {form.formState.errors.root.message}
  </div>
)}
```

### Submit button states

```tsx
function SubmitButton({ isSubmitting }: { isSubmitting: boolean }) {
  return (
    <button
      type="submit"
      disabled={isSubmitting}
      aria-busy={isSubmitting}
      className={cn(
        "inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground",
        "hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "disabled:pointer-events-none disabled:opacity-50",
        "min-w-[120px]" // Prevent layout shift between states
      )}
    >
      {isSubmitting ? (
        <>
          <svg className="mr-2 h-4 w-4 animate-spin" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" opacity="0.25" />
            <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" opacity="0.75" />
          </svg>
          Saving...
        </>
      ) : (
        "Save changes"
      )}
    </button>
  );
}
```

---

## Server-Side Validation Errors

When the server returns validation errors that Zod cannot catch (uniqueness, business rules):

```tsx
// API response shape
interface ApiValidationError {
  status: 422;
  errors: Record<string, string[]>;
}

// Map server errors to React Hook Form
function applyServerErrors<T extends FieldValues>(
  form: UseFormReturn<T>,
  serverErrors: Record<string, string[]>
) {
  for (const [field, messages] of Object.entries(serverErrors)) {
    if (field in form.getValues()) {
      form.setError(field as FieldPath<T>, {
        type: "server",
        message: messages[0], // Display first error
      });
    }
  }

  // Focus the first errored field
  const firstErrorField = Object.keys(serverErrors)[0];
  if (firstErrorField) {
    form.setFocus(firstErrorField as FieldPath<T>);
  }
}
```

---

## Accessibility Checklist for Forms

| Requirement | Implementation |
|-------------|---------------|
| Every input has a visible `<label>` | Use `htmlFor` matching input `id` |
| Required fields are indicated | Visual asterisk + `aria-required="true"` or `required` attribute |
| Error messages are associated | `aria-describedby` pointing to error element `id` |
| Invalid state is communicated | `aria-invalid="true"` on errored inputs |
| Error messages use `role="alert"` | Screen readers announce errors immediately |
| Form groups use `<fieldset>` + `<legend>` | Radio groups, checkbox groups, related field sets |
| Submit button indicates loading | `aria-busy="true"` + visible loading text |
| Autocomplete attributes are set | `autoComplete="email"`, `autoComplete="new-password"`, etc. |
| Tab order is logical | No positive `tabIndex`, natural DOM order |
| Error summary links to fields | On submit failure, focus error summary with field links |
