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

Token values use the shapes of the [DTCG 2025.10 format](https://www.designtokens.org/tr/2025.10/format/): a color is `{ colorSpace, components, alpha?, hex? }`, and a dimension and a duration are a number with a unit, `{ value: 14, unit: "px" }` and `{ value: 200, unit: "ms" }`.

```ts
import { Library, refs } from "design-token-library";

const $ = refs<IMyLibrary>();

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
      $value: "Helvetica"
    },
    body: {
      $type: DesignToken.Type.Typography
      $value: {
        fontFamily: $.typography.base, // Alias
        fontSize: { value: 14, unit: "px" },
        fontWeight: 400,
        letterSpacing: { value: 0, unit: "px" },
        lineHeight: 1.3,
      }
    },
  }
};
```

### Tokens

Each token in the library must have a `$value` property, and groups must not have a `$value`. Tokens can be assigned three types of values: **static**, **alias**, and **computed**.

```ts
import { recipes, refs } from "design-token-library";

interface Colors {
  static: DesignToken.Color;
  alias: DesignToken.Color;
  computed: DesignToken.Color;
}

const $ = refs<Colors>();
const Recipes = recipes({ darken: darkenColor }); // darkenColor(color: Color, amount: number): Color

const config: Library.Config<Colors> = {
  static: {
    $type: DesignToken.Type.Color,
    $value: { colorSpace: "srgb", components: [1, 1, 1] },
  },
  alias: {
    $type: DesignToken.Type.Color,
    $value: $.static, // alias to the 'static' token
  },
  computed: {
    $type: DesignToken.Type.Color,
    $value: Recipes.darken($.alias, 0.3), // darken the value of the 'alias' token
  },
};
```

An alias or a computed value is resolved when its token is read, and again when a token it read changes. It can be anywhere in a value, such as a property of a border or an element of a gradient. Both are data, the path of a token and the name and arguments of a recipe, so a library's config can be serialized. A function is never a value: a function given as one is an error, at compile time and when the library is created. An object that isn't plain data, such as a class instance, a `Date` or a `Map`, is a value as it is: it's neither copied nor searched for aliases or computed values.

#### Aliases

An alias refers to another token, and has its value. `refs<T>()` makes a ref to each token of a library of shape `T`, at the token's path. It doesn't need the library, so the refs are made once and used in any config of that shape. A path is always the same ref.

A ref has the value type of its token, so `$.static` can't be the value of a dimension, and a ref can only be given to a library that has its token, with a value of that type. That's true of a library whose type is inferred from its config, as in `Library.create({ ... })` without a type argument: a ref of a shape such as `refs<{ static: DesignToken.Color }>()` can be given to it.

#### Recipes

A computed value calls a function of other tokens' values. Its arguments are evaluated when the config is built, before the library exists, so `darkenColor($.alias, 0.3)` can't be given the value. `recipes()` makes a recipe of each function of an object, named by its key. A recipe takes its function's arguments, any of which may be refs, computed values, or values with them in it, and returns the computed value:

```ts
export const Recipes = recipes({ darken: darkenColor, lighten: lightenColor });

computed: { $type: DesignToken.Type.Color, $value: Recipes.darken($.alias, 0.3) },
hover: { $type: DesignToken.Type.Color, $value: Recipes.darken(Recipes.darken($.alias, 0.3), 0.1) },
```

The function is called when the token is read and again when a token it reads changes, so it must be pure. Its arguments are all resolved before it's called, so it depends on each of them. The arguments are type-checked against the function's parameters, and the result against the token's type. A set of recipes is extended by spreading it:

```ts
export const MyRecipes = { ...Recipes, ...recipes({ tint: tintColor }) };

$value: MyRecipes.tint($.static, 0.2);
```

### Groups

In alignment with the [DTCG Group](https://www.designtokens.org/tr/2025.10/format/#type-1) specification, token groups _may_ define a `$type` field. All tokens part of the group will infer their type from the group unless they define their own type.

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
  primary: { $value: { colorSpace: "srgb", components: [1, 1, 1] } }, // inherits "color"
  borders: {
    $type: DesignToken.Type.Border,
    thin: {
      $value: {
        color: { colorSpace: "srgb", components: [0, 0, 0] },
        width: { value: 1, unit: "px" },
        style: "solid",
      },
    },
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
    $root: { $value: { colorSpace: "srgb", components: [0, 0, 0] } }, // --color
    light: {
      $value: { colorSpace: "srgb", components: [1, 1, 1] },
      $deprecated: "use $root", // --color-light
    },
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

Custom tokens support everything standard tokens do: static values, aliases, deep aliases into their properties, computed values, group type inheritance, `set()`, and `extend()`:

```ts
const $ = refs<MyLibrary>();
const { raise } = recipes({
  raise: (elevation: Elevation, level: number) => ({ ...elevation, level }),
});

const library = Library.create<MyLibrary>({
  colors: {
    neutral: {
      $type: DesignToken.Type.Color,
      $value: { colorSpace: "srgb", components: [1, 1, 1] },
    },
  },
  elevations: {
    $type: "elevation",
    flat: {
      $value: {
        level: 0,
        shadow: {
          color: $.colors.neutral, // deep alias
          offsetX: { value: 0, unit: "px" },
          offsetY: { value: 0, unit: "px" },
          blur: { value: 0, unit: "px" },
          spread: { value: 0, unit: "px" },
        },
      },
    },
    raised: {
      $value: raise($.elevations.flat, 1),
    },
  },
});

library.tokens.elevations.raised.$value;
// {
//   level: 1,
//   shadow: {
//     color: { colorSpace: "srgb", components: [1, 1, 1] },
//     offsetX: { value: 0, unit: "px" },
//     offsetY: { value: 0, unit: "px" },
//     blur: { value: 0, unit: "px" },
//     spread: { value: 0, unit: "px" },
//   },
// }
library.tokens.elevations.raised.$type; // "elevation", inherited from the group
```

Custom types have two restrictions, both enforced at compile time:

- `Name` can't be a DTCG type name such as `"color"`.
- `Value` is data: a primitive, an array, a plain object, or a class instance. An object may have methods and function properties, which the library never calls, but the value can't be a function: a value computed by a function is a recipe's. A function isn't written by `toString()`, so a value with functions is converted to CSS with its converter.

#### CSS

`toCSS` requires a converter for each custom type in the library. Each converter receives the token's resolved value and the token:

```ts
const css = toCSS(library, {
  converters: {
    elevation: (value, token) => `${value.level}`,
  },
});
```

A custom type that has no CSS form, such as data used only by aliases, can be left out of the CSS with `false` in place of a converter. Tokens of that type aren't written, and every custom type still needs an entry. Pass the same `converters` to `toProperties` to leave them out of its result too:

```ts
const options = {
  converters: {
    elevation: (value, token) => `${value.level}`,
    palette: false,
  },
};
const css = toCSS(library, options);
const properties = toProperties(library, options);
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
library.tokens.colors.foreground.set({ colorSpace: "srgb", components: [0.93, 0.93, 0.93] });
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
library.tokens.foreground.set({ colorSpace: "srgb", components: [0.53, 0.53, 0.53] });
```

Change notifications are batched and subscribers get notified each microtask. It's important to note that token values are lazily evaluated. If a computed or alias token has not been accessed, it will **not** notify itself to subscribers even if it's dependencies change:

```ts
const $ = refs<{ a: DesignToken.Color; b: DesignToken.Color }>();
const library = Library.create({
  a: { $type: DesignToken.Type.Color, $value: { colorSpace: "srgb", components: [0, 0, 0] } },
  b: { $type: DesignToken.Type.Color, $value: $.a },
});

library.subscribe({
  onChange(tokens) {
    /* ... */
  },
});

// Will only notify 'library.tokens.a'
library.tokens.a.set({ colorSpace: "srgb", components: [1, 1, 1] });

const b = library.tokens.b.$value;

// Will now notify with 'library.tokens.a' and 'library.tokens.b'
library.tokens.a.set({ colorSpace: "srgb", components: [0.07, 0.07, 0.07] });
```

### CSS

`toCSS` and `toProperties` convert the DTCG value shapes to CSS. An sRGB color becomes hex (`#ff8000`) and a color in another color space becomes the CSS `color()` function, or `hsl()`, `hwb()`, `lab()`, `lch()`, `oklab()` or `oklch()`. Dimensions and durations are written with their unit, font weight keywords become numbers, a cubic Bézier becomes `cubic-bezier()`, a transition uses CSS shorthand order, and a shadow may be layered and inset. A standard type with no converter, such as typography, is written as JSON.

A group's `$root` token is named for the group, so `color.$root` is `--color`.
