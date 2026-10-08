# Test Coverage Audit & Plan

Branch: `worktree-test-coverage-audit` (off `main` @ `554c307`). Does **not** include `6dc6cc0` from `fix/library-extend`.

## 1. Current state

- 42 tests, all passing (`library.spec.ts`: 30, `css.spec.ts`: 12 + 1 toProperties).
- No coverage tooling. `src/test/my-design-system/*` fixtures are not imported by any test.
- No type-level tests, although the public API is largely types (`Config`, `ConfigValue`, `DeepAlias`, `TokenLibrary`, `extend<K>`).

### Gaps by module

| Module | What's tested | What's missing |
|---|---|---|
| `library.ts` create | flat + 1-level groups, type inheritance (1 level), static/alias/deep-alias values, `set` | multi-level nesting, `null`/primitive config values, circular aliases, dependency re-tracking, caching, `toString`, extensions isolation |
| `library.ts` extend | **flat libraries only** | nested groups (throws), new groups (throws), alias overrides (returns `undefined`), metadata overrides, chained extends, `set` detach, source isolation, subscription semantics |
| Subscriptions | single library notify + batching | `unsubscribe`, dedupe, dependents of aliases, deep-alias dependents, multiple subscribers, subscriber errors |
| `css-reflector.ts` toCSS | each type in isolation, **single token per library** | multiple tokens across groups (output is overwritten), nested name format, Transition, StrokeStyle, Typography, aliases, extended libraries |
| `css-reflector.ts` toProperties | one 2-level case | deep nesting, extended libraries, immutability, name casing |
| `notifier.ts`, `queue.ts`, `watcher.ts` | indirectly only | direct unit tests |

## 2. Defects confirmed by probing `dist/` on this branch

These were reproduced with a scratch script, not existing tests. Tests below that target them are marked **FAILS**.

| # | Defect | Observed |
|---|---|---|
| D1 | `toCSS` drops everything before a nested group (`result = recurseToCss(...)` instead of `+=`) | `{a, g:{b}}` → `"--g.b:#222222;"` (`--a` lost) |
| D2 | `toCSS` emits dotted property names; `toProperties` emits dashed | `--g.b` vs `--g-b`; dotted names are invalid CSS custom properties |
| D3 | No Typography converter | `--t:[object Object];` |
| D4 | Transition timing function not wrapped | `100ms 0ms 0,0,1,1` (should be `cubic-bezier(0, 0, 1, 1)`) |
| D5 | Gradient float error | position `0.07` → `7.000000000000001%` |
| D6 | `extend({})` on a library with any group throws | `TypeError: Reflect.defineProperty called on non-object` |
| D7 | `extend` adding a new group throws | `TypeError: Object prototype may only be an Object or null` |
| D8 | `extend` override with an alias function resolves to `undefined` | `extend({ b: { value: c => c.a } }).tokens.b.value === undefined` |
| D9 | `extend` new token with no resolvable type silently gets `type: null` (create throws) | `.type === null` |
| D10 | `extend` ignores `description`/`extensions`/`type` overrides | override description `"y"` → still `"x"` |
| D11 | Token `toString()` is in the public `Token` type but not implemented | `"[object Object]"` |
| D12 | Extended token `extensions` is the same object as the source's | mutating extended `extensions.x` shows on source |
| D13 | One throwing subscriber prevents later subscribers from being notified | second subscriber call count `0` |
| D14 | Extended tokens share the source token's `subscriptions` Set via the prototype. Reading an extended token clears the source token's dependency records, so later re-aliasing in the source leaves a stale dependency | source `b` re-aliased from `a` to `c` is still notified on `a` change once an extension has read `b` |

D6–D9 appear to be addressed by `6dc6cc0` on `fix/library-extend` (per its commit message; unverified against tests). D1–D5, D10–D13 are not mentioned there.

### Behavior with no defined contract (needs a decision before testing)

