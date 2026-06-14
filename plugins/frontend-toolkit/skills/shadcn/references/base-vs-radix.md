# Base vs Radix API Differences

## Table of Contents
- [Composition pattern](#composition-pattern)
- [Non-button elements](#non-button-elements)
- [Select](#select)
- [ToggleGroup](#togglegroup)
- [Slider](#slider)
- [Accordion](#accordion)

## Composition pattern

| Library | Pattern |
|---------|---------|
| Radix | `<DialogTrigger asChild><Button /></DialogTrigger>` |
| Base | `<DialogTrigger render={<Button />}>Open</DialogTrigger>` |

Don't wrap triggers in extra elements.

## Non-button elements

When base's `render` prop changes an element to a non-button (`<a>`, `<span>`), add `nativeButton={false}`.

## Select

| Feature | Base | Radix |
|---------|------|-------|
| Items | `items` prop on root | Inline JSX children |
| Placeholder | `{ value: null }` item | `placeholder` attribute |
| Content position | `alignItemWithTrigger` | `position` |
| Multiple selection | `multiple` prop | Not supported |
| Object values | `itemToStringValue` prop | Not supported |

## ToggleGroup

| Feature | Base | Radix |
|---------|------|-------|
| Multiple | `multiple` boolean | `type="single"` or `type="multiple"` |

## Slider

| Feature | Base | Radix |
|---------|------|-------|
| Single thumb | `defaultValue={50}` (plain number) | `defaultValue={[50]}` (always array) |

## Accordion

| Feature | Base | Radix |
|---------|------|-------|
| Type | Omit `type`, use `multiple` boolean | `type="single"` or `type="multiple"` |
| Default value | Array: `defaultValue={["item-1"]}` | String: `defaultValue="item-1"` |
