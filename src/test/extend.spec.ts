import { suite } from "uvu";
import * as Assert from "uvu/assert";
import { DesignToken } from "../lib/design-token.js";
import { createUntyped, nextUpdate, recorder } from "./helpers.js";

const Extend = suite("Library.extend");
const C = DesignToken.Type.Color;

const abSource = () =>
    createUntyped({
        a: { type: C, value: "#111111" },
        b: { type: C, value: (context: any) => context.a },
    });

Extend.skip(
    "[E1] extend({}) works on a library with a group (fails: D6)",
    () => {
        const source = createUntyped({
            g: { type: C, a: { value: "#111111" } },
        });
        const extended = source.extend({});

        Assert.is(extended.tokens.g.a.value, "#111111");
    },
);

Extend.skip(
    "[E2] extend({}) preserves names in a deeply nested library (fails: D6)",
    () => {
        const source = createUntyped({
            g: { h: { i: { type: C, t: { value: "#111111" } } } },
        });
        const extended = source.extend({});

        Assert.is(extended.tokens.g.h.i.t.name, "g.h.i.t");
        Assert.is(extended.tokens.g.h.i.t.value, "#111111");
    },
);

Extend.skip("[E3] overrides a token inside a nested group (fails: D6)", () => {
    const source = createUntyped({
        g: { type: C, a: { value: "#111111" }, b: { value: "#222222" } },
    });
    const extended = source.extend({ g: { a: { value: "#999999" } } });

    Assert.is(extended.tokens.g.a.value, "#999999");
    Assert.is(extended.tokens.g.b.value, "#222222");
});

Extend.skip("[E4] adds a new group (fails: D7)", () => {
    const source = createUntyped({ a: { type: C, value: "#111111" } });
    const extended = source.extend({
        g: { b: { type: C, value: "#222222" } },
    });

    Assert.is(extended.tokens.g.b.value, "#222222");
    Assert.is(extended.tokens.g.b.name, "g.b");
});

Extend.skip(
    "[E5] a new token in an existing group inherits the group's type (fails: D6)",
    () => {
        const source = createUntyped({
            g: { type: C, a: { value: "#111111" } },
        });
        const extended = source.extend({ g: { b: { value: "#222222" } } });

        Assert.is(extended.tokens.g.b.type, C);
    },
);

Extend.skip("[E6] an override can be an alias function (fails: D8)", () => {
    const source = createUntyped({
        a: { type: C, value: "#111111" },
        b: { type: C, value: "#222222" },
    });
    const extended = source.extend({
        b: { value: (context: any) => context.a },
    });

    Assert.is(extended.tokens.b.value, "#111111");
});

Extend("[E7] an override can contain a deep alias", () => {
    const source = createUntyped({
        a: { type: C, value: "#111111" },
        border: {
            type: DesignToken.Type.Border,
            value: { color: "#000000", width: "1px", style: "solid" },
        },
    });
    const extended = source.extend({
        border: {
            value: {
                color: (context: any) => context.a,
                width: "2px",
                style: "solid",
            },
        },
    });

    Assert.equal(extended.tokens.border.value, {
        color: "#111111",
        width: "2px",
        style: "solid",
    });
});

Extend.skip(
    "[E8] a new token without a resolvable type throws, matching create (fails: D9)",
    () => {
        const source = createUntyped({ a: { type: C, value: "#111111" } });

        Assert.throws(() => source.extend({ c: { value: "#222222" } }), /'c'/);
    },
);

Extend(
    "[E9] inherited aliases resolve against the extending library's overrides",
    () => {
        const extended = abSource().extend({ a: { value: "#999999" } });

        Assert.is(extended.tokens.b.value, "#999999");
    },
);

Extend("[E10] overriding does not mutate the source library", () => {
    const source = abSource();
    const extended = source.extend({ a: { value: "#999999" } });
    extended.tokens.b.value;

    Assert.is(source.tokens.a.value, "#111111");
    Assert.is(source.tokens.b.value, "#111111");
});

Extend("[E11] set() on an inherited token detaches it from the source", () => {
    const source = createUntyped({ a: { type: C, value: "#111111" } });
    const extended = source.extend({});

    extended.tokens.a.set("#222222");
    source.tokens.a.set("#333333");

    Assert.is(source.tokens.a.value, "#333333");
    Assert.is(extended.tokens.a.value, "#222222");
});

