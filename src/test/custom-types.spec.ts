/**
 * Runtime tests for custom token types.
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
import { hex, px, toHex } from "./values.js";

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
    shadowColor: hex("#111111"),
    offsets: [px(4), px(0)],
};

Create("a static custom value is exposed with its metadata", () => {
    const library = Library.create<{ r: RatioToken }>({
        r: {
            $type: "ratio",
            $value: 1.5,
            $description: "A ratio",
            $extensions: { e: "e" },
        },
    });

    Assert.is(library.tokens.r.$value, 1.5);
    Assert.is(library.tokens.r.$type, "ratio");
    Assert.is(library.tokens.r.name, "r");
    Assert.is(library.tokens.r.$description, "A ratio");
    Assert.equal(library.tokens.r.$extensions, { e: "e" });
});

Create("primitive, array and nested custom values resolve", () => {
    const library = custom();

    Assert.is(library.tokens.flag.$value, true);
    Assert.equal(library.tokens.steps.$value, [1, 1.5, 3]);
    Assert.equal(library.tokens.nested.$value, {
        outer: { inner: { size: px(4), tags: ["a", "b"] } },
    });
});

Create("the example design system resolves custom tokens", () => {
    const library = Library.create(theme);

    Assert.is(library.tokens.elevations.raised.$type, "elevation");
    Assert.is(library.tokens.elevations.raised.$value.level, 1);
    const [layer, ...rest] = [
        library.tokens.elevations.raised.$value.shadow,
    ].flat();
    Assert.is(rest.length, 0);
    Assert.equal(layer.offsetY, px(4));
    Assert.equal(layer.color, hex("#FFFFFF"));
});

Alias("a whole-value alias resolves to the target's value", () => {
    const library = custom();

    Assert.equal(library.tokens.elevation.raised.top.$value, {
        ...lowElevation,
        level: 3,
    });
});

Alias("deep aliases in fields, tuples and nested objects resolve", () => {
    const library = custom();

    Assert.equal(library.tokens.elevation.low.$value, lowElevation);
    Assert.equal(
        library.tokens.nested.$value.outer.inner.size,
        px(4),
        "nested object",
    );
    Assert.equal(library.tokens.steps.$value[1], 1.5, "array element");
});

Alias("aliases to standard tokens resolve", () => {
    const library = custom();

    Assert.equal(
        library.tokens.elevation.low.$value.shadowColor,
        hex("#111111"),
    );
    Assert.is(library.tokens.label.$value, "srgb");
});

Alias("a custom value with a 'value' key is data, not a token", () => {
    interface Wrapped {
        $value: number;
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
        ratio: { $type: "ratio", $value: 2 },
        static: { $type: "wrapped", $value: { $value: 1, unit: "px" } },
        nested: {
            $type: "nestedWrapped",
            $value: { inner: { $value: 1, unit: "px" } },
        },
        fromAlias: {
            $type: "wrapped",
            $value: () => ({ $value: 2, unit: "em" }),
        },
        deep: {
            $type: "wrapped",
            $value: { $value: (context) => context.ratio, unit: "px" },
        },
        toToken: { $type: "wrapped", $value: (context) => context.static },
    });

    Assert.equal(library.tokens.static.$value, { $value: 1, unit: "px" });
    Assert.equal(library.tokens.nested.$value, {
        inner: { $value: 1, unit: "px" },
    });
    Assert.equal(library.tokens.fromAlias.$value, { $value: 2, unit: "em" });
    Assert.equal(library.tokens.deep.$value, { $value: 2, unit: "px" });
    Assert.equal(library.tokens.toToken.$value, { $value: 1, unit: "px" });
});

Groups("a custom token inherits its group's custom type", () => {
    const library = custom();

    Assert.is(library.tokens.elevation.low.$type, "elevation");
});

Groups("the nearest ancestor group's type is inherited", () => {
    const library = custom();

    Assert.is(library.tokens.elevation.raised.top.$type, "elevation");
    Assert.is(library.tokens.elevation.scale.step.$type, "ratio");
});

Groups("a custom group exposes its type, non-enumerably", () => {
    const library = custom();

    Assert.is(library.tokens.elevation.$type, "elevation");
    Assert.not.ok(Object.keys(library.tokens.elevation).includes("$type"));
});

Groups("a custom token without an inherited type throws", () => {
    Assert.throws(
        () =>
            Library.create<{ r: RatioToken }>({
                // @ts-expect-error simulates an untyped config
                r: { $value: 1 },
            }),
        /'r'/,
    );
});

Changes("set() with a static value and an alias", async () => {
    const library = custom();
    const subscriber = recorder();
    library.subscribe(subscriber);

    library.tokens.ratio.set(2);
    Assert.is(library.tokens.ratio.$value, 2);
    await nextUpdate();
    Assert.equal(subscriber.batches, [["ratio"]]);

    library.tokens.ratio.set((context) => context.elevation.scale.step);
    Assert.is(library.tokens.ratio.$value, 1.25);
});

Changes("dependents of a custom token recompute and notify", async () => {
    const library = custom();
    library.tokens.elevation.raised.top.$value;
    const subscriber = recorder();
    library.subscribe(subscriber);

    library.tokens.ratio.set(4);

    Assert.is(library.tokens.elevation.high.$value.level, 8);
    Assert.is(library.tokens.elevation.raised.top.$value.level, 8);
    await nextUpdate();
    Assert.equal(subscriber.batches[0].sort(), [
        "elevation.high",
        "elevation.raised.top",
        "ratio",
    ]);
});

Changes("a custom token deep-aliasing a standard token updates", async () => {
    const library = custom();
    library.tokens.elevation.low.$value;
    const subscriber = recorder();
    library.subscribe(subscriber);

    library.tokens.colors.accent.set(hex("#222222"));

    Assert.equal(
        library.tokens.elevation.low.$value.shadowColor,
        hex("#222222"),
    );
    await nextUpdate();
    Assert.ok(subscriber.batches[0].includes("elevation.low"));
});

Extend("inherited custom tokens track source changes", () => {
    const source = custom();
    const extended = source.extend<{}>({});

    Assert.equal(extended.tokens.elevation.low.$value, lowElevation);
    Assert.is(extended.tokens.elevation.low.$type, "elevation");

    source.tokens.ratio.set(5);
    Assert.is(extended.tokens.ratio.$value, 5);
});

Extend("custom tokens can be overridden", () => {
    const source = custom();
    const extended = source.extend<{}>({
        ratio: { $value: 3 },
        elevation: {
            low: {
                $value: {
                    level: (context) => context.ratio,
                    shadowColor: hex("#000000"),
                    offsets: [px(0), px(0)],
                },
            },
            raised: { top: { $value: (context) => context.elevation.low } },
        },
    });

    Assert.is(extended.tokens.ratio.$value, 3);
    Assert.equal(extended.tokens.elevation.low.$value, {
        level: 3,
        shadowColor: hex("#000000"),
        offsets: [px(0), px(0)],
    });
    Assert.equal(
        extended.tokens.elevation.raised.top.$value,
        extended.tokens.elevation.low.$value,
    );
    Assert.is(source.tokens.ratio.$value, 1.5, "source unchanged");
    Assert.equal(source.tokens.elevation.low.$value, lowElevation);
});

Extend("new custom tokens can be added", () => {
    const extended = custom().extend<{
        elevation: { floating: ElevationToken };
        z: DesignToken.Custom<"z-index", number>;
    }>({
        elevation: {
            floating: {
                $value: {
                    level: 4,
                    shadowColor: (context) => context.colors.muted,
                    offsets: [px(0), px(2)],
                },
            },
        },
        z: { $type: "z-index", $value: 10 },
    });

    Assert.is(extended.tokens.z.$value, 10);
    Assert.is(extended.tokens.z.$type, "z-index");
    Assert.is(extended.tokens.elevation.floating.$type, "elevation");
    Assert.equal(
        extended.tokens.elevation.floating.$value.shadowColor,
        hex("#111111"),
    );
});

Extend("inherited custom aliases resolve against overrides", () => {
    const extended = custom().extend<{}>({ ratio: { $value: 10 } });

    Assert.is(extended.tokens.elevation.high.$value.level, 20);
    Assert.is(extended.tokens.elevation.raised.top.$value.level, 20);
});

interface Flat {
    c: DesignToken.Color;
    e: ElevationToken;
    r: RatioToken;
}
const flat = () =>
    Library.create<Flat>({
        c: { $type: C, $value: hex("#111111") },
        e: {
            $type: "elevation",
            $value: {
                level: (context) => context.r,
                shadowColor: (context) => context.c,
                offsets: [px(0), px(2)],
            },
        },
        r: { $type: "ratio", $value: 2 },
    });
const flatConverters = {
    elevation: (value: {
        level: number;
        shadowColor: DesignToken.Values.Color;
    }) => `${value.level} ${toHex(value.shadowColor)}`,
    ratio: (value: number) => `${value * 100}%`,
};

CSS("custom converters receive resolved values", () => {
    Assert.is(
        toCSS(flat(), { converters: flatConverters }),
        "--c:#111111;--e:2 #111111;--r:200%;",
    );
});

CSS("custom converters receive the token", () => {
    const tokens: string[] = [];
    toCSS(flat(), {
        converters: {
            ...flatConverters,
            elevation: (value, token) => {
                tokens.push(`${token.name}:${token.$type}`);
                return "";
            },
        },
    });

    Assert.equal(tokens, ["e:elevation"]);
});

CSS("a custom token without a converter throws", () => {
    Assert.throws(
        // @ts-expect-error simulates an untyped caller
        () => toCSS(flat()),
        /custom type 'elevation' of token 'e'/,
    );
});

CSS("an extended library uses converters for new custom types", () => {
    const extended = flat().extend<{
        z: DesignToken.Custom<"z-index", number>;
    }>({ z: { $type: "z-index", $value: 3 } });

    Assert.is(
        toCSS(extended, {
            converters: {
                ...flatConverters,
                "z-index": (value) => `${value}`,
            },
        }),
        "--c:#111111;--e:2 #111111;--r:200%;--z:3;",
    );
});

CSS("toProperties includes custom tokens", () => {
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
