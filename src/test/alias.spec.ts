import { suite } from "uvu";
import * as Assert from "uvu/assert";
import { spy } from "sinon";
import * as Package from "../lib/index.js";
import { DesignToken } from "../lib/design-token.js";
import { Library } from "../lib/library.js";
import { A, AB, ABC, aliasedPair, nextUpdate, recorder } from "./helpers.js";

const Alias = suite("Library aliases");
const Circular = suite("Library circular aliases");
const C = DesignToken.Type.Color;

const isCircularReferenceError = (error: unknown) =>
    error instanceof Error && error.name === "CircularReferenceError";

Alias(
    "an alias returning a token and one returning a raw value resolve the same",
    () => {
        interface Theme {
            a: DesignToken.Color;
            token: DesignToken.Color;
            raw: DesignToken.Color;
        }
        const library = Library.create<Theme>({
            a: { type: C, value: "#111111" },
            token: { type: C, value: (context) => context.a },
            raw: { type: C, value: (context) => context.a.value },
        });

        Assert.is(library.tokens.token.value, "#111111");
        Assert.is(library.tokens.raw.value, "#111111");
    },
);

Alias("an alias can reference a token in a different group", () => {
    interface Theme {
        colors: { type: DesignToken.Type.Color; primary: DesignToken.Color };
        borders: { type: DesignToken.Type.Border; x: DesignToken.Border };
    }
    const library = Library.create<Theme>({
        colors: { type: C, primary: { value: "#111111" } },
        borders: {
            type: DesignToken.Type.Border,
            x: {
                value: {
                    color: (context) => context.colors.primary,
                    width: "1px",
                    style: "solid",
                },
            },
        },
    });

    Assert.is(library.tokens.borders.x.value.color, "#111111");
});

Alias("deep aliases resolve inside array values", () => {
    interface Theme {
        a: DesignToken.Color;
        n: DesignToken.Number;
        gradient: DesignToken.Gradient;
        curve: DesignToken.CubicBezier;
    }
    const stops = [
        {
            color: (context: Library.Context<Theme>) => context.a,
            position: 0,
        },
        { color: "#222222", position: 1 },
    ];
    const library = Library.create<Theme>({
        a: { type: C, value: "#111111" },
        n: { type: DesignToken.Type.Number, value: 0.5 },
        gradient: {
            type: DesignToken.Type.Gradient,
            // @ts-expect-error type gap: DeepAlias doesn't support aliases in gradient stops (#28)
            value: stops,
        },
        curve: {
            type: DesignToken.Type.CubicBezier,
            // @ts-expect-error type gap: number elements alias FontWeight tokens, not Number tokens (#29)
            value: [(context) => context.n, 0, 1, 1],
        },
    });

    Assert.equal(library.tokens.gradient.value, [
        { color: "#111111", position: 0 },
        { color: "#222222", position: 1 },
    ]);
    Assert.equal(library.tokens.curve.value, [0.5, 0, 1, 1]);
});

/**
 * Narrows a Border's stroke style to its object form.
 */
function dashedStyle(border: DesignToken.Values.Border) {
    const { style } = border;
    if (typeof style === "string") {
        throw new Error(`Expected an object stroke style, got '${style}'`);
    }
    return style;
}

Alias("a deep alias can reference a token that is itself an alias", () => {
    interface Theme {
        d1: DesignToken.Dimension;
        d2: DesignToken.Dimension;
        border: DesignToken.Border;
    }
    const library = Library.create<Theme>({
        d1: { type: DesignToken.Type.Dimension, value: "2px" },
        d2: {
            type: DesignToken.Type.Dimension,
            value: (context) => context.d1,
        },
        border: {
            type: DesignToken.Type.Border,
            value: {
                color: "#111111",
                width: "1px",
                style: {
                    dashArray: [(context) => context.d2, "4px"],
                    lineCap: "round",
                },
            },
        },
    });

    Assert.equal(dashedStyle(library.tokens.border.value).dashArray, [
        "2px",
        "4px",
    ]);
});

Alias(
    "a deep alias returning a token and one returning a raw value resolve the same",
    () => {
        interface Theme {
            a: DesignToken.Color;
            token: DesignToken.Border;
            raw: DesignToken.Border;
        }
        const library = Library.create<Theme>({
            a: { type: C, value: "#111111" },
            token: {
                type: DesignToken.Type.Border,
                value: {
                    color: (context) => context.a,
                    width: "1px",
                    style: "solid",
                },
            },
            raw: {
                type: DesignToken.Type.Border,
                value: {
                    color: (context) => context.a.value,
                    width: "1px",
                    style: "solid",
                },
            },
        });

        Assert.is(library.tokens.token.value.color, "#111111");
        Assert.is(library.tokens.raw.value.color, "#111111");
    },
);

Alias("an alias is invoked once across repeated reads", () => {
    const alias = spy((context: Library.Context<AB>) => context.a);
    const library = Library.create<AB>({
        a: { type: C, value: "#111111" },
        b: { type: C, value: alias },
    });

    library.tokens.b.value;
    library.tokens.b.value;
    library.tokens.b.value;

    Assert.is(alias.callCount, 1);
});

