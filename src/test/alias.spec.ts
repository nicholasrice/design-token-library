import { suite } from "uvu";
import * as Assert from "uvu/assert";
import { spy } from "sinon";
import * as Package from "../lib/index.js";
import { ref, refs } from "../lib/ref.js";
import { DesignToken } from "../lib/design-token.js";
import { Library } from "../lib/library.js";
import { A, AB, ABC, aliasedPair, nextUpdate, recorder } from "./helpers.js";
import { hex, px } from "./values.js";

const Alias = suite("Library refs");
const Circular = suite("Library circular references");
const Values = suite("Library token values");
const C = DesignToken.Type.Color;

type Color = DesignToken.Values.Color;

const a = refs<A>();
const ab = refs<AB>();
const abc = refs<ABC>();

const isCircularReferenceError = (error: unknown) =>
    error instanceof Error && error.name === "CircularReferenceError";

Alias("a ref made by ref() and by refs() resolve the same", () => {
    interface Theme {
        a: DesignToken.Color;
        byPath: DesignToken.Color;
        byRefs: DesignToken.Color;
    }
    const $ = refs<Theme>();
    const library = Library.create<Theme>({
        a: { $type: C, $value: hex("#111111") },
        byPath: { $type: C, $value: ref("a") },
        byRefs: { $type: C, $value: $.a },
    });

    Assert.equal(library.tokens.byPath.$value, hex("#111111"));
    Assert.equal(library.tokens.byRefs.$value, hex("#111111"));
});

Alias("a ref can refer to a token in a different group", () => {
    interface Theme {
        colors: { $type: DesignToken.Type.Color; primary: DesignToken.Color };
        borders: { $type: DesignToken.Type.Border; x: DesignToken.Border };
    }
    const $ = refs<Theme>();
    const library = Library.create<Theme>({
        colors: { $type: C, primary: { $value: hex("#111111") } },
        borders: {
            $type: DesignToken.Type.Border,
            x: {
                $value: {
                    color: $.colors.primary,
                    width: px(1),
                    style: "solid",
                },
            },
        },
    });

    Assert.equal(library.tokens.borders.x.$value.color, hex("#111111"));
});

Alias("deep refs resolve inside array values", () => {
    interface Theme {
        a: DesignToken.Color;
        n: DesignToken.Number;
        gradient: DesignToken.Gradient;
        curve: DesignToken.CubicBezier;
    }
    const $ = refs<Theme>();
    const stops = [
        {
            color: $.a,
            position: 0,
        },
        { color: hex("#222222") as DesignToken.Values.Color, position: 1 },
    ];
    const library = Library.create<Theme>({
        a: { $type: C, $value: hex("#111111") },
        n: { $type: DesignToken.Type.Number, $value: 0.5 },
        gradient: {
            $type: DesignToken.Type.Gradient,
            $value: stops,
        },
        curve: {
            $type: DesignToken.Type.CubicBezier,
            $value: [$.n, 0, 1, 1],
        },
    });

    Assert.equal(library.tokens.gradient.$value, [
        { color: hex("#111111"), position: 0 },
        { color: hex("#222222"), position: 1 },
    ]);
    Assert.equal(library.tokens.curve.$value, [0.5, 0, 1, 1]);
});

interface ArrayTheme {
    n: DesignToken.Number;
    steps: DesignToken.Custom<"steps", number[]>;
    grid: DesignToken.Custom<"grid", number[][]>;
}
const arrayRefs = refs<ArrayTheme>();

const arrayTheme = (steps: ArrayTheme["steps"]["$value"]) =>
    Library.create<ArrayTheme>({
        n: { $type: DesignToken.Type.Number, $value: 1 },
        steps: { $type: "steps", $value: steps },
        grid: {
            $type: "grid",
            $value: [
                [arrayRefs.n, 2],
                [3, arrayRefs.n],
            ],
        },
    });

Alias("an array value resolves to a new array", () => {
    const steps = [1, 2, 3];
    const value = arrayTheme(steps).tokens.steps.$value;

    Assert.ok(Array.isArray(value));
    Assert.is.not(value, steps);
    Assert.equal(value, [1, 2, 3]);
});

