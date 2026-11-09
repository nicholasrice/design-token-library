import { suite } from "uvu";
import * as Assert from "uvu/assert";
import { spy } from "sinon";
import { DesignToken } from "../lib/design-token.js";
import { recipes } from "../lib/recipe.js";
import { at, counter } from "./recipes.fixtures.js";
import { nextUpdate, recorder, specTest } from "./helpers.js";
import { create, extend, subscribe } from "./spec-api.js";
import { hex, ms, px, rem, s } from "./values.js";

/**
 * Equality by token type, and an equal value keeping its previous
 * object. Only a subscribed library keeps previous values, so each library is
 * subscribed.
 */
const Equality = suite("equality and stable identity");
const T = DesignToken.Type;

/** A subscribed library with one token `t`. */
const single = (
    $type: string,
    $value: unknown,
    options?: Parameters<typeof create>[1],
) => {
    const library = create({ t: { $type, $value } }, options);
    subscribe(library, recorder());
    return library;
};

/** Reads `token`, sets it to `value`, flushes, and reads it again. */
const reresolve = async (token: any, value: unknown) => {
    const prev = token.$value;
    token.set(value);
    await nextUpdate();
    return { prev, next: token.$value };
};

const red = (hex?: string) => ({
    colorSpace: "srgb",
    components: [1, 0, 0],
    ...(hex === undefined ? {} : { hex }),
});

const layer = (blur: number) => ({
    color: red(),
    offsetX: px(0),
    offsetY: px(1),
    blur: px(blur),
    spread: px(0),
});

const isEqual = () => true;

specTest(
    Equality,
    "A",
    "EQ-01: an equal dimension keeps its object",
    async () => {
        const library = single(T.Dimension, px(4));
        const { prev, next } = await reresolve(library.tokens.t, px(4));
        Assert.is(next, prev);
    },
);

specTest(Equality, "A", "EQ-02: 0px is not equal to 0rem", async () => {
    const library = single(T.Dimension, px(0));
    const { prev, next } = await reresolve(library.tokens.t, rem(0));
    Assert.is.not(next, prev);
    Assert.equal(next, rem(0));
});

specTest(
    Equality,
    "A",
    "EQ-03: an equal duration keeps its object",
    async () => {
        const library = single(T.Duration, ms(100));
        const { prev, next } = await reresolve(library.tokens.t, ms(100));
        Assert.is(next, prev);
    },
);

specTest(Equality, "A", "EQ-04: 1000ms is not equal to 1s", async () => {
    const library = single(T.Duration, ms(1000));
    const { prev, next } = await reresolve(library.tokens.t, s(1));
    Assert.is.not(next, prev);
    Assert.equal(next, s(1));
});

specTest(Equality, "A", "EQ-05: color equality ignores hex", async () => {
    const library = single(T.Color, red("#ff0000"));
    const { prev, next } = await reresolve(library.tokens.t, red("#fe0000"));
    Assert.is(next, prev);
    Assert.is(next.hex, "#ff0000");
});

specTest(
    Equality,
    "A",
    "EQ-06: colors in different spaces are never equal",
    async () => {
        const library = single(T.Color, {
            colorSpace: "srgb",
            components: [0, 0, 0],
        });
        const { prev, next } = await reresolve(library.tokens.t, {
            colorSpace: "display-p3",
            components: [0, 0, 0],
        });
        Assert.is.not(next, prev);
    },
);

specTest(
    Equality,
    "A",
    "EQ-07: color alpha is compared as written",
    async () => {
        const half = single(T.Color, { ...red(), alpha: 0.5 });
        const changed = await reresolve(half.tokens.t, { ...red(), alpha: 1 });
        Assert.is.not(changed.next, changed.prev);

        const absent = single(T.Color, red());
        const explicit = await reresolve(absent.tokens.t, {
            ...red(),
            alpha: 1,
        });
        Assert.is.not(explicit.next, explicit.prev);
    },
);

specTest(
    Equality,
    "A",
    "EQ-08: color components are compared as written",
    async () => {
        const library = single(T.Color, {
            colorSpace: "srgb",
            components: [0, 0, 0],
        });
        const { prev, next } = await reresolve(library.tokens.t, {
            colorSpace: "srgb",
            components: [0, "none", 0],
        });
        Assert.is.not(next, prev);
    },
);

specTest(Equality, "A", "EQ-09: fontFamily is compared in order", async () => {
    const library = single(T.FontFamily, ["A", "B"]);
    const equal = await reresolve(library.tokens.t, ["A", "B"]);
    Assert.is(equal.next, equal.prev);

    const reordered = await reresolve(library.tokens.t, ["B", "A"]);
    Assert.is.not(reordered.next, reordered.prev);
    Assert.equal(reordered.next, ["B", "A"]);
});

