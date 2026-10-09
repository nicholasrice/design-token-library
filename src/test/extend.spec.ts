import { suite } from "uvu";
import * as Assert from "uvu/assert";
import { DesignToken } from "../lib/design-token.js";
import { Library } from "../lib/library.js";
import { A, AB, ABC, aliasedPair, nextUpdate, recorder } from "./helpers.js";

const Extend = suite("Library.extend");
const C = DesignToken.Type.Color;

interface Grouped {
    g: { $type: DesignToken.Type.Color; a: DesignToken.Color };
}

const grouped = () =>
    Library.create<Grouped>({ g: { $type: C, a: { $value: "#111111" } } });

const single = () => Library.create<A>({ a: { $type: C, $value: "#111111" } });

Extend("extend({}) works on a library with a group", () => {
    const extended = grouped().extend<{}>({});

    Assert.is(extended.tokens.g.a.$value, "#111111");
});

Extend("extend({}) preserves names in a deeply nested library", () => {
    interface Theme {
        g: {
            h: {
                i: { $type: DesignToken.Type.Color; t: DesignToken.Color };
            };
        };
    }
    const source = Library.create<Theme>({
        g: { h: { i: { $type: C, t: { $value: "#111111" } } } },
    });
    const extended = source.extend<{}>({});

    Assert.is(extended.tokens.g.h.i.t.name, "g.h.i.t");
    Assert.is(extended.tokens.g.h.i.t.$value, "#111111");
});

Extend("overrides a token inside a nested group", () => {
    interface Theme {
        g: {
            $type: DesignToken.Type.Color;
            a: DesignToken.Color;
            b: DesignToken.Color;
        };
    }
    const source = Library.create<Theme>({
        g: { $type: C, a: { $value: "#111111" }, b: { $value: "#222222" } },
    });
    const extended = source.extend<{}>({ g: { a: { $value: "#999999" } } });

    Assert.is(extended.tokens.g.a.$value, "#999999");
    Assert.is(extended.tokens.g.b.$value, "#222222");
});

Extend("adds a new group", () => {
    const extended = single().extend<{ g: { b: DesignToken.Color } }>({
        g: { b: { $type: C, $value: "#222222" } },
    });

    Assert.is(extended.tokens.g.b.$value, "#222222");
    Assert.is(extended.tokens.g.b.name, "g.b");
});

Extend("a new token in an existing group inherits the group's type", () => {
    const extended = grouped().extend<{ g: { b: DesignToken.Color } }>({
        g: { b: { $value: "#222222" } },
    });

    Assert.is(extended.tokens.g.b.$type, C);
});

Extend("an override can be an alias function", () => {
    const source = Library.create<AB>({
        a: { $type: C, $value: "#111111" },
        b: { $type: C, $value: "#222222" },
    });
    const extended = source.extend<{}>({
        b: { $value: (context) => context.a },
    });

    Assert.is(extended.tokens.b.$value, "#111111");
});

Extend("an override can contain a deep alias", () => {
    interface Theme {
        a: DesignToken.Color;
        border: DesignToken.Border;
    }
    const source = Library.create<Theme>({
        a: { $type: C, $value: "#111111" },
        border: {
            $type: DesignToken.Type.Border,
            $value: { color: "#000000", width: "1px", style: "solid" },
        },
    });
    const extended = source.extend<{}>({
        border: {
            $value: {
                color: (context: Library.Context<Theme>) => context.a,
                width: "2px",
                style: "solid",
            },
        },
    });

    Assert.equal(extended.tokens.border.$value, {
        color: "#111111",
        width: "2px",
        style: "solid",
    });
});

Extend("a new token without a resolvable type throws, matching create", () => {
    Assert.throws(
        () =>
            single().extend<{ c: DesignToken.Color }>({
                // @ts-expect-error a token without an inherited type must declare one
                c: { $value: "#222222" },
            }),
        /'c'/,
    );
});

Extend(
    "inherited aliases resolve against the extending library's overrides",
    () => {
        const extended = aliasedPair().extend<{}>({ a: { $value: "#999999" } });

        Assert.is(extended.tokens.b.$value, "#999999");
    },
);

Extend("overriding does not mutate the source library", () => {
    const source = aliasedPair();
    const extended = source.extend<{}>({ a: { $value: "#999999" } });
    extended.tokens.b.$value;

    Assert.is(source.tokens.a.$value, "#111111");
    Assert.is(source.tokens.b.$value, "#111111");
});

Extend("set() on an inherited token detaches it from the source", () => {
    const source = single();
    const extended = source.extend<{}>({});

    extended.tokens.a.set("#222222");
    source.tokens.a.set("#333333");

    Assert.is(source.tokens.a.$value, "#333333");
    Assert.is(extended.tokens.a.$value, "#222222");
});

