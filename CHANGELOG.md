# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- A library finds which tokens depend on which from their configured values, rather than by watching what each token reads as it resolves. Each token's edges are added when it is resolved, so a `set()` invalidates the tokens that were read without walking the library, and `dependentsOf()` completes the graph once and keeps it up to date as tokens are set. An extension shares the graph of the library it extends and adds only its own tokens', so `dependentsOf()` on one of its tokens makes only the tokens it lists, not every token. A change to a token of a source reaches its extensions through their libraries, once each, rather than through a link on each of their tokens, so `subscribe()` on an extension no longer costs a link per token, and an extension that is read holds about half the memory.
- What a subscriber of an extension is told of follows the extension's own tokens. A `set()` on a source's token that the extension has a value of its own for no longer tells it of the extension's tokens that depend on it, whose values don't change, and which of its tokens it is told of no longer depends on which tokens of the source have been read.
- `dependentsOf()` no longer throws when another token of the library has a ref to a token it doesn't have. Reading that token's `$value` still does.
- **Breaking:** Reading a token's `$value` in a recipe's function or a getter in a value, such as a token of a library it closes over, throws. Such a read isn't followed, so the value that read it wouldn't change with the token. The error names the token being resolved, the token it read and the recipe, and says to pass the token as a ref. A ref that a recipe's function returns is still followed.

### Fixed

