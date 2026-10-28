# design-token-library

[![CI](https://github.com/nicholasrice/design-token-library/actions/workflows/ci.yml/badge.svg)](https://github.com/nicholasrice/design-token-library/actions/workflows/ci.yml)
[![Docs](https://github.com/nicholasrice/design-token-library/actions/workflows/deploy.yml/badge.svg)](https://github.com/nicholasrice/design-token-library/actions/workflows/deploy.yml)

A TypeScript library for managing [design tokens](https://www.designtokens.org/). The API follows the [Design Token Community Group (DTCG)](https://www.designtokens.org/) format and focuses on type safety, lazy evaluation, and runtime-agnostic behavior.

## Features

- Token aliasing and refs with compile-time path checking
- Computed values (recipes) and library extension
- Change subscription and CSS / custom-property export
- [DTCG 2025.10](https://www.designtokens.org/tr/2025.10/format/) value shapes

## Installation

```bash
npm install design-token-library
```

Requires **Node.js 22+** (see `engines` in `package.json`).

## Documentation

- [Getting started & API reference](https://nicholasrice.github.io/design-token-library/) (GitHub Pages)
- [Changelog](./CHANGELOG.md)

## Development

```bash
npm ci
npm run build
npm test
```

Contributing guidelines, changelog conventions, and the release process are documented in [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

[MIT](./LICENSE)