Extend(
    "set() on an extended token notifies only the extending library",
    async () => {
        const source = single();
        const extended = source.extend<{}>({});
        const sourceSubscriber = recorder();
        const extendedSubscriber = recorder();
        source.subscribe(sourceSubscriber);
        extended.subscribe(extendedSubscriber);

        extended.tokens.a.set("#222222");
        await nextUpdate();

        Assert.equal(sourceSubscriber.batches, []);
        Assert.equal(extendedSubscriber.batches, [["a"]]);
    },
);

Extend(
    "source changes notify the extending library even if the token was never read",
    async () => {
        const source = single();
        const extended = source.extend<{}>({});
        const subscriber = recorder();
        extended.subscribe(subscriber);

        source.tokens.a.set("#222222");
        await nextUpdate();

        Assert.equal(subscriber.batches, [["a"]]);
    },
);

Extend("chained extends propagate source changes to the last library", () => {
    const source = aliasedPair();
    const grandchild = source.extend<{}>({}).extend<{}>({});

    source.tokens.a.set("#333333");

    Assert.is(grandchild.tokens.a.$value, "#333333");
    Assert.is(grandchild.tokens.b.$value, "#333333");
});

Extend(
    "in chained extends, the middle library's override reaches the last library",
    () => {
        const grandchild = aliasedPair()
            .extend<{}>({ a: { $value: "#999999" } })
            .extend<{}>({});

        Assert.is(grandchild.tokens.a.$value, "#999999");
        Assert.is(grandchild.tokens.b.$value, "#999999");
    },
);

const withExtensions = (extensions: Record<string, unknown>) =>
    Library.create<A>({
        a: {
            $type: C,
            $value: "#111111",
            $description: "source",
            $extensions: extensions,
        },
    });

Extend.skip(
    "a description override replaces and an extensions override merges (fails: #15)",
    () => {
        const extended = withExtensions({ s: 1 }).extend<{}>({
            a: {
                $value: "#222222",
                $description: "extended",
                $extensions: { e: 1 },
            },
        });

        Assert.is(extended.tokens.a.$description, "extended");
        Assert.equal(extended.tokens.a.$extensions, { s: 1, e: 1 });
    },
);

Extend.skip("when merging extensions, override keys win (fails: #15)", () => {
    const extended = withExtensions({ k: 1, s: 1 }).extend<{}>({
        a: { $value: "#222222", $extensions: { k: 2 } },
    });

    Assert.equal(extended.tokens.a.$extensions, { k: 2, s: 1 });
});

Extend.skip(
    "merging extensions leaves the source and the override config unchanged (fails: #15)",
    () => {
        const override = { k: 2 };
        const source = withExtensions({ s: 1 });
        const extended = source.extend<{}>({
            a: { $value: "#222222", $extensions: override },
        });

        Assert.equal(extended.tokens.a.$extensions, { s: 1, k: 2 }, "merged");
        Assert.equal(source.tokens.a.$extensions, { s: 1 }, "source");
        Assert.equal(override, { k: 2 }, "override config");
        Assert.is.not(extended.tokens.a.$extensions, override);
    },
);

Extend.skip(
    "extensions merge shallowly: a nested override object replaces the source's (fails: #15)",
    () => {
        const extended = withExtensions({ theme: { a: 1 }, s: 1 }).extend<{}>({
            a: { $value: "#222222", $extensions: { theme: { b: 1 } } },
        });

        Assert.equal(extended.tokens.a.$extensions, {
            theme: { b: 1 },
            s: 1,
        });
    },
);

Extend.skip(
    "overrides without description or extensions keep the source's (fails: #15)",
    () => {
        const source = withExtensions({ s: 1 });
        const extended = source.extend<{}>({ a: { $value: "#222222" } });

        Assert.is(extended.tokens.a.$description, "source");
        Assert.equal(extended.tokens.a.$extensions, { s: 1 });
        Assert.is.not(
            extended.tokens.a.$extensions,
            source.tokens.a.$extensions,
        );
    },
);

Extend.skip("an override with a different type throws (fails: #16)", () => {
    const source = single();

    Assert.throws(
        () =>
            source.extend<{}>({
                // @ts-expect-error an override can't change a token's type
                a: { $type: DesignToken.Type.Dimension, $value: "1px" },
            }),
        /'a'/,
    );
});

Extend("an override restating the same type is allowed", () => {
    const extended = single().extend<{}>({
        a: { $type: C, $value: "#222222" },
    });

    Assert.is(extended.tokens.a.$type, C);
    Assert.is(extended.tokens.a.$value, "#222222");
});

