# Contributing

Thank you for contributing to `design-token-library`. This document covers local development, pull requests, changelog expectations, and how releases are published.

## Prerequisites

- **Node.js 22+** (matches CI and `package.json` `engines`)
- npm (bundled with Node)

## Local development

```bash
npm ci
npm run build    # compile TypeScript
npm test         # run tests (build first)
npm run test:coverage
npm run prettier # format src/
```

After you change the public API (`src/lib/` exports or `@public` types), run `npm run build` and `npm run api-report`. That refreshes the tracked report at [api/design-token-library.api.md](./api/design-token-library.api.md). The package typings are `dist/lib/index.d.ts`, from `tsc`; the report and the rollup `dist/lib/public.d.ts` are made from them by API Extractor, and the rollup isn't published as the typings. Commit the report when the export surface changes. `npm run api-report:check` (production mode, no `--local`) fails when the report doesn't match or on `ae-forgotten-export`.

`npm run typings:check` compiles [typings-check/consumer.ts](./typings-check/consumer.ts), written as a consumer of the package, against the published typings with `strict` and without `skipLibCheck`. The library's tests import the sources, so this is what catches typings that don't resolve. Add to the consumer file when you add a public type that a consumer writes against. CI runs it after the build.

CI on `main` and pull requests runs `npm ci`, `npm run build`, `npm run typings:check`, and `npm run test:coverage`. Pushes to `main` also deploy the doc site to GitHub Pages.

## Benchmarks

`src/bench/` times the library's core operations on four libraries: layered tokens of 3,100 and 8,200 (`F1`, `F2`), one token read by 2,000 (`F3`), and a chain of 250 refs (`F4`). For each, the scenarios time `create`, first and cached reads, `set()` on a token that nothing depends on and on one that many do, `dependentsOf()`, `toCSS()`, and the same in extensions: `extend()` (`E0` with nothing, `E1` with a value, `E2` with a recipe overridden, `E3` a chain of 3 or 5, `E4` 100 of one library), `subscribe()`, a `set()` on a library that 100 extensions follow, and the tokens an extension changes, found as a tool finds them today. They also measure the heap per token and per extension, and check that an extension that nothing refers to is collected. A scenario's counts, such as how many tokens a subscriber was told of, are reported with its times, because a change of architecture changes them too.

The benchmark isn't run in CI, whose timings are too noisy, but `npm run build` compiles it, so it can't fall out of date with the library.

```bash
npm run build
npm run bench                                   # this build
npm run bench -- --filter F1/ --filter set.     # the scenarios whose id has either
npm run bench -- --json branch.json             # save the samples
npm run bench:compare -- main.json branch.json  # compare two saved runs
```

To compare two builds, build `main` in a worktree and give both, each as `label=path`:

```bash
git worktree add ../main main && (cd ../main && npm ci && npm run build)
npm run bench -- --lib main=../main/dist/lib/index.js --lib branch=dist/lib/index.js
```

Each of `--processes` (5) runs every build in turn, in its own `node --expose-gc`, so that a drift of the machine falls on both. In each, a scenario runs `--warmup` (3) times, then `--samples` (10) times, with a collection before each; a slow scenario runs at most 5. One that happens once, such as a first read, has its own library for each sample, and one too fast to time once runs for at least a millisecond in each. The samples of all processes are pooled into a median, a 95th percentile and the median absolute deviation (MAD). A comparison calls a change only when the medians differ by more than 3 times the combined MAD and by more than 5%; otherwise it's `same`. A full run takes about 10 minutes; `--filter` narrows it.

## Pull requests

