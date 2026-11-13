# Refs

`ref("group.token")` refers to a token by its dotted path. The referred token's value is used, resolved when read and again when the target changes. A ref can appear anywhere in a value—for example a border color or a gradient stop:

```ts
border: {
  $type: DesignToken.Type.Border,
  $value: {
    color: ref("colors.primary"),
    width: { value: 1, unit: "px" },
    style: "solid",
  },
},
```

The path is type-checked where the ref is used: the library must contain a token at that path whose value matches the expected type. Typos such as `ref("colors.primry")`, or a color where a dimension is expected, are compile errors.

When the library shape is inferred (`Library.create({ ... })` without a type argument, or a new token in [`extend()`](../advanced/extending)), paths cannot be checked—pass an explicit type argument.

## `refs<T>()`

`refs<T>()` builds the same refs from a declared shape as properties: `refs<Colors>().static` is `ref("static")`. It needs no library instance, so define it once and reuse across configs:

```ts
const theme = refs<Colors>();

alias: { $type: DesignToken.Type.Color, $value: theme.static },
```

## Config shared between libraries

Refs are checked when config is passed to a library, against that library's tokens. The shapes in the config's type only say which tokens it needs, so any library that has them accepts the config. A function that makes config to share between libraries is typed by the shapes it needs, with an intersection when it needs tokens from several, and takes no type parameter for the library:

```ts
interface Colors {
  colors: { primary: DesignToken.Color };
}
interface Sizes {
  size: { hairline: DesignToken.Dimension };
}
type Outline = { $type: DesignToken.Type.Border; focus: DesignToken.Border };

const outline = (): Library.Config<Outline, Colors & Sizes> => ({
  $type: DesignToken.Type.Border,
  focus: { $value: { color: ref("colors.primary"), width: ref("size.hairline"), style: "solid" } },
});

// Any library with both Colors and Sizes takes it; one without either is a compile error.
interface Theme extends Colors, Sizes {
  outline: Outline;
}
Library.create<Theme>({
  colors: { primary: { $type: DesignToken.Type.Color, $value: { colorSpace: "srgb", components: [0, 0.4, 1] } } },
  size: { hairline: { $type: DesignToken.Type.Dimension, $value: { value: 1, unit: "px" } } },
  outline: outline(),
});
```

A type parameter for the library, as in `<Root extends Colors & Sizes>`, adds nothing, and its refs can't be checked: `refs<Root>()` and `ref()` in such a function are compile errors, because TypeScript doesn't resolve their types through the constraint.

A ref is data (the path). The library distinguishes refs from other values with a symbol key, not by inspecting the value, so functions, class instances, and other objects remain ordinary values. A token's `$value` has its refs resolved; to read them, see [Configured values](../advanced/configured-values).
