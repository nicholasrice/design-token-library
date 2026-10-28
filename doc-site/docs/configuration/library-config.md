# Library config

The config is the initial shape and values of the library. It uses the same `$`-prefixed fields as [DTCG](https://www.designtokens.org/tr/2025.10/format/).

## Tokens

Each token must have a `$value`. Groups must not.

```ts
import { recipes, ref } from "design-token-library";

interface Colors {
  static: DesignToken.Color;
  alias: DesignToken.Color;
  computed: DesignToken.Color;
}

const Recipes = recipes({
  darken: (color: DesignToken.Values.Readonly.Color, amount: number) =>
    /* darkened color */,
});

const config: Library.Config<Colors> = {
  static: {
    $type: DesignToken.Type.Color,
    $value: { colorSpace: "srgb", components: [1, 1, 1] },
  },
  alias: {
    $type: DesignToken.Type.Color,
    $value: ref("static"),
  },
  computed: {
    $type: DesignToken.Type.Color,
    $value: Recipes.darken(ref("alias"), 0.3),
  },
};
```

- [Refs](../token-values/refs) — alias another token by path
- [Recipes](../token-values/recipes) — derive values from other tokens
- [Value semantics](../token-values/value-semantics) — copying, freezing, and non-plain values