specTest(
    Equality,
    "A",
    "EQ-11: cubicBezier compares its four numbers in order",
    async () => {
        const library = single(T.CubicBezier, [0, 0, 1, 1]);
        const equal = await reresolve(library.tokens.t, [0, 0, 1, 1]);
        Assert.is(equal.next, equal.prev);

        const changed = await reresolve(library.tokens.t, [0, 0, 1, 0.9]);
        Assert.is.not(changed.next, changed.prev);
    },
);

specTest(Equality, "A", "EQ-14: border is compared part by part", async () => {
    const border = (color: unknown, width: unknown) => ({
        color,
        width,
        style: "solid",
    });
    const library = single(T.Border, border(red("#ff0000"), px(1)));
    const hexOnly = await reresolve(
        library.tokens.t,
        border(red("#fe0000"), px(1)),
    );
    Assert.is(hexOnly.next, hexOnly.prev, "color ignores hex");

    const width = await reresolve(library.tokens.t, border(red(), rem(1)));
    Assert.is.not(width.next, width.prev, "width compares unit");

    const dashed = (lineCap: string) => ({
        color: red(),
        width: px(1),
        style: { dashArray: [px(1), px(2)], lineCap },
    });
    const styled = single(T.Border, dashed("round"));
    const style = await reresolve(styled.tokens.t, dashed("round"));
    Assert.is(style.next, style.prev, "style object form");
});

specTest(
    Equality,
    "A",
    "EQ-15: gradient stops are compared in order",
    async () => {
        const stop = (position: number) => ({ color: red(), position });
        const library = single(T.Gradient, [stop(0), stop(1)]);
        const equal = await reresolve(library.tokens.t, [stop(0), stop(1)]);
        Assert.is(equal.next, equal.prev);

        const swapped = await reresolve(library.tokens.t, [stop(1), stop(0)]);
        Assert.is.not(swapped.next, swapped.prev);
    },
);

specTest(
    Equality,
    "A",
    "EQ-16: shadow is compared layer by layer, arrays in order",
    async () => {
        const library = single(T.Shadow, layer(1));
        const equal = await reresolve(library.tokens.t, layer(1));
        Assert.is(equal.next, equal.prev, "an equal layer");

        const inset = await reresolve(library.tokens.t, {
            ...layer(1),
            inset: false,
        });
        Assert.is.not(inset.next, inset.prev, "inset is compared as written");

        const layers = single(T.Shadow, [layer(1), layer(2)]);
        const swapped = await reresolve(layers.tokens.t, [layer(2), layer(1)]);
        Assert.is.not(swapped.next, swapped.prev, "layers in order");

        const one = single(T.Shadow, layer(1));
        const wrapped = await reresolve(one.tokens.t, [layer(1)]);
        Assert.is.not(wrapped.next, wrapped.prev, "a layer isn't an array");
    },
);

specTest(
    Equality,
    "A",
    "EQ-17: strokeStyle's object form is compared part by part",
    async () => {
        const style = (dashArray: unknown[]) => ({
            dashArray,
            lineCap: "butt",
        });
        const library = single(T.StrokeStyle, style([px(1), px(2)]));
        const equal = await reresolve(library.tokens.t, style([px(1), px(2)]));
        Assert.is(equal.next, equal.prev);

        const reordered = await reresolve(
            library.tokens.t,
            style([px(2), px(1)]),
        );
        Assert.is.not(reordered.next, reordered.prev);
    },
);

specTest(
    Equality,
    "A",
    "EQ-18: transition is compared part by part",
    async () => {
        const transition = (delay: unknown) => ({
            duration: ms(200),
            delay,
            timingFunction: [0, 0, 1, 1],
        });
        const library = single(T.Transition, transition(ms(1000)));
        const equal = await reresolve(library.tokens.t, transition(ms(1000)));
        Assert.is(equal.next, equal.prev);

        const changed = await reresolve(library.tokens.t, transition(s(1)));
        Assert.is.not(changed.next, changed.prev);
    },
);