Alias(
    "an alias is re-invoked exactly once after its dependency changes",
    () => {
        const alias = spy((context: Library.Context<AB>) => context.a);
        const library = Library.create<AB>({
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
    "re-aliasing tracks the new dependency and drops the old one",
    async () => {
        const library = Library.create<ABC>({
            a: { type: C, value: "#111111" },
            b: { type: C, value: "#222222" },
            c: { type: C, value: (context) => context.a },
        });
        library.tokens.c.value;
        library.tokens.c.set((context) => context.b);
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
    "a conditional alias re-tracks dependencies when its branch flips",
    async () => {
        interface Theme extends ABC {
            flag: DesignToken.Number;
        }
        const library = Library.create<Theme>({
            flag: { type: DesignToken.Type.Number, value: 0 },
            a: { type: C, value: "#111111" },
            b: { type: C, value: "#222222" },
            c: {
                type: C,
                value: (context) =>
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
    "setting a static value stops tracking the previous alias dependency",
    async () => {
        const library = aliasedPair();
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

interface Diamond extends ABC {
    d: DesignToken.Gradient;
}

Alias("a diamond dependency updates once with the correct value", async () => {
    const first = spy((context: Library.Context<Diamond>) => context.b);
    const second = spy((context: Library.Context<Diamond>) => context.c);
    const stops = [
        { color: first, position: 0 },
        { color: second, position: 1 },
    ];
    const library = Library.create<Diamond>({
        a: { type: C, value: "#111111" },
        b: { type: C, value: (context) => context.a },
        c: { type: C, value: (context) => context.a },
        d: {
            type: DesignToken.Type.Gradient,
            // @ts-expect-error type gap: DeepAlias doesn't support aliases in gradient stops (#28)
            value: stops,
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
});

interface BorderTheme {
    a: DesignToken.Border;
}

const borderWithDashes = (): DesignToken.Border => ({
    type: DesignToken.Type.Border,
    value: {
        color: "#111111",
        width: "1px",
        style: { dashArray: ["1px", "2px"], lineCap: "round" },
    },
});

Alias.skip("object values are deeply frozen (fails: #24)", () => {
    const library = Library.create<BorderTheme>({ a: borderWithDashes() });
    const value = library.tokens.a.value;

    Assert.ok(Object.isFrozen(value), "value");
    Assert.ok(Object.isFrozen(dashedStyle(value)), "nested object");
    Assert.ok(Object.isFrozen(dashedStyle(value).dashArray), "nested array");
});

Alias.skip(
    "mutating a value throws and leaves the token unchanged (fails: #24)",
    () => {
        const library = Library.create<BorderTheme>({ a: borderWithDashes() });
        // Typed as mutable so this compiles before and after #24.
        const value: { width: string } = library.tokens.a.value;

        Assert.throws(() => (value.width = "9px"), "top level");
        Assert.throws(
            () =>
                Array.prototype.push.call(
                    dashedStyle(library.tokens.a.value).dashArray,
                    "3px",
                ),
            "nested array",
        );
        Assert.equal(library.tokens.a.value, borderWithDashes().value);
    },
);

Alias.skip("array values and their items are frozen (fails: #24)", () => {
    interface Theme {
        fonts: DesignToken.FontFamily;
        gradient: DesignToken.Gradient;
    }
    const library = Library.create<Theme>({
        fonts: {
            type: DesignToken.Type.FontFamily,
            value: ["Comic Sans", "serif"],
        },
        gradient: {
            type: DesignToken.Type.Gradient,
            value: [{ color: "#111111", position: 0 }],
        },
    });

    Assert.ok(Object.isFrozen(library.tokens.fonts.value), "font family");
    Assert.ok(Object.isFrozen(library.tokens.gradient.value), "gradient");
    Assert.ok(Object.isFrozen(library.tokens.gradient.value[0]), "stop");
});

Alias.skip(
    "values resolved from deep aliases are deeply frozen (fails: #24)",
    () => {
        interface Theme {
            a: DesignToken.Color;
            border: DesignToken.Border;
        }
        const library = Library.create<Theme>({
            a: { type: C, value: "#111111" },
            border: {
                type: DesignToken.Type.Border,
                value: {
                    color: (context) => context.a,
                    width: "1px",
                    style: { dashArray: ["1px"], lineCap: "round" },
                },
            },
        });
        const value = library.tokens.border.value;

        Assert.ok(Object.isFrozen(value), "value");
        Assert.ok(
            Object.isFrozen(dashedStyle(value).dashArray),
            "nested array",
        );
    },
);

Alias("the config object passed to create is not frozen", () => {
    const border = borderWithDashes();
    const library = Library.create<BorderTheme>({ a: border });
    library.tokens.a.value;

    Assert.not.ok(Object.isFrozen(border.value));
    Assert.not.ok(Object.isFrozen(dashedStyle(border.value)));
});

Alias.skip(
    "extensions are copied from the config, not referenced (fails: #25)",
    () => {
        const extensions = { k: 1 };
        const library = Library.create<A>({
            a: { type: C, value: "#111111", extensions },
        });

        extensions.k = 2;

        Assert.is.not(library.tokens.a.extensions, extensions);
        Assert.equal(library.tokens.a.extensions, { k: 1 });
    },
);

Alias.skip("nested extension objects are copied too (fails: #25)", () => {
    const extensions = { nested: { k: 1 } };
    const library = Library.create<A>({
        a: { type: C, value: "#111111", extensions },
    });

    extensions.nested.k = 2;

    Assert.equal(library.tokens.a.extensions, { nested: { k: 1 } });
});

Alias("the alias context is the root token library for nested tokens", () => {
    interface Theme {
        a: DesignToken.Color;
        g: { type: DesignToken.Type.Color; t: DesignToken.Color };
    }
    const alias = spy((context: Library.Context<Theme>) => context.a);
    const library = Library.create<Theme>({
        a: { type: C, value: "#111111" },
        g: { type: C, t: { value: alias } },
    });

    library.tokens.g.t.value;

    Assert.is(alias.firstCall.args[0], library.tokens);
});

const cyclicPair = () =>
    Library.create<AB>({
        a: { type: C, value: (context) => context.b },
        b: { type: C, value: (context) => context.a },
    });

Circular.skip(
    "a direct cycle throws CircularReferenceError (fails: #21)",
    () => {
        const library = cyclicPair();

        Assert.throws(() => library.tokens.a.value, isCircularReferenceError);
    },
);

Circular.skip("a self-reference throws (fails: #21)", () => {
    const library = Library.create<A>({
        a: { type: C, value: (context) => context.a },
    });

    Assert.throws(() => library.tokens.a.value, isCircularReferenceError);
});

Circular.skip(
    "the error message lists the reference chain (fails: #21)",
    () => {
        const library = cyclicPair();

        Assert.throws(() => library.tokens.a.value, /a → b → a/);
    },
);

Circular.skip("a cycle through a deep alias throws (fails: #21)", () => {
    interface Theme {
        self: DesignToken.Border;
    }
    const library = Library.create<Theme>({
        self: {
            type: DesignToken.Type.Border,
            value: {
                // @ts-expect-error a Border is not a valid Color alias target
                color: (context) => context.self,
                width: "1px",
                style: "solid",
            },
        },
    });

    Assert.throws(() => library.tokens.self.value, isCircularReferenceError);
});

Circular.skip(
    "a cycle created later via set() throws on the next read (fails: #21)",
    () => {
        const library = aliasedPair();
        library.tokens.b.value;

        library.tokens.a.set((context) => context.b);

        Assert.throws(() => library.tokens.a.value, isCircularReferenceError);
    },
);

Circular.skip(
    "breaking a cycle with set() makes tokens resolve again (fails: #21)",
    () => {
        const library = cyclicPair();
        Assert.throws(() => library.tokens.a.value, isCircularReferenceError);

        library.tokens.a.set("#111111");

        Assert.is(library.tokens.a.value, "#111111");
        Assert.is(library.tokens.b.value, "#111111");
    },
);

Circular("a non-cyclic diamond does not throw", () => {
    const stops = [
        {
            color: (context: Library.Context<Diamond>) => context.b,
            position: 0,
        },
        {
            color: (context: Library.Context<Diamond>) => context.c,
            position: 1,
        },
    ];
    const library = Library.create<Diamond>({
        a: { type: C, value: "#111111" },
        b: { type: C, value: (context) => context.a },
        c: { type: C, value: (context) => context.a },
        d: {
            type: DesignToken.Type.Gradient,
            // @ts-expect-error type gap: DeepAlias doesn't support aliases in gradient stops (#28)
            value: stops,
        },
    });

    Assert.not.throws(() => library.tokens.d.value);
});

Circular.skip(
    "a cycle introduced by an extend override throws in the extended library (fails: #21)",
    () => {
        const extended = aliasedPair().extend({
            a: { value: (context) => context.b },
        });

        Assert.throws(() => extended.tokens.a.value, isCircularReferenceError);
    },
);

Circular(
    "the source library is unaffected by a cycle in an extending library",
    () => {
        const source = aliasedPair();
        const extended = source.extend({
            a: { value: (context) => context.b },
        });

        try {
            extended.tokens.a.value;
        } catch {}

        Assert.is(source.tokens.a.value, "#111111");
        Assert.is(source.tokens.b.value, "#111111");
    },
);

Circular.skip(
    "CircularReferenceError is exported and extends Error (fails: #21)",
    () => {
        const ErrorClass = Reflect.get(Package, "CircularReferenceError");
        const library = Library.create<A>({
            a: { type: C, value: (context) => context.a },
        });

        Assert.type(ErrorClass, "function");
        Assert.throws(
            () => library.tokens.a.value,
            (error: unknown) =>
                error instanceof ErrorClass && error instanceof Error,
        );
    },
);

Alias.run();
Circular.run();
