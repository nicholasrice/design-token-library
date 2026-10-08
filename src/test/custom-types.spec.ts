/**
 * Runtime tests for custom token types. IDs refer to
 * `test-plans/custom-token-types.md`.
 */
import { suite } from "uvu";
import * as Assert from "uvu/assert";
import { toCSS, toProperties } from "../lib/css-reflector.js";
import { DesignToken } from "../lib/design-token.js";
import { Library } from "../lib/library.js";
import {
    CustomTheme,
    ElevationToken,
    RatioToken,
    customConfig,
} from "./custom-types.fixtures.js";
import { nextUpdate, recorder } from "./helpers.js";
import { theme } from "./my-design-system/theme.js";

const Create = suite("Custom types: create");
const Alias = suite("Custom types: aliases");
const Groups = suite("Custom types: group types");
const Changes = suite("Custom types: changes");
const Extend = suite("Custom types: extend");
const CSS = suite("Custom types: CSS");

const C = DesignToken.Type.Color;
const custom = () => Library.create(customConfig());

const lowElevation = {
    level: 1,
    shadowColor: "#111111",
    offsets: ["4px", "0px"],
};

Create("a static custom value is exposed with its metadata (R1.1)", () => {
    const library = Library.create<{ r: RatioToken }>({
        r: {
            type: "ratio",
            value: 1.5,
            description: "A ratio",
            extensions: { e: "e" },
        },
    });

    Assert.is(library.tokens.r.value, 1.5);
    Assert.is(library.tokens.r.type, "ratio");
    Assert.is(library.tokens.r.name, "r");
    Assert.is(library.tokens.r.description, "A ratio");
    Assert.equal(library.tokens.r.extensions, { e: "e" });
});

Create("primitive, array and nested custom values resolve (R1.2)", () => {
    const library = custom();

    Assert.is(library.tokens.flag.value, true);
    Assert.equal(library.tokens.steps.value, [1, 1.5, 3]);
    Assert.equal(library.tokens.nested.value, {
        outer: { inner: { size: "4px", tags: ["a", "b"] } },
    });
});

Create("the example design system resolves custom tokens", () => {
    const library = Library.create(theme);

    Assert.is(library.tokens.elevations.raised.type, "elevation");
    Assert.is(library.tokens.elevations.raised.value.level, 1);
    Assert.is(library.tokens.elevations.raised.value.shadow.offsetY, "4px");
    Assert.is(library.tokens.elevations.raised.value.shadow.color, "#FFFFFF");
});

Alias("a whole-value alias resolves to the target's value (R2.1)", () => {
    const library = custom();

    Assert.equal(library.tokens.elevation.raised.top.value, {
        ...lowElevation,
        level: 3,
    });
});

Alias(
    "deep aliases in fields, tuples and nested objects resolve (R2.2)",
    () => {
        const library = custom();

        Assert.equal(library.tokens.elevation.low.value, lowElevation);
        Assert.equal(
            library.tokens.nested.value.outer.inner.size,
            "4px",
            "nested object",
        );
        Assert.equal(library.tokens.steps.value[1], 1.5, "array element");
    },
);

Alias("aliases to standard tokens resolve (R2.3)", () => {
    const library = custom();

    Assert.is(library.tokens.elevation.low.value.shadowColor, "#111111");
    Assert.is(library.tokens.label.value, "#111111");
});