Extend.skip(
    "an inherited token's extensions are a new, equal object (fails: #15)",
    () => {
        const source = withExtensions({ s: 1 });
        const extended = source.extend<{}>({});

        Assert.is.not(
            extended.tokens.a.$extensions,
            source.tokens.a.$extensions,
        );
        Assert.equal(extended.tokens.a.$extensions, { s: 1 });
    },
);

Extend.skip(
    "mutating extended extensions does not leak to the source (fails: #15)",
    () => {
        const source = withExtensions({});
        const extended = source.extend<{}>({});

        extended.tokens.a.$extensions.x = 1;

        Assert.equal(source.tokens.a.$extensions, {});
    },
);

Extend("tokens of a flat extended library cannot be reassigned", () => {
    const extended = single().extend<{}>({});

    // @ts-expect-error tokens are readonly
    Assert.throws(() => (extended.tokens.a = {}), "token");
    // @ts-expect-error token values are readonly
    Assert.throws(() => (extended.tokens.a.$value = "#222222"), "value");
    // @ts-expect-error token types are readonly
    Assert.throws(() => (extended.tokens.a.$type = C), "type");
    // @ts-expect-error token extensions are readonly
    Assert.throws(() => (extended.tokens.a.$extensions = {}), "extensions");
});

Extend.skip(
    "the extended library root and groups are frozen (fails: #23)",
    () => {
        interface Theme extends Grouped {
            b: DesignToken.Color;
        }
        const extended = Library.create<Theme>({
            b: { $type: C, $value: "#111111" },
            g: { $type: C, a: { $value: "#222222" } },
        }).extend<{}>({});

        Assert.ok(Object.isFrozen(extended.tokens), "root");
        Assert.ok(Object.isFrozen(extended.tokens.g), "group");
        // @ts-expect-error groups are readonly
        Assert.throws(() => (extended.tokens.g = {}), "assigning a group");
    },
);

Extend("extended library keys are source keys followed by new keys", () => {
    const extended = aliasedPair().extend<{ c: DesignToken.Color }>({
        c: { $type: C, $value: "#333333" },
    });

    Assert.equal(Object.keys(extended.tokens), ["a", "b", "c"]);
});

Extend("sibling extensions of one source are independent", () => {
    const source = aliasedPair();
    const first = source.extend<{}>({ a: { $value: "#AAAAAA" } });
    const second = source.extend<{}>({});

    second.tokens.a.set("#BBBBBB");

    Assert.is(first.tokens.b.$value, "#AAAAAA");
    Assert.is(second.tokens.b.$value, "#BBBBBB");
    Assert.is(source.tokens.b.$value, "#111111");
});

Extend(
    "after detaching, source changes no longer notify the extending library",
    async () => {
        const source = single();
        const extended = source.extend<{}>({});
        extended.tokens.a.set("#222222");
        await nextUpdate();
        const subscriber = recorder();
        extended.subscribe(subscriber);

        source.tokens.a.set("#333333");
        await nextUpdate();

        Assert.equal(subscriber.batches, []);
    },
);

Extend.skip(
    "reading an extended token does not corrupt the source token's dependency tracking (fails: #19)",
    async () => {
        const source = Library.create<ABC>({
            a: { $type: C, $value: "#111111" },
            c: { $type: C, $value: "#333333" },
            b: { $type: C, $value: (context) => context.a },
        });
        source.tokens.b.$value;
        source.extend<{}>({}).tokens.b.$value;

        source.tokens.b.set((context) => context.c);
        source.tokens.b.$value;
        await nextUpdate();
        const subscriber = recorder();
        source.subscribe(subscriber);

        source.tokens.a.set("#222222");
        await nextUpdate();

        Assert.equal(subscriber.batches, [["a"]]);
    },
);

Extend(
    "tokenless groups from the source and the extend config are kept",
    () => {
        interface Theme {
            g: {};
            b: DesignToken.Color;
        }
        const extended = Library.create<Theme>({
            g: {},
            b: { $type: C, $value: "#111111" },
        }).extend<{ h: {} }>({ h: {} });

        Assert.equal(Object.keys(extended.tokens), ["g", "b", "h"]);
        Assert.equal(Object.keys(extended.tokens.h), []);
    },
);

Extend(
    "a token added via extend to a type-only source group inherits its type",
    () => {
        interface Theme {
            g: { $type: DesignToken.Type.Color };
            b: DesignToken.Color;
        }
        const source = Library.create<Theme>({
            g: { $type: C },
            b: { $type: C, $value: "#111111" },
        });
        const extended = source.extend<{ g: { t: DesignToken.Color } }>({
            g: { t: { $value: "#222222" } },
        });

        Assert.ok("g" in source.tokens, "kept in the source");
        Assert.is(extended.tokens.g.t.$type, C);
        Assert.is(extended.tokens.g.t.$value, "#222222");
    },
);

Extend.run();