Extend(
    "[E12] set() on an extended token notifies only the extending library",
    async () => {
        const source = createUntyped({ a: { type: C, value: "#111111" } });
        const extended = source.extend({});
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
    "[E13] source changes notify the extending library even if the token was never read",
    async () => {
        const source = createUntyped({ a: { type: C, value: "#111111" } });
        const extended = source.extend({});
        const subscriber = recorder();
        extended.subscribe(subscriber);

        source.tokens.a.set("#222222");
        await nextUpdate();

        Assert.equal(subscriber.batches, [["a"]]);
    },
);

Extend(
    "[E14] chained extends propagate source changes to the last library",
    () => {
        const source = abSource();
        const grandchild = source.extend({}).extend({});

        source.tokens.a.set("#333333");

        Assert.is(grandchild.tokens.a.value, "#333333");
        Assert.is(grandchild.tokens.b.value, "#333333");
    },
);

Extend(
    "[E15] in chained extends, the middle library's override reaches the last library",
    () => {
        const grandchild = abSource()
            .extend({ a: { value: "#999999" } })
            .extend({});

        Assert.is(grandchild.tokens.a.value, "#999999");
        Assert.is(grandchild.tokens.b.value, "#999999");
    },
);

Extend.skip(
    "[E16][DECIDE: D10] description and extensions overrides are applied (fails: D10)",
    () => {
        const source = createUntyped({
            a: {
                type: C,
                value: "#111111",
                description: "source",
                extensions: { s: 1 },
            },
        });
        const extended = source.extend({
            a: {
                value: "#222222",
                description: "extended",
                extensions: { e: 1 },
            },
        });

        Assert.is(extended.tokens.a.description, "extended");
        Assert.equal(extended.tokens.a.extensions, { e: 1 });
    },
);

Extend.skip(
    "[E18][DECIDE: D12] mutating extended extensions does not leak to the source (fails: D12)",
    () => {
        const source = createUntyped({
            a: { type: C, value: "#111111", extensions: {} },
        });
        const extended = source.extend({});

        extended.tokens.a.extensions.x = 1;

        Assert.equal(source.tokens.a.extensions, {});
    },
);

Extend("[E19a] tokens of a flat extended library cannot be reassigned", () => {
    const extended = createUntyped({
        a: { type: C, value: "#111111" },
    }).extend({});

    Assert.throws(() => (extended.tokens.a = {}), "token");
    Assert.throws(() => (extended.tokens.a.value = "#222222"), "value");
    Assert.throws(() => (extended.tokens.a.type = C), "type");
    Assert.throws(() => (extended.tokens.a.extensions = {}), "extensions");
});

Extend.skip(
    "[E19b] the extended library root and groups are frozen (fails: D6, U3)",
    () => {
        const extended = createUntyped({
            a: { type: C, value: "#111111" },
            g: { type: C, b: { value: "#222222" } },
        }).extend({});

        Assert.ok(Object.isFrozen(extended.tokens), "root");
        Assert.ok(Object.isFrozen(extended.tokens.g), "group");
        Assert.throws(() => (extended.tokens.g = {}), "assigning a group");
    },
);

Extend(
    "[E20] extended library keys are source keys followed by new keys",
    () => {
        const extended = abSource().extend({
            c: { type: C, value: "#333333" },
        });

        Assert.equal(Object.keys(extended.tokens), ["a", "b", "c"]);
    },
);

Extend("[E21] sibling extensions of one source are independent", () => {
    const source = abSource();
    const first = source.extend({ a: { value: "#AAAAAA" } });
    const second = source.extend({});

    second.tokens.a.set("#BBBBBB");

    Assert.is(first.tokens.b.value, "#AAAAAA");
    Assert.is(second.tokens.b.value, "#BBBBBB");
    Assert.is(source.tokens.b.value, "#111111");
});

Extend(
    "[E22] after detaching, source changes no longer notify the extending library",
    async () => {
        const source = createUntyped({ a: { type: C, value: "#111111" } });
        const extended = source.extend({});
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
    "[E23] reading an extended token does not corrupt the source token's dependency tracking (fails: D14)",
    async () => {
        const source = createUntyped({
            a: { type: C, value: "#111111" },
            c: { type: C, value: "#333333" },
            b: { type: C, value: (context: any) => context.a },
        });
        source.tokens.b.value;
        source.extend({}).tokens.b.value;

        source.tokens.b.set((context: any) => context.c);
        source.tokens.b.value;
        await nextUpdate();
        const subscriber = recorder();
        source.subscribe(subscriber);

        source.tokens.a.set("#222222");
        await nextUpdate();

        Assert.equal(subscriber.batches, [["a"]]);
    },
);

Extend.skip(
    "[E24] tokenless groups from the source and the extend config are kept (fails: D6, D7)",
    () => {
        const extended = createUntyped({
            g: {},
            b: { type: C, value: "#111111" },
        }).extend({ h: { x: 1 } });

        Assert.equal(Object.keys(extended.tokens), ["g", "b", "h"]);
        Assert.equal(Object.keys(extended.tokens.h), []);
    },
);

Extend.skip(
    "[E25] a token added via extend to a type-only source group inherits its type (fails: D6)",
    () => {
        const source = createUntyped({
            g: { type: C },
            b: { type: C, value: "#111111" },
        });
        const extended = source.extend({ g: { t: { value: "#222222" } } });

        Assert.ok("g" in source.tokens, "kept in the source");
        Assert.is(extended.tokens.g.t.type, C);
        Assert.is(extended.tokens.g.t.value, "#222222");
    },
);

Extend.run();