Alias("a custom value with a 'value' key is data, not a token (R2.4)", () => {
    interface Wrapped {
        value: number;
        unit: string;
    }
    interface Theme {
        ratio: RatioToken;
        static: DesignToken.Custom<"wrapped", Wrapped>;
        nested: DesignToken.Custom<"nestedWrapped", { inner: Wrapped }>;
        fromAlias: DesignToken.Custom<"wrapped", Wrapped>;
        deep: DesignToken.Custom<"wrapped", Wrapped>;
        toToken: DesignToken.Custom<"wrapped", Wrapped>;
    }
    const library = Library.create<Theme>({
        ratio: { type: "ratio", value: 2 },
        static: { type: "wrapped", value: { value: 1, unit: "px" } },
        nested: {
            type: "nestedWrapped",
            value: { inner: { value: 1, unit: "px" } },
        },
        fromAlias: { type: "wrapped", value: () => ({ value: 2, unit: "em" }) },
        deep: {
            type: "wrapped",
            value: { value: (context) => context.ratio, unit: "px" },
        },
        toToken: { type: "wrapped", value: (context) => context.static },
    });

    Assert.equal(library.tokens.static.value, { value: 1, unit: "px" });
    Assert.equal(library.tokens.nested.value, {
        inner: { value: 1, unit: "px" },
    });
    Assert.equal(library.tokens.fromAlias.value, { value: 2, unit: "em" });
    Assert.equal(library.tokens.deep.value, { value: 2, unit: "px" });
    Assert.equal(library.tokens.toToken.value, { value: 1, unit: "px" });
});

Groups("a custom token inherits its group's custom type (R3.1)", () => {
    const library = custom();

    Assert.is(library.tokens.elevation.low.type, "elevation");
});

Groups("the nearest ancestor group's type is inherited (R3.2)", () => {
    const library = custom();

    Assert.is(library.tokens.elevation.raised.top.type, "elevation");
    Assert.is(library.tokens.elevation.scale.step.type, "ratio");
});

Groups("a custom group exposes its type, non-enumerably (R3.3)", () => {
    const library = custom();

    Assert.is(library.tokens.elevation.type, "elevation");
    Assert.not.ok(Object.keys(library.tokens.elevation).includes("type"));
});

Groups("a custom token without an inherited type throws (R3.4)", () => {
    Assert.throws(
        () =>
            Library.create<{ r: RatioToken }>({
                // @ts-expect-error simulates an untyped config
                r: { value: 1 },
            }),
        /'r'/,
    );
});

Changes("set() with a static value and an alias (R4.1)", async () => {
    const library = custom();
    const subscriber = recorder();
    library.subscribe(subscriber);

    library.tokens.ratio.set(2);
    Assert.is(library.tokens.ratio.value, 2);
    await nextUpdate();
    Assert.equal(subscriber.batches, [["ratio"]]);

    library.tokens.ratio.set((context) => context.elevation.scale.step);
    Assert.is(library.tokens.ratio.value, 1.25);
});

Changes(
    "dependents of a custom token recompute and notify (R4.2)",
    async () => {
        const library = custom();
        library.tokens.elevation.raised.top.value;
        const subscriber = recorder();
        library.subscribe(subscriber);

        library.tokens.ratio.set(4);

        Assert.is(library.tokens.elevation.high.value.level, 8);
        Assert.is(library.tokens.elevation.raised.top.value.level, 8);
        await nextUpdate();
        Assert.equal(subscriber.batches[0].sort(), [
            "elevation.high",
            "elevation.raised.top",
            "ratio",
        ]);
    },
);

Changes(
    "a custom token deep-aliasing a standard token updates (R4.3)",
    async () => {
        const library = custom();
        library.tokens.elevation.low.value;
        const subscriber = recorder();
        library.subscribe(subscriber);

        library.tokens.colors.accent.set("#222222");

        Assert.is(library.tokens.elevation.low.value.shadowColor, "#222222");
        await nextUpdate();
        Assert.ok(subscriber.batches[0].includes("elevation.low"));
    },
);

Extend("inherited custom tokens track source changes (R5.1)", () => {
    const source = custom();
    const extended = source.extend<{}>({});

    Assert.equal(extended.tokens.elevation.low.value, lowElevation);
    Assert.is(extended.tokens.elevation.low.type, "elevation");

    source.tokens.ratio.set(5);
    Assert.is(extended.tokens.ratio.value, 5);
});

