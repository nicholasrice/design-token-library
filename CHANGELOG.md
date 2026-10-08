# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `fromDTCG` and `parseDTCG` create a library from a
  [DTCG 2025.10](https://www.designtokens.org/tr/2025.10/format/) document, and
  `toDTCG` writes one. See "JSON files" in the docs.
- Group metadata: `$description`, `$extensions` and `$deprecated`, and `$type` on
  a group. A token has `deprecated`.
- `$root` tokens, and string references (`"{color.blue}"`) as a token's value or
  inside a composite value.
- Circular references throw instead of overflowing the stack.

### Changed

- **Breaking:** token and group config properties are `$`-prefixed: `$value`,
  `$type`, `$description` and `$extensions`.
- **Breaking:** tokens in `library.tokens` use the same names as config:
  `token.$value`, `$type`, `$description`, `$extensions` and `$deprecated`
  (`name`, `set()` and `toString()` are unchanged). Config and runtime tokens are
  told apart from values by `$value`.
- **Breaking:** values use the 2025.10 shapes. A color is
  `{ colorSpace, components, alpha?, hex? }`, and a dimension and a duration are
  `{ value, unit }`. A shadow can be an array and can be inset.
- **Breaking:** a value recipe is called from a token's `$value`, so the token has
  its own `$type`, `$description` and `$extensions`. A group recipe stays a group
  node with `$recipe`.
- `toCSS` and `toProperties` convert the new shapes, write cubic-bezier() and
  transition shorthand correctly, and name a `$root` token for its group.

### Fixed

- The font weight keyword `"smi-bold"` is `"semi-bold"`.
- A token whose value is an object with a `value` key is no longer unwrapped.
- A group's `$type` no longer depends on where it is in the group, and is kept by
  `extend`.

## [0.1.0] - 2023-05-16

### Added

Initial release of the package.