- **U1 — DECIDED:** Circular aliases (currently `RangeError: Maximum call stack size exceeded`) must throw a dedicated, descriptive error naming the chain. DTCG Format Module 2025.10 §6.7.4 requires tools to "detect and throw an error on circular references".
- **U2 — DECIDED:** `set()` must not notify when the new raw value is identical to the current one (`Object.is`: same primitive, same alias function reference, same object reference). Structurally equal but distinct objects still notify.
- **U3 — DECIDED:** `library.tokens` root must be frozen like nested groups (currently `tokens.z = 1` succeeds). Applies to extended libraries and the `toProperties` root too.
- **U4** `.value` of object-typed tokens returns a mutable cached object; mutating it changes subsequent reads.
- **U5** Token `extensions` object is shared by reference with the config passed to `create`.
- **U6** Config entries that are `null` / primitives are silently dropped.
- **U7** A group containing a child literally named `value` is treated as a token (`isToken` = `"value" in obj`).
- **U8 — VERIFIED:** `"rm"` is a typo. DTCG 2025.10 §8.2.1: unit "may only be `"px"` or `"rem"`". Separately, 2025.10 makes Dimension (§8.2) an object `{ value, unit }`, not a string. This library uses the older string form throughout; aligning is a breaking change and out of scope for this plan.
  - **DECIDED:** Fix the unit only (`"rm"` → `"rem"` in `DesignToken.Values.Dimension`). The object form is deferred to the upcoming spec-version upgrade.

## 3. Test plan

