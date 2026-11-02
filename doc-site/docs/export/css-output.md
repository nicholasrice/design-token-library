# CSS output

[`toCSS()`](/design-token-library/api-reference/design-token-library.tocss) and [`toProperties()`](/design-token-library/api-reference/design-token-library.toproperties) convert DTCG value shapes to CSS. Options are typed as [`ToCSSArgs`](/design-token-library/api-reference/design-token-library.tocssargs) and [`ToPropertiesOptions`](/design-token-library/api-reference/design-token-library.topropertiesoptions).

Standard-type formatting (when no custom converter overrides a type):

- sRGB colors → hex (`#ff8000`); other color spaces → `color()`, or `hsl()`, `hwb()`, `lab()`, `lch()`, `oklab()`, `oklch()` as appropriate
- Dimensions and durations → value with unit
- Font weight keywords → numbers
- Cubic Bézier → `cubic-bezier()`
- Transition → CSS shorthand order
- Shadow → layered, optional inset
- Number → written as-is
- Typography → `font` shorthand (no `letterSpacing` in that shorthand)

A group's `$root` token maps to a custom property named for the group, so `color.$root` becomes `--color`.

[Custom types](../advanced/custom-types#css-converters) need a [`converters`](/design-token-library/api-reference/design-token-library.topropertiesoptions.converters) map ([`CSSConverterEntries`](/design-token-library/api-reference/design-token-library.cssconverterentries)) on both functions. Inside a custom converter, [`convert()`](/design-token-library/api-reference/design-token-library.convert) applies the same rules as `toCSS` for a standard type.

## A token as more than one property

A converter can return a record instead of a string, to write a token as more than one custom property. Each key is added to the name of the token's property with `-`, and `""` is the token's own property:

```ts
const converters = {
  states: (value: States) => ({
    "": convert("color", value.rest),
    hover: convert("color", value.hover),
    active: convert("color", value.active),
  }),
};

toCSS(library, { converters });
// --fill:#111111;--fill-hover:#222222;--fill-active:#333333;

const properties = toProperties(library, { converters });
properties.fill.var; // "var(--fill)"
properties.fill.hover.var; // "var(--fill-hover)"
```

A string is the same as `{ "": value }`, and an empty record writes nothing for the token. A replacement converter for a standard type can return one too, such as a typography written as a property for each of its fields rather than the `font` shorthand.

`toProperties()` calls the converters it is given to know the keys, so it reads the values of those tokens, and only those. The keys are in its type when the return type of the converter is inferred, as above. A converter typed `CSSConverter` returns any record, so the token has only its own property in the type, and the others at runtime. A key can't be `var` or `property`, the fields of the token's own property. A key can also name the same property as another token's: `fill` with a key `hover` and a token `fill.hover` are both `--fill-hover`.

## API reference

- [`toCSS()`](/design-token-library/api-reference/design-token-library.tocss)
- [`toProperties()`](/design-token-library/api-reference/design-token-library.toproperties)
- [`convert()`](/design-token-library/api-reference/design-token-library.convert)
- [`CSSConverter`](/design-token-library/api-reference/design-token-library.cssconverter)
- [`CSSValues`](/design-token-library/api-reference/design-token-library.cssvalues)
- [`CSSConverterEntries`](/design-token-library/api-reference/design-token-library.cssconverterentries)
