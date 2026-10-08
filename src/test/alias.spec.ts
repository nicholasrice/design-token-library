import { suite } from "uvu";
import * as Assert from "uvu/assert";
import { spy } from "sinon";
import * as Package from "../lib/index.js";
import { DesignToken } from "../lib/design-token.js";
import { createUntyped, nextUpdate, recorder } from "./helpers.js";

const Alias = suite("Library aliases");
const Circular = suite("Library circular aliases");
const C = DesignToken.Type.Color;

const isCircularReferenceError = (error: any) =>
    error instanceof Error && error.name === "CircularReferenceError";

Alias(
    "[V1] an alias returning a token and one returning a raw value resolve the same",
    () => {
        const library = createUntyped({
            a: { type: C, value: "#111111" },
            token: { type: C, value: (context: any) => context.a },
            raw: { type: C, value: (context: any) => context.a.value },
        });

        Assert.is(library.tokens.token.value, "#111111");
        Assert.is(library.tokens.raw.value, "#111111");
    },
);

Alias("[V2] an alias can reference a token in a different group", () => {
    const library = createUntyped({
        colors: { type: C, primary: { value: "#111111" } },
        borders: {
            type: DesignToken.Type.Border,
            x: {
                value: {
                    color: (context: any) => context.colors.primary,
                    width: "1px",
                    style: "solid",
                },
            },
        },
    });

    Assert.is(library.tokens.borders.x.value.color, "#111111");
});

Alias("[V3] deep aliases resolve inside array values", () => {
    const library = createUntyped({
        a: { type: C, value: "#111111" },
        n: { type: DesignToken.Type.Number, value: 0.5 },
        gradient: {
            type: DesignToken.Type.Gradient,
            value: [
                { color: (context: any) => context.a, position: 0 },
                { color: "#222222", position: 1 },
            ],
        },
        curve: {
            type: DesignToken.Type.CubicBezier,
            value: [(context: any) => context.n, 0, 1, 1],
        },
    });

    Assert.equal(library.tokens.gradient.value, [
        { color: "#111111", position: 0 },
        { color: "#222222", position: 1 },
    ]);
    Assert.equal(library.tokens.curve.value, [0.5, 0, 1, 1]);
});

Alias("[V4] a deep alias can reference a token that is itself an alias", () => {
    const library = createUntyped({
        d1: { type: DesignToken.Type.Dimension, value: "2px" },
        d2: {
            type: DesignToken.Type.Dimension,
            value: (context: any) => context.d1,
        },
        border: {
            type: DesignToken.Type.Border,
            value: {
                color: "#111111",
                width: "1px",
                style: {
                    dashArray: [(context: any) => context.d2, "4px"],
                    lineCap: "round",
                },
            },
        },
    });

    Assert.equal(library.tokens.border.value.style.dashArray, ["2px", "4px"]);
});

Alias(
    "[V5] a deep alias returning a token and one returning a raw value resolve the same",
    () => {
        const library = createUntyped({
            a: { type: C, value: "#111111" },
            token: {
                type: DesignToken.Type.Border,
                value: {
                    color: (context: any) => context.a,
                    width: "1px",
                    style: "solid",
                },
            },
            raw: {
                type: DesignToken.Type.Border,
                value: {
                    color: (context: any) => context.a.value,
                    width: "1px",
                    style: "solid",
                },
            },
        });

        Assert.is(library.tokens.token.value.color, "#111111");
        Assert.is(library.tokens.raw.value.color, "#111111");
    },
);

Alias("[V6] an alias is invoked once across repeated reads", () => {
    const alias = spy((context: any) => context.a);
    const library = createUntyped({
        a: { type: C, value: "#111111" },
        b: { type: C, value: alias },
    });

    library.tokens.b.value;
    library.tokens.b.value;
    library.tokens.b.value;

    Assert.is(alias.callCount, 1);
});

Alias(
    "[V7] an alias is re-invoked exactly once after its dependency changes",
    () => {
        const alias = spy((context: any) => context.a);
        const library = createUntyped({
            a: { type: C, value: "#111111" },
            b: { type: C, value: alias },
        });

        library.tokens.b.value;
        library.tokens.a.set("#222222");
        library.tokens.b.value;
        library.tokens.b.value;

        Assert.is(alias.callCount, 2);
        Assert.is(library.tokens.b.value, "#222222");
    },
);

