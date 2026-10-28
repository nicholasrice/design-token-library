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

## Lazy evaluation

Token values are lazy. A computed or alias token that has never been read does not appear in change notifications when its dependencies change:

```ts
const library = Library.create<{ a: DesignToken.Color; b: DesignToken.Color }>({
  a: { $type: DesignToken.Type.Color, $value: { colorSpace: "srgb", components: [0, 0, 0] } },
  b: { $type: DesignToken.Type.Color, $value: ref("a") },
});

library.subscribe({ onChange(tokens) { /* ... */ } });

// Notifies only `library.tokens.a`
library.tokens.a.set({ colorSpace: "srgb", components: [1, 1, 1] });

const b = library.tokens.b.$value;

// Notifies `a` and `b`
library.tokens.a.set({ colorSpace: "srgb", components: [0.07, 0.07, 0.07] });
```

Read dependent tokens (or their `$value`) before relying on them in subscribers.
