# 1. Aliases are refs, and computed values are recipes

Status: proposed (2026-10-22)

## Context

Any function in a token value was an alias: `$value: (tokens) => tokens.a`. A function at any depth of a value was called with the library's tokens. That caused several problems:

- **A value couldn't be told apart from an alias.** A value that isn't plain data, such as a class instance, a `Date` or a `Map`, was copied to a plain object. It lost its prototype and internal state, and a function property of it was called as an alias (#55). Walking only plain data would keep the instance, but a function inside plain data would still be called as an alias.
- **"Alias" meant two things.** An alias is a reference to another token. In DTCG it's `"{group.token}"`. A function can also calculate a value, which isn't a reference.
- **Nothing could be serialized.** A function keeps neither the token it refers to nor what it calculates.
- **A calculation couldn't be replaced.** An extended library could only restate each token that used it, not swap the function out.
- **Writing a calculation was verbose.** The goal was to write `darken($.colors.primary, 0.2)`, but JavaScript evaluates arguments when the config is built, before any token exists. The function called has to return a description of the call, not a result.

An intermediate design made aliases explicit with `alias((tokens) => …)`, and offered `$` refs as a second notation. That left two ways to write a reference, and the `alias` form hid both its target and any calculation from serialization. It was dropped before it shipped.

## Decision

A token's value is data: a value, a ref, or a computed value, at any depth.

- **Refs.** `refs<T>()` returns a proxy that makes a ref for any path, and the same path is always the same ref. A ref is data: `{ [REF]: ["colors", "primary"] }`. Its type is `Library.Ref<V, TokenValues<R>>`, where `V` is the token's value type. The phantom field `[RESOLVES]?: (library: T) => V` carries the types, and it's never set. A ref can only be given to a library whose `TokenValues` include its token, with a value of that type. That holds for a declared shape, an extended shape (`Root extends Needs`, the case of #68), and a shape inferred from a config. The comparison is by token values, not by shapes, because an inferred shape contains the config's own values, refs included. A path that isn't a token throws when the token is read.
- **Recipes.** `recipes({ darken: darkenColor })` makes a recipe of each function, named by its key. Shorthand keys aren't changed by minifiers, unlike `fn.name`, and they're literal types. A recipe is a function that also carries `{ [RECIPE]: { name, fn } }`. Calling it returns a computed value, which is data: `{ [COMPUTED]: { recipe, args } }`. Each argument may be a value, a ref, a computed value, or a value with them in it (`Library.RecipeArguments`). The library shape `T` of the result is inferred from the refs among the arguments, or from the position the result is used in. With neither, it's `{}`, which any library accepts. There's no `recipe(fn)` for a single function: every recipe has a name, so every computed value can be serialized.
- **Overrides are bound late.** `library.extend(config, { recipes: [override(Recipes.darken, fn)] })` replaces the recipe's function in the new library, for every token that uses it, including the tokens it doesn't restate. A library has a scope of its tokens and a map from a recipe to the function that overrides it. An extended library copies its source's map and adds its own. The map is keyed by the recipe object, a typed pointer, not by its name, so two sets of recipes with the same names can't collide. `override(recipe, fn)` requires `fn` to be assignable to the recipe's function: it takes the recipe's arguments and returns its result's type.
- **One resolver.** A ref is replaced by its token's value. For a computed value, the resolver resolves every argument, then calls the function that overrides the recipe in the scope, or else the recipe's own. Arrays and plain objects (whose prototype is `Object.prototype` or `null`) are copied with their contents resolved. Anything else is returned by reference, which fixes #55: a value can be an object or a class instance with functions, and they're never called.
- **A function is never a value.** A function given as a token's `$value`, in a config, to `set()` or to `extend()`, is a type error. It also throws a `TypeError` that names the token and points to refs and recipes, as a migration aid for the old alias syntax. A function inside a value is a value, and is returned as it is. A custom value is data, and data may have functions: `DesignToken.Custom<"palette", Palette>` takes a class instance or an object with methods, which are never called. Only a value type that is, or may be, a function is rejected, because a value computed by a function is a recipe's. The old rule, that a custom value could contain no function anywhere, existed because a function in a value was an alias.
- **Symbols.** `REF`, `COMPUTED` and `RECIPE` are registered symbols (`Symbol.for`), so a ref made by another copy of the package, such as a linked one, is still a ref. They aren't exported from the package. A string key could collide with a property of a value, and could be forged by JSON.
- **No cache of a recipe's result by its arguments.** The token caches its value and resolves it again only when a token it read changes, which is when the arguments change. Recipes must be pure for that to be right.

## Consequences

- **Breaking.** An alias is `$.path`, not a function. A calculation is a recipe. `Library.Context`, `Library.ValueAlias`, `Library.Alias`, `Library.ValueSource` and `Library.DeepAlias` are removed. Nothing is given the library's tokens any more, so the problems of typing that context are gone with it (#60, #67, #68).
- **A calculation depends on all of its arguments.** A function could read a token only in one branch. A recipe resolves every argument first, so `pick($.flag, $.a, $.b)` recomputes when `b` changes, even while it picks `a`. The cost is an occasional extra recomputation.
- **Serialization has what it needs.** A ref's path and a computed value's recipe name and arguments are data. A serializer can write `"{colors.primary}"` and a named call. No serializer is built yet: reading `[REF]` and `[COMPUTED]` stays internal until one exists.
- **An override applies only to recipe calls in token values.** A function that calls another directly in JavaScript isn't affected. For that, the inner function has to be its own recipe call in the value.
- **A generic function's recipe takes the arguments of its constraint**, because `Parameters<F>` of a generic function isn't generic.
- Three assertions stand in for what TypeScript can't express:
  - `refs()` returns its proxy as `Refs<T>`, because a type can't describe a proxy's dynamic keys.
  - `recipes()` returns the object it builds key by key as `Recipes<F>`.
  - The library treats a resolved value as its token's value type, which the config's types guarantee.

## Alternatives considered

- **`alias(fn)` beside refs.** It's convenient in a typed config, but it's a second way to write a reference. It also hides its target from serialization, and it allows an anonymous calculation that can't be overridden.
- **Keep bare functions as aliases.** That doesn't fix #55, and the resolver still has to guess.
- **A registry with `extend()` and `lookup()` keyed by name.** Spreading already extends a set of recipes, and `Recipes[name]` is the lookup. Overrides belong to a library, not to a set of recipes, because the tokens that use a recipe are in a library. Keying by name reserves names and lets two sets collide.
- **Overrides keyed by name in a recipe type parameter of `Library`.** That adds a type parameter to every library for a feature most libraries don't use.
- **`recipe(fn)` for a single function.** It has no name to serialize. `const { darken } = recipes({ darken: darkenColor })` gives the same function with one.
- **Compare a ref's library by shape.** An inferred config's shape contains its own refs, so a ref could never be given to it.

## Not done

- A serializer, and the JSON overlay that parses `"{path}"` and recipe calls with a set of recipes. The `feat/dtcg-json` branch has a JSON-first design to start from: `{ "$recipe": name, "$with": { … } }` nodes with named parameters, `"{path}"` references, group recipes, and DTCG load and export. A recipe whose function takes one object parameter, as in `Recipes.palette({ base: $.accent, steps: 5 })`, maps to `$with`. Spreading sets of recipes can leave two recipes with the same name in one library, such as a `darken` replaced by a spread while tokens made with the first one keep it. A serializer writes a recipe by its name, so it should reject a library with two recipes of the same name.
- An expression language of math functions that can also be written to CSS as `calc()`, as in Adaptive UI's `expression.ts`. Its operations could be recipes with a CSS form.
- Group recipes, where one call makes several tokens.
