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

## API reference

- [`toCSS()`](/design-token-library/api-reference/design-token-library.tocss)
- [`toProperties()`](/design-token-library/api-reference/design-token-library.toproperties)
- [`convert()`](/design-token-library/api-reference/design-token-library.convert)
- [`CSSConverter`](/design-token-library/api-reference/design-token-library.cssconverter)
- [`CSSConverterEntries`](/design-token-library/api-reference/design-token-library.cssconverterentries)
