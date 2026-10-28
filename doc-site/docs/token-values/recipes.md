# Recipes

A computed value calls a function over other tokens' values. Arguments are evaluated when the config is built, before the library exists, so `Recipes.darken(ref("alias"), 0.3)` is not given resolved values at config time.

`recipes()` wraps each function in an object, keyed by name. A recipe accepts refs, nested computed values, or plain values containing refs, and returns the computed result:

```ts
export const Recipes = recipes({
  darken: (color: DesignToken.Values.Readonly.Color, amount: number) =>
    /* darkened color */,
  lighten: (color: DesignToken.Values.Readonly.Color, amount: number) =>
    /* lightened color */,
});

computed: { $type: DesignToken.Type.Color, $value: Recipes.darken(ref("alias"), 0.3) },
hover: {
  $type: DesignToken.Type.Color,
  $value: Recipes.darken(Recipes.darken(ref("alias"), 0.3), 0.1),
},
```

The function runs when the token is read and again when a dependency changes, so it must be pure. Arguments are fully resolved before the call. Ref values and copies of plain data are frozen; other values (such as class instances) are passed through. Type parameters as `DesignToken.Values.Readonly.Color`. Arguments and return types are checked against the token's `$type`.

A computed value is data: the recipe, its name, and its arguments. Extend a recipe set by spreading:

```ts
export const MyRecipes = {
  ...Recipes,
  ...recipes({
    tint: (color: DesignToken.Values.Readonly.Color, amount: number) =>
      /* tinted color */,
  }),
};
```

## Class values

A recipe can construct a class from resolved fields:

```ts
const { elevation } = recipes({
  elevation: (fields: { level: number; blur: DesignToken.Values.Readonly.Dimension }) =>
    new Elevation(fields.level, fields.blur),
});

raised: {
  $value: elevation({ level: ref("scale.step2"), blur: { value: 4, unit: "px" } }),
},
```

## Overriding a recipe

A library from [`extend()`](../advanced/extending) can replace a recipe's function for every token that uses it, including tokens not restated in the [extension](../advanced/extending#overrides). `override()` checks argument and return types:

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

The source library is unchanged ([`extend()`](../advanced/extending) never mutates it); [descendants](../advanced/extending#independence-and-updates) keep the override unless they override again.
