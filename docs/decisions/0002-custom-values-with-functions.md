# 2. A custom value can contain functions

Status: proposed (2026-10-26)

## Context

A custom value type couldn't contain a function anywhere. `DesignToken.HasFunction` searched the value type for a function, to a depth of 8, and `DesignToken.Custom` turned its `$type` into an error when it found one. The reason was that a function in a value was an alias, and it would have been called.

Since [0001](0001-refs.md), a ref is data and the library never calls a function in a value. A class instance is returned as it is, with its prototype. So the reason for the restriction is gone, and it now rejects what a design system has: a class instance with methods, or an object with a formatter.

## Decision

A custom value is data, and data may have functions. `DesignToken.Custom<"palette", Palette>` takes a class instance, or an object with methods or function properties, and the library never calls them.

A value type that is a function, or may be one (`string | (() => void)`), is still rejected, at compile time and at runtime: a value is data, and a function on its own isn't. The check is on the value type itself, not its properties, so it has no depth limit, and a type that contains itself needs none. A value typed `any` is accepted, as before.

`HasFunction` is removed.

## Consequences

- A value with functions isn't written whole by `toString()`, because JSON leaves functions out. Its CSS comes from its type's converter, as before. Serialization will need a value class to say how it's written; that belongs with serialization.
- `Custom<"palette", Palette>` names the instance type, which is an object with a prototype. The constructor's type, `typeof Palette`, isn't involved.

## Alternatives considered

- **Allow a function as a whole value.** That would make a function a second way to write a value computed from others, one that can't be serialized.
- **Keep searching the value type for functions.** That rejects class instances and objects with methods, which the library now handles.