Legend: **PASS** = expected to pass on `main` today (pure coverage gain). **FAILS** = expected to fail until the referenced defect is fixed. **DECIDE** = needs a contract decision (U#) first.

### 3.1 `Library.create` — structure & metadata (`library.spec.ts`)

| ID | Case | Expect |
|---|---|---|
| C1 | Name path for 3+ levels of nesting (`a.b.c.d`) | PASS |
| C2 | Type inherits through multiple group levels; nearest ancestor wins | PASS |
| C3 | Nested group `type` overrides outer group `type` for its descendants only (siblings keep outer type) | PASS |
| C4 | Throws when a nested token has no type in any ancestor; error message names the token | PASS |
| C5 | `description` defaults to `""` when omitted | PASS |
| C6 | `extensions` defaults to `{}` when omitted; each token gets its own default object | PASS |
| C7 | Group objects are not tokens: `"type"` key on a group is not exposed as an enumerable key on `library.tokens.group` | PASS |
| C8 | `Object.keys` of a group returns exactly its tokens/subgroups, in declaration order | PASS |
| C9 | Each `DesignToken.Type` value round-trips through `create` (`type` and `value` match) — table-driven over all 13 types | PASS |
| C10 | Root `library.tokens` is frozen: adding, reassigning, and deleting keys all throw | FAILS (U3) |
| C11 | `null`/primitive config values are rejected or ignored | DECIDE (U6) |
| C12 | Group containing a child key named `value` | DECIDE (U7) — not implemented; the spec upgrade's `$value` key removes the ambiguity |
| C13 | Two libraries created from the same config are independent (`set` on one doesn't affect the other) | PASS |
| C14 | `toString()` returns a meaningful string (name or value) | FAILS (D11) |

### 3.2 Values & aliases (`library.spec.ts`)

| ID | Case | Expect |
|---|---|---|
| V1 | Alias returning a raw value vs. returning a token — both resolve to the same value | PASS |
| V2 | Alias to a token in a different group (`ctx.colors.primary` from `borders.x`) | PASS |
| V3 | Deep alias inside arrays: Gradient stop `color` alias, CubicBezier element alias | PASS |
| V4 | Deep alias two levels deep (Border `style.dashArray[i]` alias to a Dimension alias) | PASS |
| V5 | Deep alias value where the alias returns a token (not `.value`) | PASS |
| V6 | Value is cached: alias function invoked once across repeated `.value` reads | PASS |
| V7 | Cache invalidated: alias re-invoked exactly once after dependency `set` | PASS |
| V8 | Re-aliasing via `set(ctx => ctx.b)`: token tracks `b`, no longer tracks `a` (no notify on `a` change, updates on `b` change) | PASS (verified) |
| V9 | Conditional alias (`ctx.flag.value ? ctx.a : ctx.b`) re-tracks dependencies after the branch flips | PASS (verified) |
| V10 | `set` from alias back to static value stops tracking the old dependency | PASS |
| V11 | Diamond dependency (`d` aliases `b` and `c`, both alias `a`): `d` updates once, correct value | PASS |
| V12a | Direct cycle (`a → b → a`) throws `CircularReferenceError` (not `RangeError`) | FAILS (U1) |
| V12b | Self-reference (`a → a`) throws | FAILS (U1) |
| V12c | Error message lists the chain (`a → b → a`) | FAILS (U1) |
| V12d | Cycle through a deep alias (Border `color: ctx => ctx.self`) throws | FAILS (U1) |
| V12e | Cycle created later via `set()` throws on the next read | FAILS (U1) |
| V12f | After a throw, breaking the cycle with `set()` makes tokens resolve normally (no stuck "resolving" state) | FAILS (U1) |
| V12g | Non-cyclic diamond (`d → b, c → a`) does **not** throw (no false positive) | PASS |
| V12h | Cycle introduced by an `extend` override (source `b → a`, override `a: ctx => ctx.b`) throws in the extended library only | FAILS (U1, D8) |
| V12i | Source library is unaffected by V12h: `source.tokens.a/b` still resolve | PASS |
| V12j | Error is `instanceof CircularReferenceError` and `instanceof Error`; exported from the package entry point | FAILS (U1) |

**U1 implementation approach (planning only — do not implement until approved):**
- Add an exported `CircularReferenceError extends Error` with a `chain: string[]` of token names.
- `LibraryToken` gets an own `resolving` boolean. Set it before resolving an uncached value; clear it in `finally`. Cached reads skip the check.
- A module-level stack of the tokens being resolved, pushed and popped alongside the flag, supplies `chain` for the message (`a → b → a`).
- `extendToken` initializes `resolving = false` as an own property so extended tokens don't read the source token's flag through the prototype.
- Expected cost: one boolean check plus a push/pop per uncached read; no cost on cached reads.
| V13 | Mutating a returned object value doesn't affect the token | DECIDE (U4) |
| V14 | Mutating the config `extensions` object after `create` doesn't affect the token | DECIDE (U5) |
| V15 | Alias context is the library's own `tokens` object for nested-group tokens | PASS |

### 3.3 Subscriptions (`library.spec.ts`)

| ID | Case | Expect |
|---|---|---|
| S1 | `unsubscribe` stops notifications | PASS (verified) |
| S2 | `unsubscribe` of a never-subscribed subscriber is a no-op | PASS |
| S3 | Same token `set` twice in one microtask → appears once in the batch | PASS (verified) |
| S4 | Dependent alias token included in batch when its dependency changes (after being read) | PASS (verified) |
| S5 | Dependent alias token **not** included if never read (documents lazy tracking) | PASS (verified) — confirm this is intended |
| S6 | Deep-alias dependent (Border color alias) included in batch | PASS (verified) |
| S7 | Transitive dependents (`c → b → a`) all included in batch | PASS |
| S8 | Multiple subscribers each receive the same frozen array | PASS |
| S9 | Records array is frozen | PASS |
| S10 | Subscribing the same subscriber twice → notified once | PASS |
| S11 | A subscriber that throws doesn't block other subscribers | FAILS (D13) — or DECIDE if intentional |
| S12a | `set` with the same primitive → no notification | FAILS (U2) |
| S12b | `set` with the same alias function reference → no notification | FAILS (U2) |
| S12c | `set` with the same object reference → no notification | FAILS (U2) |
| S12d | `set` with a structurally equal but new object → notifies | PASS |
| S12e | `set` with a new function having the same body → notifies | PASS |
| S12f | No-op `set` doesn't invalidate the cache (alias not re-invoked) | FAILS (U2) |
| S12g | `set` on a non-overridden extended token with the value it inherits from the source **detaches** it from the source | PASS (detach already happens on any `set`) |
| S12h | After S12g, a source `set` changes neither the extended token's value nor notifies the extended library | PASS |
| S12i | S12g itself does not notify the extended library (resolved value unchanged) | FAILS (U2) |
| S12j | Inherited alias, assigned the same alias reference — value before and after (see steps below) | PASS (no-notify on assignment is asserted in S12i) |
| S12k | Inherited static value, assigned the same value — value before and after | PASS (no-notify on assignment is asserted in S12i) |

**S12j steps.** Source `a = #111111`, `b = ctx => ctx.a` (keep the function as `aliasB`). Extended overrides `a = #999999`; `b` is inherited.
1. Before: `extended.b.value === "#999999"` (resolves against the extending library), `source.b.value === "#111111"`.
2. `extended.tokens.b.set(aliasB)` (the same function reference).
3. After: `extended.b.value === "#999999"`, no notification to extended subscribers.
4. `source.tokens.a.set("#222222")`: `source.b.value === "#222222"`; `extended.b.value` still `"#999999"`; extended not notified for `b`.
5. `extended.tokens.a.set("#AAAAAA")`: `extended.b.value === "#AAAAAA"` and `b` is in the extended batch, so its dependency tracking survives the detach.

**S12k steps.** Source `a = #111111`; extended inherits `a`.
1. Before: `extended.a.value === "#111111"`.
2. `extended.tokens.a.set("#111111")`.
3. After: `extended.a.value === "#111111"`, no notification.
4. `source.tokens.a.set("#222222")`: `source.a.value === "#222222"`; `extended.a.value` still `"#111111"`; extended not notified.

**Implementation note:** the U2 identity check in `set` must run *after* the detach wrapper in `extendToken` unsubscribes from the source. Otherwise an early return would skip the detach and fail S12g, S12h, and S12j–S12k step 4.

**Rule:** any explicit `set` detaches an extended token from its source. Whether it notifies depends only on whether the stored value changed (U2 identity check).
| S13 | Changes in one library don't notify another library's subscribers | PASS |

### 3.4 `Library.extend` (`library.spec.ts`, new `Extend` cases)

| ID | Case | Expect |
|---|---|---|
| E1 | `extend({})` on a library containing a group | FAILS (D6) |
| E2 | `extend({})` on 3-level nested library; names preserved | FAILS (D6) |
| E3 | Override a token inside a nested group | FAILS (D6) |
| E4 | Add a new group via extend | FAILS (D7) |
| E5 | Add a new token into an existing group; inherits the group's type | FAILS (D6) |
| E6 | Override with an alias function | FAILS (D8) |
| E7 | Override with a deep alias (Border with `color: ctx => ctx.a`) | PASS |
| E8 | New token without resolvable type throws (parity with `create`) | FAILS (D9) |
| E9 | Source aliases resolve against the **extending** context (override `a`; non-overridden `b = ctx.a` reflects override) | PASS (verified) |
| E10 | Overriding does not mutate the source library | PASS (verified) |
| E11 | `set` on a non-overridden extended token detaches it from the source | PASS (verified) |
| E12 | `set` on an extended token notifies only the extending library's subscribers, not the source's | PASS (verified) |
| E13 | Source `set` notifies extending subscribers even when the extended token was never read | PASS (verified) |
| E14 | Chained `extend().extend()` propagates source changes to the grandchild | PASS (verified) |
| E15 | Chained extend: middle-library override takes precedence in grandchild | PASS |
| E16 | Override `description` / `extensions` | FAILS (D10) — or DECIDE |
| E17 | Override `type` (should it be allowed?) | DECIDE — not implemented; no default expectation |
| E18 | Extended token `extensions` mutation doesn't leak to source | FAILS (D12) — or DECIDE |
| E19 | Extended library is immutable (same assertions as existing `Lib "should be immutable"`, plus root frozen) | FAILS (D6 for groups, U3 for root) |
| E20 | `Object.keys(extended.tokens)` equals source keys ∪ new keys | PASS (flat) |
| E21 | Two sibling extensions of one source are independent | PASS |
| E22 | After extended token detaches via `set`, the old source subscription is released (source `set` no longer notifies it) | PASS |
| E23 | Reading an extended token doesn't corrupt the source token's dependency tracking | FAILS (D14) |

### 3.5 `toCSS` (`css.spec.ts`)

| ID | Case | Expect |
|---|---|---|
| T1 | Multiple flat tokens concatenated in order | PASS (verified) |
| T2 | Token before and after a nested group all emitted | FAILS (D1) |
| T3 | Two sibling groups both emitted | FAILS (D1) |
| T4 | Nested name uses `-` separator, consistent with `toProperties` | FAILS (D2) |
| T5 | Transition → `duration delay cubic-bezier(...)` | FAILS (D4) |
| T6 | StrokeStyle string keyword passthrough | PASS |
| T7 | StrokeStyle object → `dashed` fallback | PASS (verified) |
| T8 | Typography → defined output (CSS `font` shorthand or skipped) | FAILS (D3) — DECIDE format |
| T9 | Gradient with non-terminating float positions (`0.07`, `0.333`) | FAILS (D5) |
| T10 | Single-quoted / unquoted single-word FontFamily | PASS |
| T11 | Alias tokens emit resolved values | PASS (verified) |
| T12 | Deep-alias Border emits resolved values | PASS |
| T13 | `toCSS` on an extended library emits overrides | PASS (flat), FAILS with groups (D6) |
| T14 | Empty library → `""` | PASS |
| T15 | Output reflects a value after `set` | PASS |
| T16 | Fix test title typo: `"should convert .ShadowGradient"` → `"should convert Shadow"` | — |

### 3.6 `toProperties` (`css.spec.ts`)

| ID | Case | Expect |
|---|---|---|
| P1 | 3+ levels of nesting | PASS |
| P2 | Returned groups and property objects are frozen | PASS |
| P3 | Root returned object is frozen | FAILS (U3) |
| P4 | Extended library including new tokens | PASS (flat), FAILS with groups (D6) |
| P5 | Case preserved in names (`tOkEn` → `--tOkEn`) | PASS |
| P6 | Group `type` key not emitted | PASS |

### 3.7 Internal units (new `internals.spec.ts`)

Not exported publicly, but small and pivotal. Import from `../lib/*.js` directly.

| ID | Case |
|---|---|
| I1 | `Queue`: batches adds in one microtask, dedupes, clears between flushes, frozen array |
| I2 | `Queue`: no flush when nothing added; subscribers added mid-batch receive that batch |
| I3 | `getNotifier`: same instance per target; distinct per target; `notify` passes subject |
| I4 | `Watcher.use` nesting restores the previous watcher; `track` is a no-op with no active watcher |

### 3.8 Type-level tests (new `types.spec.ts`, compile-only)

Use `// @ts-expect-error` assertions; the `tsc -b` step in CI already enforces them.

| ID | Case |
|---|---|
| Y1 | `Config` rejects a value that doesn't match the token type (Color given `12`) |
| Y2 | `ConfigValue` accepts alias and deep alias forms |
| Y3 | `TokenLibrary` exposes `.value` typed as the token's value type |
| Y4 | `extend<K>` result includes keys from both source and `K` |
| Y5 | `Token.set` rejects a mismatched value type |
| Y6 | `Dimension` accepts `"1rem"` and rejects `"1rm"` (`@ts-expect-error`) | FAILS (U8) |

## 4. Infrastructure

- Add `c8` and a `test:coverage` script (`c8 npx uvu dist/test .spec.js$`) to measure line/branch coverage; consider a threshold in CI once gaps above are filled.
- Either use `my-design-system/` fixtures in an end-to-end test (create → extend → toCSS/toProperties) or delete them.
- Split `library.spec.ts` (~750 lines) into `create.spec.ts`, `extend.spec.ts`, `subscription.spec.ts` as the suite grows.

## 5. Suggested order

1. PASS cases (pure coverage, no source changes): C1–C9, C13, V1–V11, V15, S1–S10, S13, E9–E15, E20–E22, T1, T6–T7, T10–T12, T14–T15, P1–P2, P5–P6, I1–I4, Y1–Y5.
2. Merge `fix/library-extend`, then add E1–E8, E19 and the group variants of T13/P4.
3. Implement decided items U1, U2, U3, U8 alongside their tests (V12*, S12*, C10, E19, P3, Y6). **U1 is on hold until approved.**
4. Resolve U4–U7 and D10–D13 decisions, then add the remaining cases with their fixes.
