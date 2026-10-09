---
sidebar_position: 3
---

# Getting Started

This section will guide you through getting started with `design-token-library`.

> The following instructions assume TypeScript. If you're using JavaScript, skip the steps related to TypeScript and remove typings from code-samples where necessary.

## Library Interface

The first step is to define the interface for the design token library. This is done using `DesignToken`.

First, import `DesignToken`

```ts
import { type DesignToken } from "design-token-library";
```

Next, define the hierarchy of the library. This hierarchy is arbitrary, so choose whichever hierarchy works for you. Hierarchies can also have arbitrary levels of nesting, and can be divided into sub-interfaces if desired.

> For a complete list of available token-types, see [here](/design-token-library/api-reference/design-token-library.designtoken#type-aliases).

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

## Library Config

With the Library interface defined, the concrete library config can be constructed. This config will serve as the initial configuration of the library.

```ts
import { Library } from "design-token-library";

const myLibraryConfig: Library.Config<IMyLibrary> = {
  colors: {
    foreground: {
      $type: DesignToken.Type.Color,
      $value: "#010101",
    },
    background: {
      $type: DesignToken.Type.Color,
      $value: "#FEFEFE",
    },
  },
  typography: {
    fonts: {
      $type: DesignToken.Type.FontFamily,
      $value: "Helvetica"
    },
    body: {
      $type: DesignToken.Type.Typography
      $value: {
        fontFamily: (tokens) => tokens.typography.fonts.base, // Alias
        fontSize: "14px",
        fontWeight: 400;
        letterSpacing: "0px";
        lineHeight: "18px";
      }
    },
  }
};
```

### Tokens

Each token in the library must have a `$value` property, and groups must not have a `$value`. Tokens can be assigned three types of values: **static**, **alias**, and **computed**.

```ts
interface Colors {
  static: DesignToken.Color;
  alias: DesignToken.Color;
  computed: DesignToken.Color;
}

const config: Library.Config<Colors> = {
  static: {
    $type: DesignToken.Type.Color,
    $value: "#FFFFFF",
  },
  alias: {
    $type: DesignToken.Type.Color,
    $value: (tokens) => tokens.static, // alias to the 'static' token
  },
  computed: {
    $type: DesignToken.Type.Color,
    // Operate on the value of the 'alias' token
    $value: (tokens) => darken(tokens.alias.$value, 0.3),
  },
};
```

### Groups

In alignment with the [DTCG Group](https://design-tokens.github.io/community-group/format/#type-1) specification, token groups _may_ define a `$type` field. All tokens part of the group will infer their type from the group unless they define their own type.

Type inheritance is checked at compile time. A token may omit its `$type` only when its nearest ancestor group declares a single, literal `$type` in the library interface that matches the token's type:

```ts
interface Colors {
  $type: DesignToken.Type.Color; // a literal type: descendants inherit it
  primary: DesignToken.Color;
  borders: {
    $type: DesignToken.Type.Border; // overrides the inherited type
    thin: DesignToken.Border;
  };
}

const config: Library.Config<Colors> = {
  $type: DesignToken.Type.Color,
  primary: { $value: "#FFFFFF" }, // inherits "color"
  borders: {
    $type: DesignToken.Type.Border,
    thin: { $value: { color: "#000000", width: "1px", style: "solid" } },
  },
};
```

A group declared with a non-literal `$type` (such as `DesignToken.Type`), a union, or an optional `$type` doesn't pass a type on, so its tokens must declare their own.

### Metadata, `$root` and Deprecation

Tokens and groups share the DTCG property names: `$type`, `$description`, `$extensions` and `$deprecated`. A token's `$deprecated` is `false` unless it is set to `true` or to a string explaining why. A group's properties are available on the group but are not enumerable, so they never appear when iterating a group's tokens. Group properties are kept when a library is extended.

A group can have a token of its own named `$root`. It must be in a group: a library cannot have a `$root` token at its top level, and `Library.create` and `extend` reject one at compile time and at runtime. Its CSS custom property is named for the group:

```ts
interface Theme {
  color: {
    $type: DesignToken.Type.Color;
    $root: DesignToken.Color;
    light: DesignToken.Color;
  };
}

const library = Library.create<Theme>({
  color: {
    $type: DesignToken.Type.Color,
    $root: { $value: "#111111" }, // --color
    light: { $value: "#EEEEEE", $deprecated: "use $root" }, // --color-light
  },
});

library.tokens.color.$root.name; // "color.$root"
library.tokens.color.light.$deprecated; // "use $root"
```

### Custom Types

Token types that aren't defined by the DTCG can be declared with `DesignToken.Custom<Name, Value>`. `Name` identifies the type and `Value` is the shape of its value:

```ts
interface Elevation {
  level: number;
  shadow: DesignToken.Values.Shadow;
}

type ElevationToken = DesignToken.Custom<"elevation", Elevation>;

interface MyLibrary {
  colors: { neutral: DesignToken.Color };
  elevations: {
    $type: "elevation";
    flat: ElevationToken;
    raised: ElevationToken;
  };
}
```

Custom tokens support everything standard tokens do: static values, aliases, deep aliases into their properties, group type inheritance, `set()`, and `extend()`:

```ts
const library = Library.create<MyLibrary>({
  colors: { neutral: { $type: DesignToken.Type.Color, $value: "#FFFFFF" } },
  elevations: {
    $type: "elevation",
    flat: {
      $value: {
        level: 0,
        shadow: {
          color: (tokens) => tokens.colors.neutral, // deep alias
          offsetX: "0px",
          offsetY: "0px",
          blur: "0px",
          spread: "0px",
        },
      },
    },
    raised: {
      $value: (tokens) => ({ ...tokens.elevations.flat.$value, level: 1 }),
    },
  },
});

library.tokens.elevations.raised.$value;
// { level: 1, shadow: { color: "#FFFFFF", offsetX: "0px", offsetY: "0px", blur: "0px", spread: "0px" } }
library.tokens.elevations.raised.$type; // "elevation", inherited from the group
```

Custom types have two restrictions, both enforced at compile time:

- `Name` can't be a DTCG type name such as `"color"`.
- `Value` must be serializable. Functions aren't allowed anywhere in the value, because functions in a token value are evaluated as aliases.

#### CSS

`toCSS` requires a converter for each custom type in the library. Each converter receives the token's resolved value and the token:

```ts
const css = toCSS(library, {
  converters: {
    elevation: (value, token) => `${value.level}`,
  },
});
```

## Creating a Library

With the configuration defined, the library can be created. The purpose of the library is to enable changes to token values, notify subscribers to changes, and reconciling alias and computed values with those changes.

```ts
const library = Library.create(myLibraryConfig);
```

### Reading Token Values

The value of a token can easily be read:

```ts
const value = library.tokens.colors.foreground.$value;
```

### Setting Token Values

The value of a token can be set via the `.set()` method:

```ts
library.tokens.colors.foreground.set("#EEEEEE");
```

### Subscribing to Changes

```ts
const subscriber: Library.Subscriber<IMyLibrary> = {
  onChange: (tokens) => {
    tokens.forEach((token) => {
      /* do something with tokens */
    });
  },
};
library.subscribe(subscriber);

// Will notify subscribers
library.tokens.foreground.set("#878787");
```

Change notifications are batched and subscribers get notified each microtask. It's important to note that token values are lazily evaluated. If a computed or alias token has not been accessed, it will **not** notify itself to subscribers even if it's dependencies change:

```ts
const library = Library.create({
  a: { $type: DesignToken.Type.Color, $value: "#000000" },
  b: { $type: DesignToken.Type.Color, $value: (tokens) => tokens.a },
});

library.subscribe({
  onChange(tokens) {
    /* ... */
  },
});

// Will only notify 'library.tokens.a'
library.tokens.a.set("#FFFFFF");

const b = library.tokens.b.$value;

// Will now notify with 'library.tokens.a' and 'library.tokens.b'
library.tokens.a.set("#111111");
```
