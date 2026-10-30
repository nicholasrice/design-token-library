# Configured values

A token's `$value` is resolved: its refs are replaced by their tokens' values and its computed values by their recipes' results. A tool that reads how a library is configured, rather than what its values are, needs the value as it was given.

## `configuredValueOf()`

[`configuredValueOf(token)`](/design-token-library/api-reference/design-token-library.configuredvalueof) is a token's value as configured, or as last given to `set()`, with its refs and computed values unresolved. A token of an [extended](./extending) library that isn't given a value has its source token's, and follows the source's `set()`, as its value does.

[`isRef()`](/design-token-library/api-reference/design-token-library.isref) and [`isComputed()`](/design-token-library/api-reference/design-token-library.iscomputed) tell refs and computed values apart from other values. A token whose configured value has neither, at any depth, is given; any other is derived from other tokens or by a recipe:

```ts
import { configuredValueOf, isComputed, isRef } from "design-token-library";

const isGiven = (value: unknown): boolean =>
  !isRef(value) &&
  !isComputed(value) &&
  (typeof value !== "object" ||
    value === null ||
    Object.values(value).every(isGiven));

// primary: { $value: hex("#336699") }
isGiven(configuredValueOf(library.tokens.colors.primary)); // true
// hover: { $value: Recipes.darken(theme.colors.primary, 0.2) }
isGiven(configuredValueOf(library.tokens.colors.hover)); // false
```

A design tool can offer only the given tokens for editing. The rule follows the library: replacing a recipe with a literal in `extend()` makes the token given.

The configured value is the one the token holds, not a copy, so it isn't frozen. Give a new value to `set()` rather than changing it.

## Writing a ref as a `var()`

A [CSS converter](./custom-types#css-converters) gets the resolved value and the token. For a value that refers to other tokens, it can read the refs from the configured value and write each as a `var()`, so the CSS follows the token in every scope:

```ts
const css = toCSS(library, {
  converters: {
    // control: { $type: "treatment", $value: { background: theme.colors.hover } }
    treatment: (value, token) => {
      const configured = configuredValueOf(token);

      return !isRef(configured) &&
        !isComputed(configured) &&
        isRef(configured.background)
        ? `var(--${pathOf(configured.background).join("-")})`
        : convert("color", value.background);
    },
  },
});
```

A position that holds a literal or a computed value has no token to refer to, so the converter writes the resolved value there.

