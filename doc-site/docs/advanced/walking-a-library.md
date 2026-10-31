# Walking a library

A tool that needs every token of a library, such as an index, a report or a list of the tokens to offer for a property, could walk `library.tokens` itself. It would then have to restate the library's rules for what is a token, what is a group, and which keys are children. [`entriesOf(library)`](/design-token-library/api-reference/design-token-library.entriesof) is that walk, as an iterable of entries in the order of the config. A group is listed before what is in it.

```ts
import { entriesOf } from "design-token-library";

for (const entry of entriesOf(library)) {
  if (entry.kind === "token") {
    console.log(entry.path.join("."), entry.token.$type);
  } else {
    // a group has the `$`-properties it was configured with
    console.log(entry.path.join("."), entry.group.$extensions);
  }
}
```

The order is that of the keys of a JavaScript object: a name that is an array index (`"0"`, `"123"`) is listed before the other names in its group, in ascending order, wherever it is in the config. Other names are in the order they were written.

A group's own token, `$root`, is listed as a token whose path ends with `$root`. The library itself is not listed, as the root of a DOM `TreeWalker` is not.

## What to show

`whatToShow` is `"token"`, `"group"` or `"all"` (the default). The entries are typed by it, so there is no check of `kind` when only one is shown. Groups are visited whichever it is, so `"token"` still lists the tokens in every group.

```ts
for (const { path, token } of entriesOf(library, { whatToShow: "token" })) {
  // ...
}
```

## Filtering

`filter` is called with each entry of the kinds shown, before what is under it is visited. It returns `true` to list the entry, `false` to leave it out, or `"reject"` to leave out a group and everything under it:

```ts
// Everything, except what is under a deprecated group
entriesOf(library, {
  filter: (entry) =>
    entry.kind === "group" && entry.group.$deprecated ? "reject" : true,
});
```

As for a `TreeWalker`, an entry that `whatToShow` leaves out is not passed to `filter`. To prune by group while listing only tokens, show `"all"` and return `false` for the groups.

The listing is lazy, and a token's `$value` is not read, so walking a large library resolves nothing.
