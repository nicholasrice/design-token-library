# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Custom token types via `DesignToken.Custom<Name, Value>`, with static values, aliases, deep aliases, group type inheritance, `set()` and `extend()` support. Reserved DTCG type names and non-serializable values are rejected at compile time.
- `toCSS(library, converters)` accepts a converter for each custom type, and requires one for every custom type in the library. At runtime it throws for a custom type without a converter.
- `Library.TokensOf`, `Library.TokenRecord`, `Library.GroupType`, `Library.ValueAlias`, `Library.ValueSource`, `CSSConverter`, `CSSConverters` and `CustomTokensOf` types.

### Changed

- Group type inheritance is checked at compile time: a token may omit `type` in a config only when its nearest ancestor group declares a single, required, literal `type` that matches. Groups declared with `type: DesignToken.Type`, a union, or an optional `type` no longer let their tokens omit `type`.
- `type` is required on standard token types (e.g. `DesignToken.Color`). It may still be omitted in a `Library.Config` when inherited.
- Aliases are typed by value: an alias may return any value, or any token, whose value matches. Replaces the internal `TokenByValue`, `TokenByType` and `ValueByType` types.
- `Library.Subscriber` records are a union of the library's tokens, discriminated by `type`, instead of `Token<DesignToken.Any>`.
- Token values that are plain objects with a `value` key are no longer unwrapped as tokens; only library tokens are.

### Fixed

- `DeepAlias` accepts aliases inside Gradient stops (#28).
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