specTest(
    Equality,
    "A",
    "EQ-19: typography is compared part by part",
    async () => {
        const typography = (fontFamily: string[], fontSize: unknown) => ({
            fontFamily,
            fontSize,
            fontWeight: 400,
            letterSpacing: px(0),
            lineHeight: 1.5,
        });
        const library = single(T.Typography, typography(["A", "B"], px(16)));
        const equal = await reresolve(
            library.tokens.t,
            typography(["A", "B"], px(16)),
        );
        Assert.is(equal.next, equal.prev);

        const family = await reresolve(
            library.tokens.t,
            typography(["B", "A"], px(16)),
        );
        Assert.is.not(family.next, family.prev, "fontFamily in order");

        const size = await reresolve(
            library.tokens.t,
            typography(["B", "A"], rem(1)),
        );
        Assert.is.not(size.next, size.prev, "fontSize compares unit");
    },
);

specTest(
    Equality,
    "A",
    "EQ-20: a token's type is taken from its group",
    async () => {
        const library = create({
            g: { $type: T.Color, t: { $value: red("#ff0000") } },
        });
        subscribe(library, recorder());
        const { prev, next } = await reresolve(
            library.tokens.g.t,
            red("#fe0000"),
        );
        Assert.is(next, prev);
    },
);

specTest(
    Equality,
    "A",
    "EQ-22: a custom type's equality is registered on create()",
    async () => {
        const palette = { isEqual: spy(() => true) };
        const library = single("palette", { base: 1 }, { types: { palette } });
        const { prev, next } = await reresolve(library.tokens.t, { base: 2 });

        Assert.is(next, prev);
        Assert.ok(palette.isEqual.calledOnce);
        const args = palette.isEqual.firstCall.args as unknown[];
        Assert.ok(args.includes(prev), "called with the previous value");
        Assert.ok(
            args.some((arg) => arg !== prev && (arg as any)?.base === 2),
            "called with the new value",
        );
    },
);

specTest(
    Equality,
    "A",
    "EQ-23: a registered isEqual decides alone",
    async () => {
        const library = single(
            "palette",
            { base: 1 },
            { types: { palette: { isEqual: () => false } } },
        );
        const { prev, next } = await reresolve(library.tokens.t, { base: 1 });
        Assert.is.not(next, prev);
    },
);

specTest(
    Equality,
    "A",
    "EQ-24: an extension inherits a custom type's equality",
    async () => {
        const palette = { isEqual: spy(() => true) };
        const library = create(
            { t: { $type: "palette", $value: { base: 1 } } },
            { types: { palette } },
        );
        const extension = extend(library, {});
        subscribe(extension, recorder());

        const { prev, next } = await reresolve(extension.tokens.t, {
            base: 2,
        });

        Assert.is(next, prev);
        Assert.ok(palette.isEqual.called);
    },
);

specTest(
    Equality,
    "A",
    "EQ-25: an extension adds a custom type of its own",
    async () => {
        const library = create({ a: { $type: T.Number, $value: 1 } });
        const extension = extend(
            library,
            { swatch: { $type: "swatch", $value: { n: 1 } } },
            { types: { swatch: { isEqual } } },
        );
        subscribe(extension, recorder());

        const { prev, next } = await reresolve(extension.tokens.swatch, {
            n: 2,
        });
        Assert.is(next, prev);
    },
);

specTest(
    Equality,
    "A",
    "EQ-26: sibling extensions register their own types independently",
    async () => {
        const library = create({ a: { $type: T.Number, $value: 1 } });
        const config = { swatch: { $type: "swatch", $value: { n: 1 } } };
        const kept = extend(library, config, {
            types: { swatch: { isEqual } },
        });
        const replaced = extend(library, config, {
            types: { swatch: { isEqual: () => false } },
        });
        subscribe(kept, recorder());
        subscribe(replaced, recorder());

        const first = await reresolve(kept.tokens.swatch, { n: 1 });
        const second = await reresolve(replaced.tokens.swatch, { n: 1 });

        Assert.is(first.next, first.prev);
        Assert.is.not(second.next, second.prev);
    },
);

specTest(
    Equality,
    "A",
    "EQ-27: a custom type must register its equality",
    () => {
        Assert.throws(
            () => create({ t: { $type: "palette", $value: { base: 1 } } }),
            (error: Error) =>
                /palette/.test(error.message) && /\bt\b/.test(error.message),
        );
        Assert.throws(
            () =>
                create({
                    g: { $type: "palette", t: { $value: { base: 1 } } },
                }),
            (error: Error) =>
                /palette/.test(error.message) && /g\.t/.test(error.message),
        );
    },
);

specTest(
    Equality,
    "A",
    "EQ-28: an extension's new token needs its type registered",
    () => {
        const library = create(
            { t: { $type: "palette", $value: { base: 1 } } },
            { types: { palette: { isEqual } } },
        );

        Assert.not.throws(() =>
            extend(library, { q: { $type: "palette", $value: { base: 2 } } }),
        );
        Assert.throws(
            () => extend(library, { s: { $type: "swatch", $value: { n: 1 } } }),
            /swatch/,
        );
    },
);

