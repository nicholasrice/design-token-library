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

## Cost and lifetime

An extension is cheap to make: its tokens are made when they are first read, except those its config gives, which are checked when `extend()` is called. Walking it with `entriesOf()`, writing its CSS or calling `dependentsOf()` on one of its tokens makes all of them.

The library an extension extends refers to it only weakly, so an extension that nothing else refers to is collected, and its subscribers are no longer called. A design system can make an extension for each part of a page and drop it when the part goes. To keep getting notifications, keep the extension, not only its subscriber.

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

## What an extension changes

[`changesOf()`](/design-token-library/api-reference/design-token-library.changesof) lists the tokens of an extension that differ from the library it extends: the tokens it gives a value, whether in its config or with `set()`, the tokens that are new in it, the tokens that call a recipe it replaces, and the tokens that depend on any of those, through other tokens too. The others follow the library they extend.

```ts
const dark = library.extend({ color: { context: { $value: black } } });

changesOf(dark).map((token) => token.name);
// ["color.context", "color.fill", ...]
```

It reads the configured values and not the values, so it resolves no token. A token that depends on a changed token is listed even if its value turns out the same. A tool that writes an extension inside what it extends, such as CSS inside the CSS of the library it extends, writes only these: see `changesOnly` in [CSS output](../export/css-output).

## Read-only surface

The extended library's `tokens` tree is frozen. Token metadata and `$value` on the token objects are read-only; use `.set()` to change values.
