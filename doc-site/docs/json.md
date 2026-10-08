---
sidebar_position: 3.5
---

# JSON files

A library can be created from a standard tokens file, and written back to one.
The reader and writer follow the
[Design Tokens Format Module 2025.10](https://www.designtokens.org/tr/2025.10/format/)
and its [Color Module](https://www.designtokens.org/tr/2025.10/color/), so a file
exported from a design tool, or checked in for a style-dictionary build, loads as
it is.

```json
{
    "color": {
        "$type": "color",
        "blue": {
            "$value": { "colorSpace": "srgb", "components": [0, 0.4, 1] },
            "$description": "The primary blue."
        },
        "primary": { "$value": "{color.blue}" }
    },
    "size": {
        "$type": "dimension",
        "small": { "$value": { "value": 4, "unit": "px" } }
    }
}
```

```ts
import { fromDTCG } from "design-token-library";

const library = fromDTCG(text); // JSON text, or a parsed object

library.tokens.color.primary.$value; // { colorSpace: "srgb", components: [0, 0.4, 1] }
library.tokens.color.blue.set({ colorSpace: "srgb", components: [0, 1, 0] });
library.tokens.color.primary.$value; // follows the change
```

The result is the same library `Library.create` makes, so tokens can be set,
subscribed to, extended and reflected to CSS. A library written in TypeScript and
one read from JSON use the same property names: `$value`, `$type`,
`$description`, `$extensions` and `$deprecated`. So do the tokens you read from the
library: `library.tokens.color.blue.$value`.

`parseDTCG(text)` returns the `Library.Config` instead of a library, after the
same checks.

## What is read

| From the spec        | Support                                                                                                                                                                                           |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| All 13 types         | `color`, `dimension`, `duration`, `fontFamily`, `fontWeight`, `cubicBezier`, `number`, `strokeStyle`, `border`, `transition`, `shadow`, `gradient`, `typography`, with their 2025.10 value shapes |
| Color module         | All 14 color spaces, per-space component ranges, `"none"` components, `alpha`, and the `hex` fallback                                                                                             |
| Groups               | Nested to any depth, with `$type` inherited by the tokens in them, and `$description`, `$extensions`, `$deprecated`                                                                               |
| Token properties     | `$value`, `$type`, `$description`, `$extensions`, `$deprecated`                                                                                                                                   |
| Names                | Case sensitive; spaces and non-ASCII are allowed; `.`, `{`, `}` and a leading `$` are not                                                                                                         |
| Aliases              | `"{group.token}"`, chained, and inside composite values (a border's `color`, a gradient stop's `position`)                                                                                        |
| Type resolution      | A token's `$type`, else the type of the token it aliases, else the nearest group's                                                                                                                |
| `$root`              | A group's own token                                                                                                                                                                               |
| `$extends`           | Both `"{group}"` and `{ "$ref": "#/group" }`, chained, deep merged                                                                                                                                |
| `$ref` JSON Pointers | See [below](#references-with-ref)                                                                                                                                                                 |
| Circular references  | Detected for aliases, `$extends` and `$ref`, and reported with the tokens in the loop                                                                                                             |

Not read yet: the
[Resolver Module](https://www.designtokens.org/tr/2025.10/resolver/) (`.resolver.json`
files with sets, modifiers and contexts).

### Values

An alias is a string that is exactly `"{path.to.token}"`. It names a whole token,
never a group or a part of a value.

```json
{
    "border": {
        "$type": "border",
        "$value": {
            "color": "{color.blue}",
            "width": { "value": 1, "unit": "px" },
            "style": "solid"
        }
    }
}
```

A token takes its type from `$type`, and without one from the token it aliases.
A group's `$type` is the last resort. A reference to a token of another type is
an error.

Colors are objects now. This library used to take `"#ff00ff"`, which the format
no longer allows, and a document with one is rejected with a message that says
so.

### `$extends`

A group takes everything in the group it extends. Its own tokens replace the
inherited ones, and groups at the same path are merged:

```json
{
    "base": {
        "$type": "color",
        "text": { "$value": "…" },
        "bg": { "$value": "…" }
    },
    "dark": { "$extends": "{base}", "bg": { "$value": "…" } }
}
```

An alias that is inherited is not rewritten: it still names the original token.
A group that extends another is a copy made when the file is read, not a live
view of it.

### References with `$ref`

`{ "$ref": "#/color/blue/$value" }` is a JSON Pointer into the document.

- A pointer to a token's `$value` is the same as the alias `{color.blue}`, so it
  stays live.
- A pointer to anything else, such as a component
  (`#/color/blue/$value/components/0`) or a unit, is replaced by a copy of what it
  points at when the file is read. That copy does not follow later changes.
- `~1` and `~0` escape `/` and `~`, and `$ref` inside `$extensions` is left as the
  vendor wrote it.

## Errors

A file with problems throws a `DTCGError` that lists all of them, each with the
path of the token and the place in its value:

```
Invalid design tokens document (2 issues):
  size.small.$value: is not a dimension. A dimension is an object with a value and a unit, but found "4px".
  color.blue.$value.components[2]: is 2, outside the range of srgb component 3: 0 to 1.
```

`error.issues` has the same list as `{ path, message }` objects.

## Recipes

[Recipes](./recipes) are an extension to the format. A value recipe is called
from a token's `$value`, and a group recipe from a group:

```json
{
    "color": {
        "accent": {
            "palette": {
                "$type": "palette",
                "$value": {
                    "$recipe": "createPalette",
                    "$with": { "base": "{color.accent.base}", "steps": 10 }
                }
            },
            "states": {
                "$recipe": "createStates",
                "$with": {
                    "base": "{color.accent.base}",
                    "palette": "{color.accent.palette}"
                }
            }
        }
    }
}
```

```ts
const library = fromDTCG(text, { recipes: registry });
```

Recipes only add to the format: a token with a `$recipe` in its `$value` is a
token with a custom type, and a group with `$recipe` is a group with an extra
property. A tool that doesn't know about recipes still sees valid tokens and
groups, though it can't compute them. To hand a file to one, write it with
[`toDTCG`](#writing-a-document).

The names of recipe types are accepted automatically. A custom type that no
recipe produces is listed in `types`, and its values are not checked:

```ts
fromDTCG(text, { types: ["fontStyle"] });
```

## Writing a document

`toDTCG` writes a library as a plain DTCG document with the values the tokens
have now:

```ts
import { toDTCG } from "design-token-library";

const document = toDTCG(library);
const text = JSON.stringify(document, null, 2);
```

- Aliases and recipes are written as the values they evaluated to.
- Group and token metadata is kept, and `$root` is written as a token.
- Reading the output gives back a library with the same tokens, types, values and
  metadata.

A custom type such as a `palette` has no DTCG form, so it has to be converted, or
left out. Without one of those the error names the token:

```ts
toDTCG(library, {
    // Leave tokens out. Runs before a token's value is read.
    filter: (token) => !token.name.startsWith("internal."),
    // Write a custom type as DTCG, with a $type and $value of the result.
    converters: {
        palette: (palette) => ({
            $type: "gradient",
            $value: palette.map((color, index) => ({
                color,
                position: index / (palette.length - 1),
            })),
        }),
    },
});
```

## CSS

`toCSS` and `toProperties` convert the 2025.10 shapes: an sRGB color is written as
hex, the other color spaces as the CSS function for the space (`oklch(0.7 0.15
200)`, `color(display-p3 0 1 0)`), a font weight keyword as its number, and a
dimension or duration with its unit. A group's `$root` is named for its group: `color.accent.$root` becomes
`--color.accent` from `toCSS` and `--color-accent` from `toProperties`.
