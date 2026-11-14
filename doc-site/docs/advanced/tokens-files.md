# Tokens Files

A library can be created from a tokens file (`.tokens.json`), or extended by one. `parse` reads the [Design Tokens Format Module 2025.10](https://www.designtokens.org/tr/2025.10/format/) and its [Color Module](https://www.designtokens.org/tr/2025.10/color/), so a file in the 2025.10 format loads as it is. It also reads this library's extensions to the format: custom types and recipe calls.

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
import { Library, parse } from "design-token-library";

const library = Library.create<Theme>(parse(text)); // JSON text, or a parsed object

library.tokens.color.primary.$value; // { colorSpace: "srgb", components: [0, 0.4, 1] }
library.tokens.color.blue.set({ colorSpace: "srgb", components: [0, 1, 0] });
library.tokens.color.primary.$value; // follows the change
```

`parse` returns the config the file describes, and the library is the one `Library.create` makes from it, so its tokens can be set, subscribed to, extended and written to CSS. A reference such as `"{color.blue}"` is a [ref](../token-values/refs).

A file's shape is known only when it's read, so the config isn't typed: `Library.create<Theme>` gives the library its shape. To have the shape checked, define the library in TypeScript and extend it with the file, as described in [Extending a library](#extending-a-library).

## What is read

| From the format      | Support                                                                                                                                                                                           |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| All 13 types         | `color`, `dimension`, `duration`, `fontFamily`, `fontWeight`, `cubicBezier`, `number`, `strokeStyle`, `border`, `transition`, `shadow`, `gradient`, `typography`, with their 2025.10 value shapes |
| Color module         | All 14 color spaces, per-space component ranges, `"none"` components, `alpha`, and the `hex` fallback                                                                                             |
| Groups               | Nested to any depth, with `$type` inherited by the tokens in them, and `$description`, `$extensions`, `$deprecated`                                                                               |
| Token properties     | `$value`, `$type`, `$description`, `$extensions`, `$deprecated`                                                                                                                                   |
| Names                | Case sensitive; spaces and non-ASCII are allowed; `.`, `{`, `}`, `__proto__` and a leading `$` are not                                                                                            |
| References           | `"{group.token}"`, chained, and inside composite values (a border's `color`, a gradient stop's `position`)                                                                                        |
| Type resolution      | A token's `$type`, else the type of the token it references, else the nearest group's                                                                                                             |
| `$root`              | A group's own token                                                                                                                                                                               |
| `$extends`           | Both `"{group}"` and `{ "$ref": "#/group" }`, chained, deep merged                                                                                                                                |
| `$ref` JSON Pointers | See [below](#references-with-ref)                                                                                                                                                                 |
| Circular references  | Detected for references, `$extends` and `$ref`, and reported with the tokens in the loop                                                                                                          |

Not read yet: the [Resolver Module](https://www.designtokens.org/tr/2025.10/resolver/) (`.resolver.json` files with sets, modifiers and contexts).

### References

A reference is a string that is exactly `"{path.to.token}"`. It names a whole token, never a group or a part of a value. A token takes its type from `$type`, and without one from the token it references. A group's `$type` is the last resort. A reference to a token of another type is an error.

### `$extends`

A group takes everything in the group it extends. Its own tokens replace the inherited ones, and groups at the same path are merged:

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

A reference that is inherited is not rewritten: it still names the original token. A group that extends another is a copy made when the file is read, not a live view of it. Because each use is a copy, a chain of them can grow exponentially, so a file that expands to more than a million nodes is an error.

### References with `$ref`

`{ "$ref": "#/color/blue/$value" }` is a JSON Pointer into the document.

- A pointer to a token's `$value` is the same as the reference `{color.blue}`, so it stays live.
- A pointer to anything else, such as a component (`#/color/blue/$value/components/0`) or a unit, is replaced by a copy of what it points at when the file is read. That copy does not follow later changes.
- `~1` and `~0` escape `/` and `~`, and a `$ref` inside a vendor's `$extensions` is left as the vendor wrote it, but one inside this library's own (`design-token-library`) is resolved, since it holds the library's form of the token. A pointer that makes a file expand to more than a million nodes is an error, as for `$extends`.

## Custom types

A [custom type](./custom-types) is read when it is registered in `types`, the same object that `create()` and `extend()` take. Any other `$type` that isn't one of the format's is an error, so a typo such as `"colour"` is caught. A custom value isn't checked, and a reference anywhere in it is a ref:

```ts
const types = { steps: { isEqual: stepsEqual } };

const library = Library.create<Theme>(parse(text, { types }), { types });
```

## Recipe calls

A string that calls one of the [recipes](../token-values/recipes) given to `parse` is a computed value, as `Recipes.darken(ref("color.blue"), 0.2)` is in TypeScript:

```json
{
    "color": {
        "$type": "color",
        "hover": { "$value": "darken({color.blue}, 0.2)" },
        "mid": {
            "$value": "mix({ \"from\": {color.blue}, \"to\": {color.white} })"
        }
    }
}
```

```ts
parse(text, { recipes: Recipes });
```

- A call can be a whole value, a part of a composite value that may be a reference, or anywhere in a custom value.
- Its arguments are references, other calls, and JSON values: numbers, strings, `true`, `false`, `null`, and arrays and objects, which may hold references and calls. A string argument is always a string, never a reference.
- A recipe is called by its name, which is its key in `recipes({ ... })`, even when a set of recipes is spread under other keys. Two different recipes with the same name are an error.
- A string is a call only when it calls one of the recipes, so a string value such as `"calc(100% - 4px)"` stays a string. Where a string isn't a valid value, the error says when it looks like a call to a name that isn't a recipe.
- A recipe has no type at runtime, so a token with a call needs a `$type`, its own or its group's.

### Files in the DTCG form

A tool that only knows the format can't read a recipe call or a custom type. A file for one keeps a standard `$type` and the resolved `$value`, and this library's own form of the token in `$extensions`:

```json
{
    "hover": {
        "$type": "color",
        "$value": { "colorSpace": "srgb", "components": [0, 0.32, 0.8] },
        "$extensions": {
            "design-token-library": { "$value": "darken({color.blue}, 0.2)" }
        }
    }
}
```

`parse` reads a token's `$type` and `$value`, and a group's `$type`, from `$extensions["design-token-library"]` when it's there, and checks the DTCG form as well. An alias in the DTCG form takes its DTCG type from the token it references, as the format says, so it needs no `$type` of its own. The extension isn't in the token's `$extensions`.

## Extending a library

A file that changes some tokens of a library, such as a theme, extends it:

```ts
const base = Library.create<Theme>(themeConfig);
const dark = base.extend(parse(darkText, { recipes: Recipes, extends: base }));
```

With `extends`, the file is checked against the library, so it can leave out what the library already says:

- A token it restates keeps the library's type, and its value is checked as one. A group keeps its `$type`.
- A token can't become a group, or a group a token.
- A reference may name a token of the library, and is checked by its type.
- The library's custom types are known without `types`.

Its config is the library's `Library.ExtendConfig`, so `extend()` is typed. New tokens in the file are added, but they aren't in the type.

## Writing a tokens file

`stringify` writes a library as the text of a tokens file, which `parse` reads. It has two forms, by who reads the file: the `"standard"` form, the default, is a 2025.10 document that any tool that reads the format can read, and the `"extended"` form is this library's own, with recipe calls and custom types, for a file that only this library reads.

### The standard form, for any tool

```ts
import { stringify } from "design-token-library";

const text = stringify(library); // JSON text, indented by four spaces
```

- A [ref](../token-values/refs) is written as the format's reference, `"{color.blue}"`, as a whole value or inside a composite one, so the aliases of a library are the aliases of the file. Any other value is the one the token has now, so a `set()` is in it. The output is a copy.
- A recipe's result is written as the value it computed, because the format has no recipes. A ref to a token that isn't written as itself, because `filter` leaves it out or a converter writes it differently, is written as its value.
- `$description`, `$extensions` and `$deprecated` of tokens and groups are kept, and `$root` is a token. A group's `$type` is kept when it is one of the format's.
- A library made by `extend()` is written whole, with its overrides.

A [custom type](./custom-types) has no form in the format, so a library that has one is an error until each type is dealt with. The message names the first token:

```ts
stringify(library, {
    // Write the tokens of a type as a token of a standard type...
    converters: {
        palette: (palette) => ({
            $type: "gradient",
            $value: palette.map((color, index) => ({
                color,
                position: index / (palette.length - 1),
            })),
        }),
    },
    // ...or leave tokens out. A group that this empties is left out too.
    filter: (token) => token.$type !== "ratio",
});
```

A converter wins over the format for a standard type, too. It returns the `$type` and `$value` to write, which must be valid in the format.

What is not written is what the format can't hold: a recipe call. The file can be read, but the library can't be rebuilt from it with its recipes. A value that a recipe computes is also a point in time: it is written as it was, which is not what it is when the recipe isn't deterministic or reads something outside the library.

### The extended form, for this library

```ts
const text = stringify(library, { format: "extended" });

const again = Library.create<Theme>(parse(text, { types, recipes: Recipes }), {
    types,
});
```

A token's value is written as it was configured, not as it evaluates, so the file is the one a person would write by hand, and it does not go out of date:

- A ref is `"{color.blue}"`, wherever it is in the value.
- A recipe's call is `"darken({color.blue}, 0.2)"`, with its arguments as references, calls and JSON, written by the recipe's name. `parse` needs the same `recipes` to read it.
- A custom type is written with its own `$type` and value, and `parse` needs the same `types`. A group's custom `$type` is kept.
- Every token is written with its `$type`, since a call has none of its own.

The extended form has no `converters`, since nothing needs converting. A tool that doesn't know the library's extensions can't read the file. It is an error for a token to hold a value that JSON can't, such as a function or a class instance, and for a token to refer to one that `filter` leaves out. The error names the token.

## Errors

A file with problems throws a `ParseError` that lists all of them, each with the path of the token and the place in its value:

```
Invalid design tokens document (2 issues):
  size.small.$value: is not a dimension. A dimension is an object with a value and a unit, but found "4px".
  color.blue.$value.components[2]: is 2, outside the range of srgb component 3: 0 to 1.
```

`error.issues` has the same list as `{ path, message }` objects.