- Reading a token of an extension no longer changes what its source token depends on (#19). The test of it, which was skipped, runs.

## [0.3.1] - 2026-11-04

### Fixed

- The published typings (`types` / `exports.types`) are `dist/lib/index.d.ts` again, as in 0.2.0. In 0.3.0 they were the API Extractor rollup `dist/lib/public.d.ts`, trimmed to what is tagged `@public`, which left out the `@internal` types that public types are written in terms of (`DesignToken.Shape`, `ValueByToken`, the `REF` key of a ref). Their uses didn't resolve, so `refs<T>()` of a group had no members, any object was a `Ref`, and `Library.create`, which the rollup hides, was missing.

## [0.3.0] - 2026-11-03

### Added

- `toCSS(library, { filter })` writes only the tokens `filter` accepts. A token it leaves out isn't converted, so its value isn't read and its type needs no converter. A tool that knows which tokens a `set()` changed, with `dependentsOf()`, writes the CSS of those, for an extension that changes a few of the tokens it extends.
- `configuredValueOf(token)` is a token's value as configured, or as last given to `set()`, with its refs and computed values unresolved (#106). A token of an extended library that isn't given a value has its source token's. `isComputed(value)` tells whether a value is a recipe's result, also one made by another copy of the package, as `isRef()` does for a ref. A tool tells a given token from a derived one by whether its configured value has a ref or a computed value at any depth, and a converter reads a ref in a value to write it as a `var()`.
- `dependenciesOf(token)` is the tokens a token's value refers to, through refs anywhere in its configured value, including the arguments of its recipes, in the token's own library (#106).
- `entriesOf(library)` lists the tokens and groups of a library, each with its path, in the order of the config, for a tool that visits every token without restating the library's rules for what is a token or a group (#105). It walks as a DOM `TreeWalker` does: `whatToShow` is `"token"`, `"group"` or `"all"`, and a `filter` leaves an entry out, or `"reject"` leaves out a group and what is under it.
- `dependentsOf(token)` is the tokens whose configured values refer to a token, directly, in the token's own library: the reverse of `dependenciesOf()` (#110). It reads no token's value, so a tool finds what a `set()` may change, for an extension that hasn't been read, without reading the library. The index is made once for a library and again after a token is set to a different value.
- A CSS converter can return a record to write a token as more than one custom property, such as a value for each state of a component or a property for each field of a typography (#64). A key is added to the name of the token's property with `-`, and `""` is the token's own: `{ "": rest, hover }` for `fill` writes `--fill` and `--fill-hover`. A string is the same as `{ "": value }`, and an empty record writes nothing. `toProperties()` has a `{ var, property }` for each key, at `properties.fill.hover`, typed by the keys a converter returns when its return type is inferred; so it calls a converter it's given, and reads the values of those tokens. Adds the `CSSValue`, `CSSValues`, `CSSPropertiesOf` and `PropertiesConverters` types. `ToPropertiesOptions` and `CSSPropertiesLibrary` take the converters as a type parameter, with a default.

### Changed

- An extension makes its tokens when they are first read, or up front for those its config gives, rather than one for every token of the library when `extend()` is called (#113). The library an extension extends holds it weakly, so an extension that nothing refers to is collected, with its subscribers. With 600 tokens, `extend({})` takes about a fifth of the time, and 200 dropped extensions keep 0.1 MB rather than 93 MB. Walking an extension with `entriesOf()`, writing its CSS or `dependentsOf()` still makes all of its tokens.
- **Breaking:** `CSSConverter` returns `CSSValue` (`string | CSSValues`) rather than `string`. A converter that returns a string is still one, but code that calls a value typed `CSSConverter` gets the union (#64).
- `package.json` sets `"sideEffects": false` so bundlers can tree-shake unused exports from the package.
- Package entry uses explicit named exports instead of `export *`. Exported `ConvertersOf`, `StandardConverters`, and `CSSPropertyValues` so the public CSS types resolve without forgotten-export errors.
- Published typings (`types` / `exports.types`) come from the API Extractor public `.d.ts` rollup at `dist/lib/public.d.ts` (generated at the end of `npm run build`). `dist/lib/index.d.ts` stays the TypeScript barrel used as the extractor entry point.
- A ref resolves to its token's value, which is resolved and frozen already, rather than to a copy of it. A recipe whose argument refers to a large value, like a palette of many colors, no longer copies it each time the recipe is computed.

## [0.2.0] - 2026-10-28

### Added

- `isRef(value)` tells whether a value is a ref, also one made by another copy of the package, and `pathOf(ref)` is the path of its token, as a readonly array of names (#93). An add-on that keeps a ref, instead of letting the library resolve it to its token's value, needs them, as an expression that writes a token as a `var()` does. `isRef()` narrows a value to a `Library.Ref<unknown, never>`, which a ref of any library is.
- `ref("colors.primary")` and `refs<T>()` make a ref to a token, by its dotted path or by a ref for each token of a shape: `$value: ref("colors.primary")` or `$value: $.colors.primary`. They make the same ref, which is data, the path of its token, and has the token's value type. `ref()` takes its types from where it's used, so a path that isn't a token, or a token of the wrong type, is a compile error. Adds the `Library.Ref`, `Library.Refs`, `Library.TokenValues`, `Library.TokenValue`, `Library.TokenPath` and `Library.DeepValue` types.
- A custom value can be any type, including a class instance, an object with methods or function properties, or a function, and the library never calls its functions: `DesignToken.Custom<"palette", Palette>`. `DesignToken.HasFunction`, which rejected a value type with a function in it, is removed.
- `recipes({ ... })` makes a recipe of each function of an object, named by its key. A recipe takes its function's arguments as values, refs, computed values, or values with them in them, and returns a computed value, as in `$value: Recipes.darken(ref("colors.primary"), 0.2)`. A computed value is data: the recipe and its arguments. The function is called when the token is read, and again when a token it read changes. It gets its arguments as tokens get their values, so a ref's value and a copy of plain data are frozen, and its parameters are typed readonly, as in `DesignToken.Values.Readonly.Color`. It may return a readonly value, which is copied and frozen like any token value. A recipe whose function takes an object builds a class value from named fields. A set of recipes is extended by spreading it. Adds the `Library.Computed`, `Library.Recipe`, `Library.RecipeArguments` and `Library.Recipes` types.
- `extend(config, { recipes: [override(recipe, fn)] })` replaces a recipe's function in the extended library, for every token that uses it, including the ones it doesn't restate. `override()` checks that `fn` takes the recipe's arguments and returns its result's type. Adds the `Library.ExtendOptions` and `Library.RecipeOverride` types.
- A custom type's converter in `toCSS` can be `false`, which leaves tokens of that type out of the CSS (#58). `toProperties` accepts the same `converters` option and leaves out those tokens. Every custom type still needs an entry, so a forgotten converter is still an error. Adds the `CSSConverterEntries` and `ToPropertiesOptions` types.
- `convert(type, value)` converts a value of a standard type to CSS, the way `toCSS` does for a token of the type, for a converter of a custom type that has values of standard types (#65). `DesignToken.ValueByType`, the value of each standard type keyed by its name, like `color`, is public.
- `toCSS` takes a converter for a standard type in `converters`, which is used in place of the one of the library (#65). A library without custom types takes converters for the standard types, and no others.
- `$root` as a token in its group, and not at the top level of a library (its CSS custom property is named for the group), `$deprecated` on tokens, and group metadata (`$description`, `$extensions`, `$deprecated`) that survives `extend()`. A circular reference throws a `CircularReferenceError`, whose `chain` and message list the tokens in the cycle (`a → b → a`), instead of overflowing the stack.
- Custom token types via `DesignToken.Custom<Name, Value>`, with static values, aliases, deep aliases, group type inheritance, `set()` and `extend()` support. Reserved DTCG type names are rejected at compile time.
- `toCSS(library, options)` accepts `options.converters`, a converter for each custom type that receives the value and the token. It's required for every custom type in the library. At runtime `toCSS` throws for a custom type without a converter.
- `Library.TokensOf`, `Library.TokenRecord`, `Library.GroupType`, `CSSOptions`, `CSSConverter`, `CSSConverters` and `CustomTokensOf` types.
- `Token.toString()` returns a JSON representation of the token's `name`, `$type`, resolved `$value`, `$description`, `$extensions` and `$deprecated`. It throws a `CircularReferenceError` for a token in a cycle. It was declared but stringified as `[object Object]`.

### Changed

- **Breaking:** a token's value is deeply readonly (#24). It's frozen, including nested objects, arrays and their items, and `Token.$value` is typed `DesignToken.ReadonlyValueByToken`, so subscriber records and converter arguments are readonly too. `convert()` and the converters for the standard types take the readonly values, and `set()` takes them as well, so `set(other.$value)` compiles. The config passed to `create()` isn't frozen, and a class instance or function in a value isn't copied, so it isn't frozen. Adds the `DesignToken.Values.Readonly` types, `DesignToken.ReadonlyValueByType` and `DesignToken.DeepReadonly`.
- **Breaking:** an alias is a ref, `$value: ref("colors.primary")`, instead of a function given the library's tokens, and a function in a value is never called. `Library.Context`, `Library.ValueAlias`, `Library.Alias`, `Library.ValueSource` and `Library.DeepAlias` are removed, and `Token.set()` takes the same values as a config, including deep refs.
- A token's value is a copy of plain data, made from its own properties: symbol-keyed and non-enumerable properties are kept, an object that is in the value twice, or in itself, has one copy, and a getter is read once into a data property. Plain data is an array that isn't a subclass of `Array`, or an object whose prototype chain has at most one link, including an object literal from another realm. Anything else, including a function, is returned as it is.
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
- `Library.extend()` config is typed with the new `Library.ExtendConfig` and its type parameter defaults to `{}` instead of `any`.

### Fixed

- A token's value, which is readonly, can be the `$value` of a token in `create()` or `extend()`, and the argument of a recipe, as it can be given to `set()` (#92). A value whose objects or arrays are readonly is accepted too, also with refs in it. `Library.DeepValue` makes the properties and elements of a value readonly.
- `set()` on a token of a library that extends an extended library changes that token, and not the token of the library it extends (#91).
- `Token.set()` with the value the token already has, by `Object.is`, doesn't notify subscribers or resolve the token again (#22). On an extended token it still detaches the token from its source.
- `extend()` throws, naming the token, when an override's `$type` differs from the source token's type, including a type the source token inherits from its group (#16). Restating the same type is allowed.
- `extend()` accepts a group's `$type` when it's the group's own type, so a shared group config that sets it can be given to `extend()`, and throws, naming the group, when it's different (#95). A different group type was ignored, and restating the same one was a compile error.
- A value that isn't plain data, such as a class instance, a `Date`, a `Map` or a `Set`, is returned as it is. It was copied to a plain object, which lost its prototype and internal state, and a function property of it was called as an alias (#55). A cyclic value no longer overflows the stack.
- `extend()` has an overload for a config that only has values of tokens, which has no tokens to infer (#62). A new token with a value of the wrong type is reported for the call, as no overload matching, instead of for the token.
- A custom token type with a value type that contains itself, like a tree, compiles (#61).
- `DeepAlias` accepts aliases inside Gradient stops (#28).
- Resolving a token of an extended library no longer disconnects its source token from its dependencies, which left the source token reported as changed when a dependency it no longer used changed.
- Number aliases in a CubicBezier accept Number tokens (#29).
- `Library.extend()` no longer throws when the source library contains groups.
- `Library.extend()` supports adding new groups, and new tokens inherit the type of their ancestor group.
- `Library.extend()` accepts alias values when overriding existing tokens, and resolves them against the extending library.
- `Library.extend()` throws when a new token has no type and no ancestor group type, matching `Library.create()`.
- `Library.extend()` shallow-merges `$extensions` overrides into the source token's, with override keys winning. An extended token's `$extensions` is always a new object, so mutating it no longer changes the source token.
- Library groups expose their declared `type` (non-enumerable), matching the `TokenLibrary` type.
- `Library.create()` and `extend()` configs accept `null` and `undefined` entries, which are ignored at runtime like other non-token entries.
- The root of `library.tokens` (for created and extended libraries) and the object returned by `toProperties` are frozen, like nested groups. Adding or deleting a top-level key throws in strict mode.
- A token's `$extensions` is a shallow copy of the config's at `Library.create()`, so adding, removing or replacing a top-level key in the config no longer changes the token. Nested values are shared with the config.
- Array entries in `Library.create()` and `extend()` configs are ignored like other non-token entries, instead of creating an empty group (which `toProperties` also emitted).
- A library subscriber that throws no longer stops later subscribers from being notified. Every subscriber is called, then each error is re-thrown as the same instance in its own microtask, so it surfaces as an uncaught error, like a DOM event listener's.
- Tokens in a config whose shape is inferred (no type argument to `Library.create()` or `extend()`) are checked against their `$type`, and their `$value` and `set()` use that type's value instead of the widened literal. Their `$type` keeps its literal type, including a custom type's name. A token with a child (a key without a `$` prefix), which `create()` throws for, is a type error. Custom types and tokens that inherit a group's type are not checked. `Library.ConfigValueCheck` and `Library.ConfigTypeHint` are added. Requires TypeScript 5.4 or later (`NoInfer`).

## [0.1.0] - 2023-05-16

### Added

Initial release of the package.