1. Branch from `main`.
2. Keep changes focused; match existing code style (Prettier).
3. Add or update tests under `src/test/` for behavior you change.
4. Update **CHANGELOG.md** under `## [Unreleased]` (see [Changelog strategy](#changelog-strategy)).
5. Open a PR against `main`. Ensure CI is green before merge.

Do not bump `package.json` `version` or cut release tags in feature PRs. Version bumps happen only through the [release process](#publishing-releases).

## Changelog strategy

This project follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and [Semantic Versioning](https://semver.org/spec/v2.0.0.html). Notable library changes belong in [CHANGELOG.md](./CHANGELOG.md).

### What needs a changelog entry

Add a changelog bullet for **any PR that changes shipped runtime behavior or exported typings**—that is, anything under `src/lib/` that affects the built package (`dist/lib/`), including:

- Runtime logic, errors, or output (even bug fixes and internal refactors that change behavior)
- Public or exported TypeScript types, declarations, or API surface (including type-only breaks or fixes)

If the runtime or exported types change, the PR should include a changelog entry. You do not need an entry for changes that touch only tests (`src/test/`), the doc site, CI/workflows, or repo docs, with no `src/lib/` changes.

### Where to write entries

- Add entries under the **`## [Unreleased]`** section at the top of the file (after the Keep a Changelog intro paragraphs).
- Do not add dated version headers or edit past release sections except to fix obvious typos.

### If `## [Unreleased]` is missing

Prepare Release moves `[Unreleased]` notes into a versioned section. Depending on release-it / keep-a-changelog behavior, **`## [Unreleased]` may not be present on `main` afterward** (for example right after a release with no pending notes, or when the section was empty).

Before you add changelog entries in your PR, restore the section yourself:

1. Open [CHANGELOG.md](./CHANGELOG.md).
2. Insert **`## [Unreleased]`** after the file introduction (the lines about Keep a Changelog and Semantic Versioning) and **before** the first `## [x.y.z]` release heading.
3. Add the usual category subsections (`### Added`, `### Changed`, etc.) only for categories you need.
4. Put your bullets under the right subsection.

Minimal example when nothing is unreleased yet:

```markdown
## [Unreleased]

### Added

- Short description of your change (#123).
```

Include restoring `[Unreleased]` in the same PR as your changelog bullets when the heading was missing on `main`.

### Categories

Use these subsection headings under `[Unreleased]` (omit empty sections):

| Heading   | Use for |
|-----------|---------|
| `Added`   | New features or public APIs |
| `Changed` | Changes to existing behavior |
| `Deprecated` | Features marked for removal |
| `Removed` | Removed features |
| `Fixed`   | Bug fixes |
| `Security` | Vulnerability fixes |

### Writing style

- One bullet per logical change; lead with what matters to library users.
- Reference issue or PR numbers when helpful (`#123`).
- **Breaking changes:** prefix the bullet with **`Breaking:`** (bold), and expect a **major** semver bump when the release is cut.
- API renames, DTCG shape changes, or type-level breaks that force consumer code changes are breaking unless clearly additive.

### What release automation does

The **Prepare Release** workflow uses [release-it](https://github.com/release-it/release-it) with [@release-it/keep-a-changelog](https://github.com/release-it/keep-a-changelog). When a maintainer runs it:

1. `[Unreleased]` content is moved into a new `## [x.y.z] - YYYY-MM-DD` section.
2. `package.json` `version` is updated to match.
3. A new empty `## [Unreleased]` section may be added; **if it is not**, the next contributor PR should recreate it (see [If `## [Unreleased]` is missing](#if-unreleased-is-missing)).

You should **not** manually rename `[Unreleased]` to a version number in normal PRs.

### Semver guidance for maintainers

When triggering **Prepare Release**, choose:

- **patch** — fixes and internal changes only
- **minor** — new backward-compatible features
- **major** — any `Breaking:` entries or other incompatible API changes

## Publishing releases

Publishing is automated; maintainers do not run `npm publish` locally for routine releases.

### Overview

```mermaid
flowchart LR
  A[Merge PRs to main] --> B[Prepare Release workflow]
  B --> C[Release PR: version + changelog]
  C --> D[Merge release PR]
  D --> E[Publish Release workflow]
  E --> F[npm staging + GitHub Release]
```

### Step 1: Prepare Release

1. In GitHub Actions, run workflow **Prepare Release** ([`.github/workflows/prepare-release.yml`](./.github/workflows/prepare-release.yml)).
2. Choose **patch**, **minor**, or **major**.
3. The workflow creates a branch `release/v…`, runs release-it (changelog + version), pushes, and opens a PR to `main`.

Review the PR for correct version, changelog section, and `package.json` version only—no unrelated changes.

### Step 2: Merge the release PR

Merging the release PR triggers **Publish Release** ([`.github/workflows/publish-release.yml`](./.github/workflows/publish-release.yml)).

That workflow:

1. Checks out the merge commit on `main`.
2. Runs `npm ci` and `npm run build`.
3. Runs **`npm stage publish --access public`** using [npm trusted publishing](https://docs.npmjs.com/trusted-publishers) (OIDC from GitHub Actions—no long-lived `NPM_TOKEN` in the repo).
4. Creates a **GitHub Release** tagged `vX.Y.Z` with the body taken from the matching section in `CHANGELOG.md`.

### npm staging approval

Staged publishes sit in npm’s queue until a maintainer **approves** them in the npm UI. After approval, the version is live on the public registry.

### Manual publish workflow

**Publish Release** can also be started via **workflow_dispatch** for recovery; use only when you understand which commit and version should ship.

### What ships on npm

The published package includes compiled output under `dist/lib/` and `CHANGELOG.md` (see `files` in `package.json`).

## Questions

Open a [GitHub issue](https://github.com/nicholasrice/design-token-library/issues) for bugs or design discussions.