Alias(
    "[V8] re-aliasing tracks the new dependency and drops the old one",
    async () => {
        const library = createUntyped({
            a: { type: C, value: "#111111" },
            b: { type: C, value: "#222222" },
            c: { type: C, value: (context: any) => context.a },
        });
        library.tokens.c.value;
        library.tokens.c.set((context: any) => context.b);
        library.tokens.c.value;
        await nextUpdate();

        const subscriber = recorder();
        library.subscribe(subscriber);

        library.tokens.a.set("#333333");
        await nextUpdate();
        Assert.equal(subscriber.batches, [["a"]], "old dependency ignored");

        library.tokens.b.set("#444444");
        await nextUpdate();
        Assert.equal(
            subscriber.batches[1],
            ["b", "c"],
            "new dependency tracked",
        );
        Assert.is(library.tokens.c.value, "#444444");
    },
);

Alias(
    "[V9] a conditional alias re-tracks dependencies when its branch flips",
    async () => {
        const library = createUntyped({
            flag: { type: DesignToken.Type.Number, value: 0 },
            a: { type: C, value: "#111111" },
            b: { type: C, value: "#222222" },
            c: {
                type: C,
                value: (context: any) =>
                    context.flag.value ? context.a : context.b,
            },
        });

        Assert.is(library.tokens.c.value, "#222222");

        library.tokens.flag.set(1);
        Assert.is(library.tokens.c.value, "#111111");
        await nextUpdate();

        const subscriber = recorder();
        library.subscribe(subscriber);

        library.tokens.b.set("#333333");
        await nextUpdate();
        Assert.equal(subscriber.batches, [["b"]], "inactive branch ignored");

        library.tokens.a.set("#444444");
        Assert.is(library.tokens.c.value, "#444444");
    },
);

Alias(
    "[V10] setting a static value stops tracking the previous alias dependency",
    async () => {
        const library = createUntyped({
            a: { type: C, value: "#111111" },
            b: { type: C, value: (context: any) => context.a },
        });
        library.tokens.b.value;
        library.tokens.b.set("#222222");
        library.tokens.b.value;
        await nextUpdate();

        const subscriber = recorder();
        library.subscribe(subscriber);
        library.tokens.a.set("#333333");
        await nextUpdate();

        Assert.equal(subscriber.batches, [["a"]]);
        Assert.is(library.tokens.b.value, "#222222");
    },
);

Alias(
    "[V11] a diamond dependency updates once with the correct value",
    async () => {
        const first = spy((context: any) => context.b);
        const second = spy((context: any) => context.c);
        const library = createUntyped({
            a: { type: C, value: "#111111" },
            b: { type: C, value: (context: any) => context.a },
            c: { type: C, value: (context: any) => context.a },
            d: {
                type: DesignToken.Type.Gradient,
                value: [
                    { color: first, position: 0 },
                    { color: second, position: 1 },
                ],
            },
        });
        library.tokens.d.value;

        const subscriber = recorder();
        library.subscribe(subscriber);
        library.tokens.a.set("#222222");
        await nextUpdate();

        const batch = subscriber.batches[0];
        Assert.is(batch.filter((name) => name === "d").length, 1);
        Assert.equal([...batch].sort(), ["a", "b", "c", "d"]);
        Assert.equal(library.tokens.d.value, [
            { color: "#222222", position: 0 },
            { color: "#222222", position: 1 },
        ]);
        Assert.is(first.callCount, 2);
        Assert.is(second.callCount, 2);
    },
);

Alias.skip(
    "[V13][DECIDE: U4] mutating a returned object value does not affect the token",
    () => {
        const library = createUntyped({
            a: {
                type: DesignToken.Type.Border,
                value: { color: "#111111", width: "1px", style: "solid" },
            },
        });

        try {
            library.tokens.a.value.width = "9px";
        } catch {}

        Assert.is(library.tokens.a.value.width, "1px");
    },
);

Alias.skip(
    "[V14][DECIDE: U5] mutating config extensions after create does not affect the token",
    () => {
        const extensions = { k: 1 };
        const library = createUntyped({
            a: { type: C, value: "#111111", extensions },
        });

        extensions.k = 2;

        Assert.equal(library.tokens.a.extensions, { k: 1 });
    },
);

