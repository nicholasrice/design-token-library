# Subscriptions and lazy evaluation

## Change subscription

After [creating a library](/design-token-library/#create-and-use-a-library), subscribe to batched change notifications:

```ts
const subscriber: Library.Subscriber<IMyLibrary> = {
  onChange: (tokens) => {
    tokens.forEach((token) => {
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

Notifications run once per microtask per batch of changes.

## What a subscriber is told of

A library with a subscriber resolves its tokens when it's first subscribed, and each `set()` reaches every token that depends on the one set, read or not. When the batch is delivered, each reached token is resolved again if a token it depends on changed, and the batch has only the tokens whose values changed. A token that resolves to a value equal to the one it had keeps it, as described in [Value semantics](../token-values/value-semantics#equal-values), and isn't in the batch. Neither are the tokens that depend only on it, which aren't resolved again.

```ts
const library = Library.create<{ a: DesignToken.Color; b: DesignToken.Color }>({
  a: { $type: DesignToken.Type.Color, $value: { colorSpace: "srgb", components: [0, 0, 0] } },
  b: { $type: DesignToken.Type.Color, $value: ref("a") },
});

library.subscribe({ onChange(tokens) { /* ... */ } });

// Notifies `a` and `b`, though `b` hasn't been read
library.tokens.a.set({ colorSpace: "srgb", components: [1, 1, 1] });

// Notifies nothing: an equal color
library.tokens.a.set({ colorSpace: "srgb", components: [1, 1, 1] });
```

`subscribe()` sends no batch of its own. A token that throws doesn't stop `subscribe()` or `set()`: it throws when it's read, and a token that starts or stops throwing is in the batch.

A library without a subscriber is lazy: a token is resolved when it's read, and a `set()` only drops the values that depend on it. The last `unsubscribe()` makes a library lazy again, keeping the values it has.

An extension's subscriber is told of the extension's own tokens: those it gives a value, those that call a recipe it overrides, directly or in a recipe's result, those whose recipe's result refers to one of its own tokens, and those that depend on them. To find them, the first `subscribe()` resolves each of its source's tokens that calls a recipe, and a change that reaches such a token resolves it again. Its other tokens are its source's values, the same objects, and a change to them isn't in its batches.
