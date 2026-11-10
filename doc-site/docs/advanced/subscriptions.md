# Subscriptions and lazy evaluation

## Change subscription

After [creating a library](/design-token-library/#create-and-use-a-library), subscribe to batched change notifications:

```ts
const subscriber: Library.Subscriber<IMyLibrary> = {
  onChange: (changes) => {
    changes.forEach(({ token }) => {
      /* react to changed tokens */
    });
  },
};
library.subscribe(subscriber);

library.tokens.colors.foreground.set({
  colorSpace: "srgb",
  components: [0.53, 0.53, 0.53],
});
```

Notifications run once per microtask per batch of changes. Each change is a `Library.Change`:

| Field | |
|---|---|
| `token` | The token |
| `valueChanged` | Its value changed |
| `origin` | `"own"`, or `"ancestor"` for an extension's token whose value is its ancestor's. Always `"own"` in a library made by `create()` |
| `originChanged` | It became the extension's own |

At least one of `valueChanged` and `originChanged` is true.

## What a subscriber is told of

A library with a subscriber resolves its tokens when it's first subscribed, and each `set()` reaches every token that depends on the one set, read or not. When the batch is delivered, each reached token is resolved again if a token it depends on changed, and the batch has only the tokens whose values changed. A token that resolves to a value equal to the one it had keeps it, as described in [Value semantics](../token-values/value-semantics#equal-values), and isn't in the batch. Neither are the tokens that depend only on it, which aren't resolved again.

```ts
const library = Library.create<{ a: DesignToken.Color; b: DesignToken.Color }>({
  a: { $type: DesignToken.Type.Color, $value: { colorSpace: "srgb", components: [0, 0, 0] } },
  b: { $type: DesignToken.Type.Color, $value: ref("a") },
});

library.subscribe({ onChange(changes) { /* ... */ } });

// Notifies `a` and `b`, though `b` hasn't been read
library.tokens.a.set({ colorSpace: "srgb", components: [1, 1, 1] });

// Notifies nothing: an equal color
library.tokens.a.set({ colorSpace: "srgb", components: [1, 1, 1] });
```

`subscribe()` sends no batch of its own. A token that throws doesn't stop `subscribe()` or `set()`: it throws when it's read, and a token that starts or stops throwing is in the batch.

A library without a subscriber is lazy: a token is resolved when it's read, and a `set()` only drops the values that depend on it. The last `unsubscribe()` makes a library lazy again, keeping the values it has.

## Extensions

An extension's subscriber is told of the extension's own tokens: those it gives a value, those that are set, those new in it, those that call a recipe it overrides, and those that depend on one of them, including through a ref a recipe's result has. Its other tokens are its ancestor's values, the same objects, and a change to them isn't in its batches: its ancestor reports it.

A token becomes the extension's own when it's set, even to the value it had, or when a token it depends on becomes its own. Its change has `originChanged`, and `valueChanged` only if its value isn't equal to the one it had. Nothing makes a token its ancestor's again.

```ts
const extension = library.extend({});
extension.subscribe({ onChange(changes) { /* ... */ } });

// `a` and `b`, with `originChanged` and not `valueChanged`
extension.tokens.a.set(library.tokens.a.$value);
```

A subscriber that holds only the extension and needs all of its values subscribes with `inherited: true`, and is also told of the tokens that are its ancestor's when their values change, with `origin: "ancestor"`. The extension then resolves those tokens too.

```ts
extension.subscribe(subscriber, { inherited: true });
```

`ownTokensOf()` lists an extension's own tokens, for a first render that writes only them, such as with [`toCSS`](../export/css-output)'s `filter`. It lists every token of a library made by `create()`. To find the tokens that a ref in a recipe's result makes its own, it resolves its ancestors' tokens that call recipes.

```ts
const own = new Set(ownTokensOf(extension));
const css = toCSS(extension, { filter: (token) => own.has(token) });
```