Alias("deep refs resolve inside nested arrays", () => {
    Assert.equal(arrayTheme([]).tokens.grid.$value, [
        [1, 2],
        [3, 1],
    ]);
});

Alias("holes in a sparse array value resolve to undefined", () => {
    const value = arrayTheme([1, , 3] as number[]).tokens.steps.$value;

    Assert.is(value.length, 3);
    Assert.ok(1 in value, "the hole becomes an element");
    Assert.is(value[1], undefined);
});

Alias("an array value re-resolves when a token it refers to changes", () => {
    const library = arrayTheme([]);
    library.tokens.grid.$value;

    library.tokens.n.set(2);

    Assert.equal(library.tokens.grid.$value, [
        [2, 2],
        [3, 2],
    ]);
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

Alias("a deep ref can refer to a token that is itself a ref", () => {
    interface Theme {
        d1: DesignToken.Dimension;
        d2: DesignToken.Dimension;
        border: DesignToken.Border;
    }
    const $ = refs<Theme>();
    const library = Library.create<Theme>({
        d1: { $type: DesignToken.Type.Dimension, $value: px(2) },
        d2: {
            $type: DesignToken.Type.Dimension,
            $value: $.d1,
        },
        border: {
            $type: DesignToken.Type.Border,
            $value: {
                color: hex("#111111"),
                width: px(1),
                style: {
                    dashArray: [$.d2, px(4)],
                    lineCap: "round",
                },
            },
        },
    });

    Assert.equal(dashedStyle(library.tokens.border.$value).dashArray, [
        px(2),
        px(4),
    ]);
});

Alias("a deep ref made by ref() and by refs() resolve the same", () => {
    interface Theme {
        a: DesignToken.Color;
        byRefs: DesignToken.Border;
        byPath: DesignToken.Border;
    }
    const $ = refs<Theme>();
    const library = Library.create<Theme>({
        a: { $type: C, $value: hex("#111111") },
        byRefs: {
            $type: DesignToken.Type.Border,
            $value: {
                color: $.a,
                width: px(1),
                style: "solid",
            },
        },
        byPath: {
            $type: DesignToken.Type.Border,
            $value: {
                color: ref("a"),
                width: px(1),
                style: "solid",
            },
        },
    });

    Assert.equal(library.tokens.byRefs.$value.color, hex("#111111"));
    Assert.equal(library.tokens.byPath.$value.color, hex("#111111"));
});

Alias("a value is resolved once across repeated reads", () => {
    const library = aliasedPair();
    const first = library.tokens.b.$value;

    Assert.is(library.tokens.b.$value, first);
});

Alias("a value is resolved again after its dependency changes", () => {
    const library = aliasedPair();
    const first = library.tokens.b.$value;
    library.tokens.a.set(hex("#222222"));
    const second = library.tokens.b.$value;

    Assert.is.not(second, first);
    Assert.is(library.tokens.b.$value, second);
    Assert.equal(second, hex("#222222"));
});

Alias(
    "re-pointing a ref tracks the new dependency and drops the old one",
    async () => {
        const library = Library.create<ABC>({
            a: { $type: C, $value: hex("#111111") },
            b: { $type: C, $value: hex("#222222") },
            c: { $type: C, $value: abc.a },
        });
        library.tokens.c.$value;
        library.tokens.c.set(abc.b);
        library.tokens.c.$value;
        await nextUpdate();

        const subscriber = recorder();
        library.subscribe(subscriber);

        library.tokens.a.set(hex("#333333"));
        await nextUpdate();
        Assert.equal(subscriber.batches, [["a"]], "old dependency ignored");

        library.tokens.b.set(hex("#444444"));
        await nextUpdate();
        Assert.equal(
            subscriber.batches[1],
            ["b", "c"],
            "new dependency tracked",
        );
        Assert.equal(library.tokens.c.$value, hex("#444444"));
    },
);

Alias(
    "a ref keeps tracking a dependency it reads on every recompute",
    async () => {
        const library = aliasedPair();
        const subscriber = recorder();
        library.subscribe(subscriber);

        for (const value of ["#222222", "#333333", "#444444"]) {
            library.tokens.a.set(hex(value));
            Assert.equal(library.tokens.b.$value, hex(value));
        }
        await nextUpdate();

        Assert.equal(subscriber.batches, [["a", "b"]]);
    },
);

Alias(
    "setting a static value stops tracking the previous ref's dependency",
    async () => {
        const library = aliasedPair();
        library.tokens.b.$value;
        library.tokens.b.set(hex("#222222"));
        library.tokens.b.$value;
        await nextUpdate();

        const subscriber = recorder();
        library.subscribe(subscriber);
        library.tokens.a.set(hex("#333333"));
        await nextUpdate();

        Assert.equal(subscriber.batches, [["a"]]);
        Assert.equal(library.tokens.b.$value, hex("#222222"));
    },
);

interface Diamond extends ABC {
    d: DesignToken.Gradient;
}
const diamond = refs<Diamond>();

Alias("a diamond dependency updates once with the correct value", async () => {
    const stops = [
        { color: diamond.b, position: 0 },
        { color: diamond.c, position: 1 },
    ];
    const library = Library.create<Diamond>({
        a: { $type: C, $value: hex("#111111") },
        b: { $type: C, $value: diamond.a },
        c: { $type: C, $value: diamond.a },
        d: {
            $type: DesignToken.Type.Gradient,
            $value: stops,
        },
    });
    library.tokens.d.$value;

    const subscriber = recorder();
    library.subscribe(subscriber);
    library.tokens.a.set(hex("#222222"));
    await nextUpdate();

    const batch = subscriber.batches[0];
    Assert.is(batch.filter((name) => name === "d").length, 1);
    Assert.equal([...batch].sort(), ["a", "b", "c", "d"]);
    Assert.equal(library.tokens.d.$value, [
        { color: hex("#222222"), position: 0 },
        { color: hex("#222222"), position: 1 },
    ]);
});

interface BorderTheme {
    a: DesignToken.Border;
}

const borderWithDashes = (): DesignToken.Border => ({
    $type: DesignToken.Type.Border,
    $value: {
        color: hex("#111111"),
        width: px(1),
        style: { dashArray: [px(1), px(2)], lineCap: "round" },
    },
});

Alias.skip("object values are deeply frozen (fails: #24)", () => {
    const library = Library.create<BorderTheme>({ a: borderWithDashes() });
    const value = library.tokens.a.$value;

    Assert.ok(Object.isFrozen(value), "value");
    Assert.ok(Object.isFrozen(dashedStyle(value)), "nested object");
    Assert.ok(Object.isFrozen(dashedStyle(value).dashArray), "nested array");
});

Alias.skip(
    "mutating a value throws and leaves the token unchanged (fails: #24)",
    () => {
        const library = Library.create<BorderTheme>({ a: borderWithDashes() });
        // Typed as mutable so this compiles before and after #24.
        const value: { width: DesignToken.Values.Dimension } =
            library.tokens.a.$value;

        Assert.throws(() => (value.width = px(9)), "top level");
        Assert.throws(
            () =>
                Array.prototype.push.call(
                    dashedStyle(library.tokens.a.$value).dashArray,
                    px(3),
                ),
            "nested array",
        );
        Assert.equal(library.tokens.a.$value, borderWithDashes().$value);
    },
);

Alias.skip("array values and their items are frozen (fails: #24)", () => {
    interface Theme {
        fonts: DesignToken.FontFamily;
        gradient: DesignToken.Gradient;
    }
    const library = Library.create<Theme>({
        fonts: {
            $type: DesignToken.Type.FontFamily,
            $value: ["Comic Sans", "serif"],
        },
        gradient: {
            $type: DesignToken.Type.Gradient,
            $value: [{ color: hex("#111111"), position: 0 }],
        },
    });

    Assert.ok(Object.isFrozen(library.tokens.fonts.$value), "font family");
    Assert.ok(Object.isFrozen(library.tokens.gradient.$value), "gradient");
    Assert.ok(Object.isFrozen(library.tokens.gradient.$value[0]), "stop");
});

Alias.skip(
    "values resolved from deep refs are deeply frozen (fails: #24)",
    () => {
        interface Theme {
            a: DesignToken.Color;
            border: DesignToken.Border;
        }
        const $ = refs<Theme>();
        const library = Library.create<Theme>({
            a: { $type: C, $value: hex("#111111") },
            border: {
                $type: DesignToken.Type.Border,
                $value: {
                    color: $.a,
                    width: px(1),
                    style: { dashArray: [px(1)], lineCap: "round" },
                },
            },
        });
        const value = library.tokens.border.$value;

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
    library.tokens.a.$value;

    Assert.not.ok(Object.isFrozen(border.$value));
    Assert.not.ok(Object.isFrozen(dashedStyle(border.$value)));
});

Alias("extensions are copied from the config, not referenced", () => {
    const extensions = { k: 1 };
    const library = Library.create<A>({
        a: { $type: C, $value: hex("#111111"), $extensions: extensions },
    });

    extensions.k = 2;

    Assert.is.not(library.tokens.a.$extensions, extensions);
    Assert.equal(library.tokens.a.$extensions, { k: 1 });
});

Alias("nested extension values are shared with the config, not copied", () => {
    const extensions = { nested: { k: 1 } };
    const library = Library.create<A>({
        a: { $type: C, $value: hex("#111111"), $extensions: extensions },
    });

    Assert.is(library.tokens.a.$extensions.nested, extensions.nested);
});

Alias("a ref in a nested group refers from the root of the library", () => {
    interface Theme {
        a: DesignToken.Color;
        g: {
            $type: DesignToken.Type.Color;
            a: DesignToken.Color;
            t: DesignToken.Color;
        };
    }
    const $ = refs<Theme>();
    const library = Library.create<Theme>({
        a: { $type: C, $value: hex("#111111") },
        g: { $type: C, a: { $value: hex("#222222") }, t: { $value: $.a } },
    });

    Assert.equal(library.tokens.g.t.$value, hex("#111111"));
});

Alias("a throwing ref does not track tokens read after it fails", async () => {
    // A ref to a token the library doesn't have
    const missing = refs<{ missing: DesignToken.Color }>().missing;
    const library = Library.create<AB>({
        // @ts-expect-error the library has no `missing`
        a: { $type: C, $value: missing },
        b: { $type: C, $value: hex("#111111") },
    });
    Assert.throws(() => library.tokens.a.$value, /no token "missing"/);

    library.tokens.b.$value;
    const subscriber = recorder();
    library.subscribe(subscriber);
    library.tokens.b.set(hex("#222222"));
    await nextUpdate();

    Assert.equal(subscriber.batches, [["b"]], "only b changed");
});

const cyclicPair = () =>
    Library.create<AB>({
        a: { $type: C, $value: ab.b },
        b: { $type: C, $value: ab.a },
    });

Circular("a direct cycle throws CircularReferenceError", () => {
    const library = cyclicPair();

    Assert.throws(() => library.tokens.a.$value, isCircularReferenceError);
});

Circular("a self-reference throws", () => {
    const library = Library.create<A>({
        a: { $type: C, $value: a.a },
    });

    Assert.throws(() => library.tokens.a.$value, isCircularReferenceError);
});

Circular("the error message lists the reference chain", () => {
    const library = cyclicPair();

    Assert.throws(() => library.tokens.a.$value, /a → b → a/);
});

Circular("a cycle through a deep ref throws", () => {
    interface Theme {
        self: DesignToken.Border;
    }
    const $ = refs<Theme>();
    const library = Library.create<Theme>({
        self: {
            $type: DesignToken.Type.Border,
            $value: {
                // @ts-expect-error a Border is not a Color
                color: $.self,
                width: px(1),
                style: "solid",
            },
        },
    });

    Assert.throws(() => library.tokens.self.$value, isCircularReferenceError);
});

Circular("a cycle created later via set() throws on the next read", () => {
    const library = aliasedPair();
    library.tokens.b.$value;

    library.tokens.a.set(ab.b);

    Assert.throws(() => library.tokens.a.$value, isCircularReferenceError);
});

Circular("breaking a cycle with set() makes tokens resolve again", () => {
    const library = cyclicPair();
    Assert.throws(() => library.tokens.a.$value, isCircularReferenceError);

    library.tokens.a.set(hex("#111111"));

    Assert.equal(library.tokens.a.$value, hex("#111111"));
    Assert.equal(library.tokens.b.$value, hex("#111111"));
});

Circular(
    "toString() on a token in a cycle throws CircularReferenceError",
    () => {
        const library = cyclicPair();

        Assert.throws(() => String(library.tokens.a), isCircularReferenceError);
    },
);

Circular("a non-cyclic diamond does not throw", () => {
    const stops = [
        { color: diamond.b, position: 0 },
        { color: diamond.c, position: 1 },
    ];
    const library = Library.create<Diamond>({
        a: { $type: C, $value: hex("#111111") },
        b: { $type: C, $value: diamond.a },
        c: { $type: C, $value: diamond.a },
        d: {
            $type: DesignToken.Type.Gradient,
            $value: stops,
        },
    });

    Assert.not.throws(() => library.tokens.d.$value);
});

Circular(
    "a cycle introduced by an extend override throws in the extended library",
    () => {
        const extended = aliasedPair().extend({
            a: { $value: ab.b },
        });

        Assert.throws(() => extended.tokens.a.$value, isCircularReferenceError);
    },
);

Circular(
    "the source library is unaffected by a cycle in an extending library",
    () => {
        const source = aliasedPair();
        const extended = source.extend({
            a: { $value: ab.b },
        });

        try {
            extended.tokens.a.$value;
        } catch {}

        Assert.equal(source.tokens.a.$value, hex("#111111"));
        Assert.equal(source.tokens.b.$value, hex("#111111"));
    },
);

Circular("CircularReferenceError is exported and extends Error", () => {
    const ErrorClass = Reflect.get(Package, "CircularReferenceError");
    const library = Library.create<A>({
        a: { $type: C, $value: a.a },
    });

    Assert.type(ErrorClass, "function");
    Assert.throws(
        () => library.tokens.a.$value,
        (error: unknown) =>
            error instanceof ErrorClass && error instanceof Error,
    );
});

Values("a function throws where it's given as a value", () => {
    const config = {
        a: { $type: C, $value: hex("#111111") },
        b: { $type: C, $value: (context: any) => context.a },
    };
    const message = /The value of "b" is a function.*ref\("colors\.primary"\)/;

    Assert.throws(() => Library.create<any>(config), message);

    const library = aliasedPair();
    Assert.throws(
        // @ts-expect-error a function is not a value
        () => library.tokens.b.set(() => hex("#222222")),
        message,
    );
    Assert.throws(
        () =>
            library.extend({
                // @ts-expect-error a function is not a value
                b: { $value: () => hex("#222222") },
            }),
        message,
    );
    Assert.equal(library.tokens.b.$value, hex("#111111"));
});

Values("a ref made by another copy of the package is a ref", () => {
    const foreign = { [Symbol.for("design-token-library.ref")]: ["a"] };
    const library = Library.create<any>({
        a: { $type: C, $value: hex("#111111") },
        b: { $type: C, $value: foreign },
    });

    Assert.equal(library.tokens.b.$value, hex("#111111"));
});

Values("a function in a plain value is a value, and isn't called", () => {
    const format = spy(() => "formatted");
    const library = Library.create<any>({
        a: { $type: "formatted", $value: { format, steps: [format] } },
    });
    const value = library.tokens.a.$value;

    Assert.is(value.format, format);
    Assert.is(value.steps[0], format);
    Assert.is(format.callCount, 0);
});

Alias.run();
Circular.run();
Values.run();
