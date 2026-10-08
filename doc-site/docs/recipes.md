---
sidebar_position: 5
---

# Recipes

The DTCG format describes individual tokens. It has no concept of an
**algorithmic token** — a single declaration that expands into a whole subtree
of related tokens, such as a perceptual color ramp or the `rest` / `hover` /
`active` / `focus` colors of an interactive element.

`design-token-library` adds this with **recipes**. A recipe is a coded
_operator_ that accepts properties and returns an object; each leaf of that
object becomes a real, addressable, aliasable token grafted into the token tree.

Recipes are designed to be **JSON-serializable**: a recipe is referenced from
config declaratively, by name, with plain-data params. The algorithm itself
lives in code, registered in a `RecipeRegistry`.

## Two kinds of recipe

A recipe either produces **one token** or a **group of tokens**. Which one is
decided by the operator: a recipe with a `keys` function is a group recipe, and
one without is a value recipe.

| Kind  | `keys`  | Produces                                      | Example                  |
| ----- | ------- | --------------------------------------------- | ------------------------ |
| Value | omitted | one token, whose value is `create()`'s result | a `palette` of colors    |
| Group | present | one token per key, e.g. `rest`, `hover`, …    | interactive-state colors |

The two are called from different places, which keeps every node valid DTCG: a
**value recipe** is called from the `$value` of a token, so the token keeps its
own `$type`, `$description` and `$extensions`; a **group recipe** is called from
a group node. Calling a recipe from the wrong place is an error that says which
one it is.

### Value recipes and custom types

A value recipe's token has a **custom type**, such as `palette`, that is not
part of the DTCG set. The value is plain data, an ordered list of colors for a
palette, so it can be cloned, compared and serialized. Share behavior as
exported helper functions that take the data instead of methods on the value:

```ts
import { DesignToken, Recipe } from "design-token-library";

export type PaletteValue = DesignToken.Values.Color[];

// A custom token type is declared directly. `DesignToken.Properties` stays
// constrained to the DTCG types.
export interface PaletteToken {
    $description?: string;
    $type?: "palette";
    $extensions?: Record<string, any>;
    $deprecated?: boolean | string;
    $value: PaletteValue;
}

// Register the custom type. No edit to the library is needed.
declare module "design-token-library" {
    namespace DesignToken {
        interface TypeDefinitions {
            palette: { value: PaletteValue; token: PaletteToken };
        }
    }
}

export const createPalette: Recipe<
    { base: DesignToken.Values.Color; steps: number },
    PaletteValue
> = {
    name: "createPalette",
    type: "palette",
    create({ base, steps }) {
        return Array.from({ length: steps }, (_, i) =>
            perceptualStep(base, i, steps),
        );
    },
};

// A helper over the plain value, not a method on it.
export function closestIndexOf(
    palette: PaletteValue,
    color: DesignToken.Values.Color,
): number {
    /* … */
}
```

Because the count is internal to the value, a palette can change length when
its inputs change. Its consumers don't index into it directly.

> Don't put functions in a token value. A function inside a value is treated as
> an alias and is called, and class instances are copied into plain objects, so
> their methods are lost.

### Group recipes

A group recipe declares its keys, and `create` returns an object with those
keys. It can consume another recipe's value:

```ts
export const createStates: Recipe<StatesProps, Record<StateKey, string>> = {
    name: "createStates",
    type: DesignToken.Type.Color,
    keys: () => ["rest", "hover", "active", "focus"],
    create({ base, palette }) {
        const rest = closestIndexOf(palette, base);
        return { rest: palette[rest], hover: palette[rest + 1] /* … */ };
    },
};
```

:::note
A group recipe's keys are fixed when the library is created, so `keys` must
derive from literal params. A reference such as `"{color.seed}"` can't be
resolved at that point, and a recipe that produces no keys throws. If a count
needs to come from a token, use a value recipe: the count lives inside the value.

Each key becomes a token name, so a key can't be empty, begin with `$`, or
contain `.`, `{` or `}`, and a key can't repeat. These are the same rules DTCG
sets for names, and `.`, `{` and `}` are what reference paths are made of.
:::

