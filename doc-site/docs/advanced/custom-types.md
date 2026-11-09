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

Every custom type is registered with the library, with an `isEqual` that tells whether two of its values are equal. Custom tokens support static values, aliases, deep aliases into properties, computed values, group type inheritance, `set()`, and [`extend()`](./extending):

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
}, {
  types: {
    elevation: { isEqual: (a, b) => a.level === b.level },
  },
});

library.tokens.elevations.raised.$type; // "elevation", from the group
```

`Name` cannot be a DTCG type name such as `"color"` (compile-time check).

## Registering a type

`create()` throws for a token whose custom type isn't in `types`, and the config doesn't compile without it. `isEqual` gets the type's values, typed by the tokens that have it. A library with a subscriber calls it when a token of the type resolves again: when it returns `true`, the token keeps the value it had, so it is the same object (see [Value semantics](../token-values/value-semantics#equal-values)). The DTCG types have their own equality and can't be registered.

An extension inherits the types of the library it extends, and registers only the custom types its new tokens add. It can't register an inherited type again, at any depth, since the libraries that extend it rely on the same equality. Two extensions of one library can each register the same new type:

```ts
const themed = library.extend(
  { stacking: { $type: "z-index", $value: 10 } },
  { types: { "z-index": { isEqual: (a, b) => a === b } } },
);
``` `Value` may be any shape, including objects with methods the library never calls. Values with functions rely on a [custom converter](./custom-types#css-converters) for CSS output because `toString()` is not used.

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
