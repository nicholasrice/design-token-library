---
sidebar_position: 4
---

# Custom token types

`design-token-library` follows the DTCG format by default, so the only token
types are the ones the specification defines. A project that needs more (a
`boolean`, a `fontStyle`, a `palette`) can add its own types without changing
this library.

## Registering a type

Declare the token interface directly, then register it with `TypeDefinitions`
using declaration merging. The key is the string used as the token's `type`.

```ts
interface FontStyleToken {
    type?: "fontStyle";
    description?: string;
    extensions?: Record<string, any>;
    value: "regular" | "italic";
}

declare module "design-token-library" {
    namespace DesignToken {
        interface TypeDefinitions {
            fontStyle: {
                value: FontStyleToken["value"];
                token: FontStyleToken;
            };
        }
    }
}
```

The type now works anywhere a DTCG type does. Tokens are typed, can be aliased,
and recompute when what they reference changes:

```ts
interface Theme {
    italic: BooleanToken;
    style: FontStyleToken;
}

const library = Library.create<Theme>({
    italic: { type: "boolean", value: true },
    style: {
        type: "fontStyle",
        value: (theme) => (theme.italic.value ? "italic" : "regular"),
    },
});
```

A few rules keep the types sound:

- **Declare the token interface directly.** `DesignToken.Properties` stays
  constrained to the DTCG types, so a custom type is not built with it.
- **Give the token a distinct `type` literal.** That is what keeps one token type
  distinguishable from another.
- **Composite values can mix fields.** In a custom composite value, fields that
  are DTCG values (such as a color) can be aliases, and other fields are plain
  values.
- **Aliases nested in a composite value find their token by value type.**
  A field's alias must return the narrowest registered token type that can hold
  the field's value type, so a color field takes a `Color` token and not a
  `FontFamily` one. Custom types take part automatically.

## Keep values as plain data

A token value is cloned each time it is resolved. A function inside a value is
treated as an alias and is called, and a class instance becomes a plain object,
so its methods are lost. Keep values as objects, arrays and primitives, and share
behavior as exported helper functions that take the value.

## CSS output

`toCSS` and `toProperties` accept options so custom types and project naming can
be handled without changing the library.

```ts
toCSS(library, {
    // Serialize a custom type. Takes precedence over a built-in converter.
    converters: {
        fontStyle: (value) => (value === "regular" ? "normal" : value),
    },
    // Leave tokens out. Runs before the token is resolved.
    filter: (token) => !token.name.startsWith("internal."),
    // Name the custom property, without the leading `--`.
    name: (token) => token.name.replaceAll(".", "-"),
});

toProperties(library, { filter, name });
```

A custom type with no converter is written with its default string conversion.
`toCSS` uses the token's name as-is and `toProperties` replaces `.` with `-`, so
pass the same `name` function to both to keep the property names aligned.
