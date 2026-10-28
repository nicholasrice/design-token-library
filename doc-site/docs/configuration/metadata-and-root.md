# Metadata and `$root`

Tokens and groups share DTCG property names: `$type`, `$description`, `$extensions`, and `$deprecated`. A token's `$deprecated` is `false` unless set to `true` or a string explaining why.

Group properties are available on the group but are not enumerable, so they never appear when iterating a group's tokens. Group properties are kept when a library is [extended](../advanced/extending).

## `$root` tokens

A group can have a token named `$root`. It must live inside a group: a library cannot have `$root` at the top level, and `Library.create` and [`extend`](../advanced/extending) reject one at compile time and at runtime. Its CSS custom property is named for the group:

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
    $root: { $value: { colorSpace: "srgb", components: [0, 0, 0] } },
    light: {
      $value: { colorSpace: "srgb", components: [1, 1, 1] },
      $deprecated: "use $root",
    },
  },
});

library.tokens.color.$root.name; // "color.$root"
library.tokens.color.light.$deprecated; // "use $root"
```

See [CSS output](../export/css-output) for how `$root` names map to custom properties ([`toCSS()`](/design-token-library/api-reference/design-token-library.tocss)).
