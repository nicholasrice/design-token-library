# Agent instructions

When working in this repository, follow [CONTRIBUTING.md](./CONTRIBUTING.md) for development workflow, changelog entries, semver expectations, and releases.

## Required behaviors

- **Changelog:** Any change to shipped runtime code or exported typings (`src/lib/` → package output) needs bullets under `## [Unreleased]` in [CHANGELOG.md](./CHANGELOG.md). If `[Unreleased]` is missing after a release, recreate it per CONTRIBUTING.md first. Mark breaking changes with **`Breaking:`**. Do not bump `package.json` version or add dated version headers in feature work.
- **Releases:** Do not run local `npm publish` or cut git tags for releases. Publishing is described in CONTRIBUTING.md (Prepare Release → merge PR → Publish Release).
- **Quality:** Run/build/test as documented in CONTRIBUTING.md before claiming work is complete when you change code.
- **Scope:** Minimal diffs; match existing patterns in `src/`; format with Prettier on `./src` when touching source.

If CONTRIBUTING.md and another instruction conflict on repo-specific process (changelog, releases, PR flow), **CONTRIBUTING.md wins** for this project.