Alias(
    "[V15] the alias context is the root token library for nested tokens",
    () => {
        const alias = spy((context: any) => context.a);
        const library = createUntyped({
            a: { type: C, value: "#111111" },
            g: { type: C, t: { value: alias } },
        });

        library.tokens.g.t.value;

        Assert.is(alias.firstCall.args[0], library.tokens);
    },
);

Circular.skip(
    "[V12a] a direct cycle throws CircularReferenceError (fails: U1)",
    () => {
        const library = createUntyped({
            a: { type: C, value: (context: any) => context.b },
            b: { type: C, value: (context: any) => context.a },
        });

        Assert.throws(() => library.tokens.a.value, isCircularReferenceError);
    },
);

Circular.skip("[V12b] a self-reference throws (fails: U1)", () => {
    const library = createUntyped({
        a: { type: C, value: (context: any) => context.a },
    });

    Assert.throws(() => library.tokens.a.value, isCircularReferenceError);
});

Circular.skip(
    "[V12c] the error message lists the reference chain (fails: U1)",
    () => {
        const library = createUntyped({
            a: { type: C, value: (context: any) => context.b },
            b: { type: C, value: (context: any) => context.a },
        });

        Assert.throws(() => library.tokens.a.value, /a → b → a/);
    },
);

Circular.skip("[V12d] a cycle through a deep alias throws (fails: U1)", () => {
    const library = createUntyped({
        self: {
            type: DesignToken.Type.Border,
            value: {
                color: (context: any) => context.self,
                width: "1px",
                style: "solid",
            },
        },
    });

    Assert.throws(() => library.tokens.self.value, isCircularReferenceError);
});

Circular.skip(
    "[V12e] a cycle created later via set() throws on the next read (fails: U1)",
    () => {
        const library = createUntyped({
            a: { type: C, value: "#111111" },
            b: { type: C, value: (context: any) => context.a },
        });
        library.tokens.b.value;

        library.tokens.a.set((context: any) => context.b);

        Assert.throws(() => library.tokens.a.value, isCircularReferenceError);
    },
);

Circular.skip(
    "[V12f] breaking a cycle with set() makes tokens resolve again (fails: U1)",
    () => {
        const library = createUntyped({
            a: { type: C, value: (context: any) => context.b },
            b: { type: C, value: (context: any) => context.a },
        });
        Assert.throws(() => library.tokens.a.value, isCircularReferenceError);

        library.tokens.a.set("#111111");

        Assert.is(library.tokens.a.value, "#111111");
        Assert.is(library.tokens.b.value, "#111111");
    },
);

Circular("[V12g] a non-cyclic diamond does not throw", () => {
    const library = createUntyped({
        a: { type: C, value: "#111111" },
        b: { type: C, value: (context: any) => context.a },
        c: { type: C, value: (context: any) => context.a },
        d: {
            type: DesignToken.Type.Gradient,
            value: [
                { color: (context: any) => context.b, position: 0 },
                { color: (context: any) => context.c, position: 1 },
            ],
        },
    });

    Assert.not.throws(() => library.tokens.d.value);
});

Circular.skip(
    "[V12h] a cycle introduced by an extend override throws in the extended library (fails: U1, D8)",
    () => {
        const source = createUntyped({
            a: { type: C, value: "#111111" },
            b: { type: C, value: (context: any) => context.a },
        });
        const extended = source.extend({
            a: { value: (context: any) => context.b },
        });

        Assert.throws(() => extended.tokens.a.value, isCircularReferenceError);
    },
);

Circular(
    "[V12i] the source library is unaffected by a cycle in an extending library",
    () => {
        const source = createUntyped({
            a: { type: C, value: "#111111" },
            b: { type: C, value: (context: any) => context.a },
        });
        const extended = source.extend({
            a: { value: (context: any) => context.b },
        });

        try {
            extended.tokens.a.value;
        } catch {}

        Assert.is(source.tokens.a.value, "#111111");
        Assert.is(source.tokens.b.value, "#111111");
    },
);

Circular.skip(
    "[V12j] CircularReferenceError is exported and extends Error (fails: U1)",
    () => {
        const ErrorClass = Reflect.get(Package, "CircularReferenceError");
        const library = createUntyped({
            a: { type: C, value: (context: any) => context.a },
        });

        Assert.type(ErrorClass, "function");
        Assert.throws(
            () => library.tokens.a.value,
            (error: any) =>
                error instanceof ErrorClass && error instanceof Error,
        );
    },
);

Alias.run();
Circular.run();