specTest(
    Equality,
    "A",
    "EQ-29: plain data with a ref keeps its object",
    async () => {
        const library = create({
            a: { $type: T.Color, $value: red("#ff0000") },
            b: {
                $type: T.Border,
                $value: { color: at("a"), width: px(1), style: "solid" },
            },
        });
        subscribe(library, recorder());
        const prev = library.tokens.b.$value;

        library.tokens.a.set(red("#ff0000"));
        await nextUpdate();

        Assert.is(library.tokens.b.$value, prev);
    },
);

specTest(
    Equality,
    "A",
    "EQ-30: a recipe result that is plain data keeps its object",
    async () => {
        const clamp = spy((n: number) => px(Math.min(n, 10)));
        const { clampPx } = recipes({ clampPx: clamp });
        const library = create({
            n: { $type: T.Number, $value: 20 },
            t: { $type: T.Dimension, $value: clampPx(at("n")) },
        });
        subscribe(library, recorder());
        const prev = library.tokens.t.$value;

        library.tokens.n.set(30);
        await nextUpdate();

        Assert.is(library.tokens.t.$value, prev);
        Assert.is(clamp.callCount, 2, "re-resolved");
    },
);

specTest(Equality, "A", "EQ-31: identity is stable downstream", async () => {
    const { id } = counter();
    const library = create({
        a: { $type: T.Color, $value: red() },
        b: { $type: T.Color, $value: at("a") },
        c: { $type: T.Color, $value: id("c", at("b")) },
    });
    subscribe(library, recorder());
    const { a, b, c } = library.tokens;
    const before = [a.$value, b.$value, c.$value];

    a.set(red());
    await nextUpdate();

    Assert.is(a.$value, before[0]);
    Assert.is(b.$value, before[1]);
    Assert.is(c.$value, before[2]);
});

specTest(
    Equality,
    "A",
    "EQ-32: equal values keep the first object over many sets",
    async () => {
        const library = single(T.Dimension, px(4));
        const first = library.tokens.t.$value;

        for (let i = 0; i < 3; i++) {
            library.tokens.t.set(px(4));
            await nextUpdate();
        }

        Assert.is(library.tokens.t.$value, first);
    },
);

specTest(
    Equality,
    "A",
    "EQ-33: an unequal value replaces the previous one, then is kept",
    async () => {
        const library = single(T.Dimension, px(1));
        const changed = await reresolve(library.tokens.t, px(2));
        const equal = await reresolve(library.tokens.t, px(2));

        Assert.is.not(changed.next, changed.prev);
        Assert.is(equal.next, changed.next);
    },
);

specTest(
    Equality,
    "A",
    "EQ-34: nothing is compared on first resolution",
    () => {
        const palette = { isEqual: spy(() => true) };
        const library = single("palette", { base: 1 }, { types: { palette } });
        library.tokens.t.$value;

        Assert.ok(palette.isEqual.notCalled);
    },
);

specTest(Equality, "A", "EQ-35: types can't register a DTCG type", () => {
    const config = { t: { $type: T.Color, $value: red() } };
    const types = { types: { color: { isEqual } } };

    Assert.throws(() => create(config, types), /color/);
    Assert.throws(() => extend(create(config), {}, types), /color/);
});

specTest(
    Equality,
    "A",
    "EQ-36: an inherited custom type can't be redefined",
    () => {
        const library = create(
            { t: { $type: "palette", $value: { base: 1 } } },
            { types: { palette: { isEqual } } },
        );
        const types = { types: { palette: { isEqual } } };

        Assert.throws(() => extend(library, {}, types), /palette/);
        Assert.throws(
            () => extend(extend(library, {}), {}, types),
            /palette/,
            "from a grandchild",
        );

        const swatch = { types: { swatch: { isEqual } } };
        Assert.not.throws(() => {
            extend(library, {}, swatch);
            extend(library, {}, swatch);
        }, "siblings each add their own");
    },
);

specTest(
    Equality,
    "A",
    "EQ-37: a library with no subscriber keeps no previous value",
    () => {
        const library = create({ t: { $type: T.Dimension, $value: px(4) } });
        const prev = library.tokens.t.$value;

        library.tokens.t.set(px(4));
        const next = library.tokens.t.$value;

        Assert.is.not(next, prev);
        Assert.equal(next, prev);
    },
);

Equality.run();
