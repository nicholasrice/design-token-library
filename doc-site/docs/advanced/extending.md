# Extending libraries

`library.extend(config, options?)` returns a new library that copies the source, applies token overrides and additions from `config`, and optionally replaces [recipe functions](../token-values/recipes#overriding-a-recipe). The source library is never mutated.

```ts
const dark = base.extend<{}>({
  colors: {
    foreground: { $value: { colorSpace: "srgb", components: [0.9, 0.9, 0.9] } },
  },
});
```

Pass a type argument for new tokens so paths and types are checked: `extend<{ c: DesignToken.Color }>({ c: { ... } })`.

## Overrides

Restate only the tokens you want to change. Nested groups merge the same way:

```ts
const themed = base.extend<{}>({
  g: { a: { $value: { colorSpace: "srgb", components: [0.6, 0.6, 0.6] } } },
});
```

Overrides can use [refs](../token-values/refs), including deep aliases into composite values. Aliases on the extended library resolve against **that** library's values, so overriding `a` updates a token that refs `a`.

You cannot change a token's `$type` in an override. Value-only overrides keep the source's `$description` and `$extensions`; when you supply `$extensions`, keys merge shallowly (override keys win at the top level).

## New tokens and groups

Add tokens or empty groups with the same config shapes as `Library.create`. New tokens in a group with a literal inherited `$type` may omit `$type`. Token order on the extended library is source keys first, then new keys.

## Independence and updates

Sibling extensions of one source do not affect each other. Changing the source still updates extended libraries that inherit a token—until that token is updated on the extended library.

Calling `.set()` on an inherited token **detaches** it from the source: later `set()` on the source no longer updates the extended copy, and the extended library stops receiving change notifications for that token from the source. Subscribers on the extended library are separate from the source.

Chained `extend()` calls stack: changes on the original source propagate through intermediate libraries to the last one, including overrides applied in the middle of the chain.

## Recipe overrides

Pass recipe replacements in the second argument:

```ts
import { override } from "design-token-library";

const highContrast = library.extend({}, {
  recipes: [
    override(
      Recipes.darken,
      (color: DesignToken.Values.Readonly.Color, amount: number) =>
        /* darker color */,
    ),
  ],
});
```

Details of `override()` are in [Recipes — Overriding a recipe](../token-values/recipes#overriding-a-recipe).

## Read-only surface

The extended library's `tokens` tree is frozen. Token metadata and `$value` on the token objects are read-only; use `.set()` to change values.