## Registering a recipe

Register the operator so config can reference it by name. You can use the global
registry or an isolated one.

```ts
import { recipes, RecipeRegistry } from "design-token-library";

// Global registry
recipes.register(createPalette);

// …or an isolated registry passed to Library.create
const registry = new RecipeRegistry();
registry.register(createPalette);
```

## Using a recipe in config

Call the recipe declaratively with `$recipe` and `$with`. Inputs reference
other tokens with DTCG string references, so the whole declaration is plain
JSON-serializable data.

```ts
const library = Library.create(
    {
        color: {
            palette: {
                stepCount: { $type: DesignToken.Type.Number, $value: 10 },
            },
            accent: {
                base: {
                    $type: DesignToken.Type.Color,
                    $value: {
                        colorSpace: "srgb",
                        components: [0.04, 0.68, 0.96],
                    },
                },
                // A value recipe: a token whose $value is the call.
                palette: {
                    $type: "palette",
                    $description: "Ten steps from black to white.",
                    $value: {
                        $recipe: "createPalette",
                        $with: {
                            base: "{color.accent.base}",
                            steps: "{color.palette.stepCount}",
                        },
                    },
                },
                // A group recipe: a group that is the call.
                states: {
                    $recipe: "createStates",
                    $with: {
                        base: "{color.accent.base}",
                        palette: "{color.accent.palette}",
                    },
                },
            },
        },
    },
    { recipes: registry }, // omit to use the global registry
);

library.tokens.color.accent.palette.$value; // [{ colorSpace: "srgb", … }, …]
library.tokens.color.accent.states.hover.$value; // a generated color
```

The whole declaration is plain data, so the same library can be loaded from a
[JSON file](./json#recipes).

### The recipe call

A recipe call accepts only these properties, and any other key is an error
instead of being ignored:

| Property  | Meaning                                      |
| --------- | -------------------------------------------- |
| `$recipe` | The name of the registered recipe. Required. |
| `$with`   | The recipe's params, as an object. Optional. |

A **value recipe**'s call is the token's `$value`. The token is an ordinary token,
so `$type` (which must be the recipe's type when given), `$description`,
`$extensions` and `$deprecated` are the token's own.

A **group recipe**'s call is the group node itself. The group can carry
`$description`, `$extensions` and `$deprecated`, and `$type` when it matches the
recipe. A `$deprecated` group deprecates every token the recipe generates.

Every property is `$`-prefixed, as format properties are in DTCG. Token and
group names can't begin with `$`, so a property never collides with a name,
including the names a group recipe generates. A group recipe may generate a key
called `with` or `type`.

## Recipe tokens are first-class

Recipe tokens behave like any other token:

- **Aliasable** — another token can reference one, or read a palette's value:
  `$value: (theme) => theme.color.accent.palette.$value[1]`.
- **Cascading** — recipes can consume other recipes. Setting
  `library.tokens.color.palette.stepCount.set(12)` recomputes each palette, the
  states derived from it, and any token aliasing those. Only the tokens that
  have been accessed notify subscribers.
- **Reflected to CSS** — group recipe tokens flow through `toCSS` and
  `toProperties` like any other token.

A value recipe's token can be replaced with `.set()`. The tokens a **group**
recipe generates are **read-only**; calling `.set()` on one throws. Change them
by overriding the recipe's params via `Library.extend()`.

## Overriding a recipe with `extend()`

`extend()` can layer new params over a recipe. The generated shape is unchanged;
only the values recompute. Recipes in an extension resolve their references
against the extended library, so overriding an input there flows through:

```ts
const dark = library.extend({
    color: {
        palette: { stepCount: { $value: 7 } }, // palettes and states follow
        accent: {
            palette: {
                $value: {
                    $recipe: "createPalette",
                    $with: {
                        base: {
                            colorSpace: "srgb",
                            components: [0.04, 0.1, 0.4],
                        },
                    },
                },
            },
        },
    },
});
```
