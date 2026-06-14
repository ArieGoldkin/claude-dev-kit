# Forms & Inputs

## Table of Contents
- [FieldGroup + Field layout](#fieldgroup--field-layout)
- [InputGroup with InputGroupInput/InputGroupTextarea](#inputgroup)
- [Buttons inside inputs with InputGroupAddon](#buttons-inside-inputs)
- [ToggleGroup for 2-7 options](#togglegroup-for-2-7-options)
- [FieldSet + FieldLegend for grouping](#fieldset--fieldlegend)
- [Validation and disabled states](#validation-and-disabled-states)
- [Form control selection](#form-control-selection)

## FieldGroup + Field layout

Always use `FieldGroup` + `Field` — never raw `div` with `space-y-*`:

```tsx
<FieldGroup>
  <Field>
    <FieldLabel htmlFor="email">Email</FieldLabel>
    <Input id="email" type="email" />
  </Field>
  <Field>
    <FieldLabel htmlFor="password">Password</FieldLabel>
    <Input id="password" type="password" />
  </Field>
</FieldGroup>
```

Use `Field orientation="horizontal"` for settings pages. Use `FieldLabel className="sr-only"` for visually hidden labels.

## InputGroup

Never use raw `Input` or `Textarea` inside an `InputGroup`.

```tsx
// WRONG
<InputGroup>
  <Input placeholder="Search..." />
</InputGroup>

// CORRECT
import { InputGroup, InputGroupInput } from "@/components/ui/input-group"

<InputGroup>
  <InputGroupInput placeholder="Search..." />
</InputGroup>
```

## Buttons inside inputs

Use `InputGroupAddon` — never absolute positioning:

```tsx
// WRONG
<div className="relative">
  <Input className="pr-10" />
  <Button className="absolute right-0 top-0" size="icon">
    <SearchIcon />
  </Button>
</div>

// CORRECT
<InputGroup>
  <InputGroupInput placeholder="Search..." />
  <InputGroupAddon>
    <Button size="icon">
      <SearchIcon data-icon="inline-start" />
    </Button>
  </InputGroupAddon>
</InputGroup>
```

## ToggleGroup for 2-7 options

Don't manually loop Buttons with active state:

```tsx
// WRONG
const [selected, setSelected] = useState("daily")
{["daily", "weekly", "monthly"].map((opt) => (
  <Button variant={selected === opt ? "default" : "outline"} onClick={() => setSelected(opt)}>{opt}</Button>
))}

// CORRECT
<ToggleGroup spacing={2}>
  <ToggleGroupItem value="daily">Daily</ToggleGroupItem>
  <ToggleGroupItem value="weekly">Weekly</ToggleGroupItem>
  <ToggleGroupItem value="monthly">Monthly</ToggleGroupItem>
</ToggleGroup>
```

Combine with `Field` for labelled toggle groups:

```tsx
<Field orientation="horizontal">
  <FieldTitle id="theme-label">Theme</FieldTitle>
  <ToggleGroup aria-labelledby="theme-label" spacing={2}>
    <ToggleGroupItem value="light">Light</ToggleGroupItem>
    <ToggleGroupItem value="dark">Dark</ToggleGroupItem>
  </ToggleGroup>
</Field>
```

Note: `defaultValue` and `type`/`multiple` props differ between base and radix. See base-vs-radix.md.

## FieldSet + FieldLegend

Use for related checkboxes, radios, or switches:

```tsx
<FieldSet>
  <FieldLegend variant="label">Preferences</FieldLegend>
  <FieldDescription>Select all that apply.</FieldDescription>
  <FieldGroup className="gap-3">
    <Field orientation="horizontal">
      <Checkbox id="dark" />
      <FieldLabel htmlFor="dark" className="font-normal">Dark mode</FieldLabel>
    </Field>
  </FieldGroup>
</FieldSet>
```

## Validation and disabled states

Both attributes needed — `data-invalid`/`data-disabled` styles the field, `aria-invalid`/`disabled` styles the control:

```tsx
// Invalid
<Field data-invalid>
  <FieldLabel htmlFor="email">Email</FieldLabel>
  <Input id="email" aria-invalid />
  <FieldDescription>Invalid email address.</FieldDescription>
</Field>

// Disabled
<Field data-disabled>
  <FieldLabel htmlFor="email">Email</FieldLabel>
  <Input id="email" disabled />
</Field>
```

## Form control selection

| Need | Component |
|------|-----------|
| Simple text | `Input` |
| Dropdown (predefined) | `Select` |
| Searchable dropdown | `Combobox` |
| Native HTML select | `native-select` |
| Boolean toggle | `Switch` (settings) or `Checkbox` (forms) |
| Single choice (few options) | `RadioGroup` |
| Toggle 2-5 options | `ToggleGroup` + `ToggleGroupItem` |
| OTP/verification | `InputOTP` |
| Multi-line text | `Textarea` |
