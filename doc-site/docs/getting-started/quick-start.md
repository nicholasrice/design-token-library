---
slug: /
sidebar_position: 1
---

# Introduction

`design-token-library` is a TypeScript library for managing design tokens. Its interface is based on the [Design Token Community Group (DTCG)](https://www.designtokens.org/) and aims to be a lightweight, type-safe library with core behavior that works in any JavaScript runtime.

The library supports:

1. [Design token aliasing](/design-token-library/token-values/refs)
2. [Computed values](/design-token-library/token-values/recipes)
3. [Lazy value evaluation](/design-token-library/advanced/subscriptions#lazy-evaluation)
4. [Change subscription](/design-token-library/advanced/subscriptions#change-subscription)
5. [Library extension](/design-token-library/advanced/extending)

## Installation

Install from the npm registry with your package manager of choice.

```
npm install design-token-library
```

## Library interface

The following assumes TypeScript. In JavaScript, skip type-only steps and remove typings from samples.

Define the hierarchy for your tokens with `DesignToken`. Nesting depth and sub-interfaces are up to you.

First, import `DesignToken`:

```ts
import { type DesignToken } from "design-token-library";
```

```ts
export interface IMyLibrary {
  colors: {
    foreground: DesignToken.Color;
    background: DesignToken.Color;
  };
  typography: {
    base: DesignToken.FontFamily;
    body: DesignToken.Typography;
  };
}
```

For all built-in token types, see the [API reference](/design-token-library/api-reference/design-token-library.designtoken#type-aliases).

## Library config

Build a config that matches your interface. Token values follow the [DTCG 2025.10 format](https://www.designtokens.org/tr/2025.10/format/): colors use `{ colorSpace, components, alpha?, hex? }`; dimensions and durations use `{ value, unit }`.

```ts
import { Library, ref } from "design-token-library";

const myLibraryConfig: Library.Config<IMyLibrary> = {
  colors: {
    foreground: {
      $type: DesignToken.Type.Color,
      $value: { colorSpace: "srgb", components: [0, 0, 0] },
    },
    background: {
      $type: DesignToken.Type.Color,
      $value: { colorSpace: "srgb", components: [1, 1, 1] },
    },
  },
  typography: {
    base: {
      $type: DesignToken.Type.FontFamily,
      $value: "Helvetica",
    },
    body: {
      $type: DesignToken.Type.Typography,
      $value: {
        fontFamily: ref("typography.base"),
        fontSize: { value: 14, unit: "px" },
        fontWeight: 400,
        letterSpacing: { value: 0, unit: "px" },
        lineHeight: 1.3,
      },
    },
  },
};
```

Each token needs a `$value`; groups must not. Values can be static, [aliases (refs)](./token-values/refs), or [computed (recipes)](./token-values/recipes). See [Library config](./configuration/library-config) for rules and examples.

## Create and use a library

```ts
const library = Library.create(myLibraryConfig);

const value = library.tokens.colors.foreground.$value;

library.tokens.colors.foreground.set({
  colorSpace: "srgb",
  components: [0.93, 0.93, 0.93],
});
```

The library reconciles aliases and computed values when tokens change, can [notify subscribers](./advanced/subscriptions), and supports [theming via `extend()`](./advanced/extending). For CSS export, see [CSS output](./export/css-output) ([`toCSS()`](/design-token-library/api-reference/design-token-library.tocss), [`toProperties()`](/design-token-library/api-reference/design-token-library.toproperties)).
