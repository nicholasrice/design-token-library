# Custom types

Token types outside DTCG use `DesignToken.Custom<Name, Value>`. `Name` identifies the type; `Value` is the value shape:

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

Custom tokens support static values, aliases, deep aliases into properties, computed values, group type inheritance, `set()`, and [`extend()`](./extending):

```ts
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
          color: ref("colors.neutral"),
          offsetX: { value: 0, unit: "px" },
          offsetY: { value: 0, unit: "px" },
          blur: { value: 0, unit: "px" },
          spread: { value: 0, unit: "px" },
        },
      },
    },
    raised: { $value: ref("elevations.flat") },
  },
});

library.tokens.elevations.raised.$type; // "elevation", from the group
```

`Name` cannot be a DTCG type name such as `"color"` (compile-time check). `Value` may be any shape, including objects with methods the library never calls. Values with functions rely on a [custom converter](./custom-types#css-converters) for CSS output because `toString()` is not used.

## CSS converters

[`toCSS()`](/design-token-library/api-reference/design-token-library.tocss) requires a [`converters`](/design-token-library/api-reference/design-token-library.topropertiesoptions.converters) entry for each custom type in the library. Each [`CSSConverter`](/design-token-library/api-reference/design-token-library.cssconverter) receives the resolved value and the token:

```ts
const css = toCSS(library, {
  converters: {
    elevation: (value, token) => `${value.level}`,
  },
});
```

Use `false` instead of a converter to omit a type from CSS (for example palette data used only for aliases). Every custom type still needs an entry. Pass the same `converters` to [`toProperties()`](/design-token-library/api-reference/design-token-library.toproperties) to omit those tokens there too:

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

For custom values that contain standard token shapes, use [`convert()`](/design-token-library/api-reference/design-token-library.convert) inside the converter:

```ts
const css = toCSS(library, {
  converters: {
    elevation: (value) =>
      `${convert("dimension", value.offset)} ${convert("color", value.color)}`,
  },
});
```

`converters` may also override built-in types—for example emit `rgb()` instead of hex for colors. See [CSS output](../export/css-output) for standard-type formatting and links to the full CSS API.
