# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `$root` as a token in its group, and not at the top level of a library (its CSS custom property is named for the group), `$deprecated` on tokens, and group metadata (`$description`, `$extensions`, `$deprecated`) that survives `extend()`. A circular reference throws instead of overflowing the stack.
- Custom token types via `DesignToken.Custom<Name, Value>`, with static values, aliases, deep aliases, group type inheritance, `set()` and `extend()` support. Reserved DTCG type names and non-serializable values are rejected at compile time.
- `toCSS(library, options)` accepts `options.converters`, a converter for each custom type that receives the value and the token. It's required for every custom type in the library. At runtime `toCSS` throws for a custom type without a converter.
- `Library.TokensOf`, `Library.TokenRecord`, `Library.GroupType`, `Library.ValueAlias`, `Library.ValueSource`, `CSSOptions`, `CSSConverter`, `CSSConverters` and `CustomTokensOf` types.

### Changed

- **Breaking:** token values use the [DTCG 2025.10](https://www.designtokens.org/tr/2025.10/format/) shapes. A color is `{ colorSpace, components, alpha?, hex? }`, a dimension is `{ value, unit: "px" | "rem" }` and a duration is `{ value, unit: "ms" | "s" }`. A shadow may be an array of layers and may be `inset`, the font weight keyword `"smi-bold"` is corrected to `"semi-bold"`, and a list inside a value (such as a stroke style's dash array) can contain aliases.
- `toCSS` and `toProperties` convert the new shapes: sRGB colors become hex and other color spaces the CSS color function, font weight keywords become numbers, `cubic-bezier()` and transition shorthand order are corrected, and a standard type with no converter is written as JSON instead of `[object Object]`.
- **Breaking:** tokens and groups use the DTCG property names: `$value`, `$type`, `$description`, `$extensions` and `$deprecated` on tokens, and `$type`, `$description`, `$extensions` and `$deprecated` on groups, both in a config and on `library.tokens`. `name`, `set()` and `toString()` are unchanged. A token is told apart from a group by having a `$value`.
- Group type inheritance is checked at compile time: a token may omit `type` in a config only when its nearest ancestor group declares a single, required, literal `type` that matches. Groups declared with `type: DesignToken.Type`, a union, or an optional `type` no longer let their tokens omit `type`.
- `type` is required on standard token types (e.g. `DesignToken.Color`). It may still be omitted in a `Library.Config` when inherited.
- Aliases are typed by value: an alias may return any value, or any token, whose value matches. Replaces the internal `TokenByValue`, `TokenByType` and `ValueByType` types.
- `Library.Subscriber` records are a union of the library's tokens, discriminated by `type`, instead of `Token<DesignToken.Any>`.
- Token values that are plain objects with a `value` key are no longer unwrapped as tokens; only library tokens are.
- Array values resolve faster: they are copied with an indexed loop instead of `for...in`. Holes in a sparse array value now resolve to `undefined` elements.
- Recomputing a token keeps its subscriptions to the dependencies it reads again, instead of unsubscribing from all of them and subscribing again, which makes updates faster.

### Fixed

- `DeepAlias` accepts aliases inside Gradient stops (#28).
- Resolving a token of an extended library no longer disconnects its source token from its dependencies, which left the source token reported as changed when a dependency it no longer used changed.
- Number aliases in a CubicBezier accept Number tokens (#29).

- `Library.extend()` no longer throws when the source library contains groups.
- `Library.extend()` supports adding new groups, and new tokens inherit the type of their ancestor group.
- `Library.extend()` accepts alias values when overriding existing tokens, and resolves them against the extending library.
- `Library.extend()` throws when a new token has no type and no ancestor group type, matching `Library.create()`.
- Library groups expose their declared `type` (non-enumerable), matching the `TokenLibrary` type.

### Changed

- `Library.extend()` config is typed with the new `Library.ExtendConfig` and its type parameter defaults to `{}` instead of `any`.

## [0.1.0] - 2023-05-16

### Added

Initial release of the package.
