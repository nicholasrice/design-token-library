# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- Reading a token whose value throws (e.g. a circular alias) no longer leaves dependency tracking active, which caused later unrelated reads to be tracked and could make `set()` recurse indefinitely.
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