Extend("custom tokens can be overridden (R5.2)", () => {
    const source = custom();
    const extended = source.extend<{}>({
        ratio: { value: 3 },
        elevation: {
            low: {
                value: {
                    level: (context) => context.ratio,
                    shadowColor: "#000000",
                    offsets: ["0px", "0px"],
                },
            },
            raised: { top: { value: (context) => context.elevation.low } },
        },
    });

    Assert.is(extended.tokens.ratio.value, 3);
    Assert.equal(extended.tokens.elevation.low.value, {
        level: 3,
        shadowColor: "#000000",
        offsets: ["0px", "0px"],
    });
    Assert.equal(
        extended.tokens.elevation.raised.top.value,
        extended.tokens.elevation.low.value,
    );
    Assert.is(source.tokens.ratio.value, 1.5, "source unchanged");
    Assert.equal(source.tokens.elevation.low.value, lowElevation);
});

Extend("new custom tokens can be added (R5.3)", () => {
    const extended = custom().extend<{
        elevation: { floating: ElevationToken };
        z: DesignToken.Custom<"z-index", number>;
    }>({
        elevation: {
            floating: {
                value: {
                    level: 4,
                    shadowColor: (context) => context.colors.muted,
                    offsets: ["0px", "2px"],
                },
            },
        },
        z: { type: "z-index", value: 10 },
    });

    Assert.is(extended.tokens.z.value, 10);
    Assert.is(extended.tokens.z.type, "z-index");
    Assert.is(extended.tokens.elevation.floating.type, "elevation");
    Assert.is(extended.tokens.elevation.floating.value.shadowColor, "#111111");
});

Extend("inherited custom aliases resolve against overrides (R5.4)", () => {
    const extended = custom().extend<{}>({ ratio: { value: 10 } });

    Assert.is(extended.tokens.elevation.high.value.level, 20);
    Assert.is(extended.tokens.elevation.raised.top.value.level, 20);
});

interface Flat {
    c: DesignToken.Color;
    e: ElevationToken;
    r: RatioToken;
}
const flat = () =>
    Library.create<Flat>({
        c: { type: C, value: "#111111" },
        e: {
            type: "elevation",
            value: {
                level: (context) => context.r,
                shadowColor: (context) => context.c,
                offsets: ["0px", "2px"],
            },
        },
        r: { type: "ratio", value: 2 },
    });
const flatConverters = {
    elevation: (value: { level: number; shadowColor: string }) =>
        `${value.level} ${value.shadowColor}`,
    ratio: (value: number) => `${value * 100}%`,
};

CSS("custom converters receive resolved values (R6.1, R6.2)", () => {
    Assert.is(
        toCSS(flat(), flatConverters),
        "--c:#111111;--e:2 #111111;--r:200%;",
    );
});

CSS("a custom token without a converter throws (R6.3)", () => {
    Assert.throws(
        // @ts-expect-error simulates an untyped caller
        () => toCSS(flat()),
        /custom type 'elevation' of token 'e'/,
    );
});

CSS("an extended library uses converters for new custom types (R6.4)", () => {
    const extended = flat().extend<{
        z: DesignToken.Custom<"z-index", number>;
    }>({ z: { type: "z-index", value: 3 } });

    Assert.is(
        toCSS(extended, {
            ...flatConverters,
            "z-index": (value) => `${value}`,
        }),
        "--c:#111111;--e:2 #111111;--r:200%;--z:3;",
    );
});

CSS("toProperties includes custom tokens (R6.5)", () => {
    const properties = toProperties(custom());

    Assert.equal(properties.elevation.raised.top, {
        var: "var(--elevation-raised-top)",
        property: "--elevation-raised-top",
    });
    Assert.equal(properties.ratio.property, "--ratio");
});

Create.run();
Alias.run();
Groups.run();
Changes.run();
Extend.run();
CSS.run();
