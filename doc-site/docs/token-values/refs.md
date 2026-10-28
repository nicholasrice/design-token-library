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

A ref is data (the path). The library distinguishes refs from other values with a symbol key, not by inspecting the value, so functions, class instances, and other objects remain ordinary values.
