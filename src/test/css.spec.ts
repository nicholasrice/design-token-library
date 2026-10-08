import { suite } from "uvu";
import * as Assert from "uvu/assert";
import { toCSS, toProperties } from "../lib/css-reflector.js";
import { DesignToken } from "../lib/design-token.js";
import { Library } from "../lib/library.js";
import { createUntyped } from "./helpers.js";

const toCssSuite = suite("toCss");
const toPropertiesSuite = suite("toProperties");

interface Config<T extends DesignToken.Any> {
    token: T;
}

toCssSuite("should convert Border", () => {
    const config: Config<DesignToken.Border> = {
        token: {
            type: DesignToken.Type.Border,
            value: { color: "#FFFFFF", style: "dashed", width: "2px" },
        },
    };
    const library = Library.create(config);
    const result = toCSS(library);

    Assert.is(result, "--token:2px dashed #FFFFFF;");
});
toCssSuite("should convert Color", () => {
    const config: Config<DesignToken.Color> = {
        token: {
            type: DesignToken.Type.Color,
            value: "#FF0000",
        },
    };
    const library = Library.create(config);
    const result = toCSS(library);

    Assert.is(result, "--token:#FF0000;");
});
toCssSuite("should convert CubicBezier", () => {
    const config: Config<DesignToken.CubicBezier> = {
        token: {
            type: DesignToken.Type.CubicBezier,
            value: [0, 0.5, 0.9, 0.7],
        },
    };
    const library = Library.create(config);
    const result = toCSS(library);

    Assert.is(result, "--token:0 0.5 0.9 0.7;");
});
toCssSuite("should convert Dimension", () => {
    const config: Config<DesignToken.Dimension> = {
        token: {
            type: DesignToken.Type.Dimension,
            value: "2px",
        },
    };
    const library = Library.create(config);
    const result = toCSS(library);

    Assert.is(result, "--token:2px;");
});
toCssSuite("should convert Duration", () => {
    const config: Config<DesignToken.Duration> = {
        token: {
            type: DesignToken.Type.Duration,
            value: "100ms",
        },
    };
    const library = Library.create(config);
    const result = toCSS(library);

    Assert.is(result, "--token:100ms;");
});
toCssSuite("should convert single FontFamily", () => {
    const config: Config<DesignToken.FontFamily> = {
        token: {
            type: DesignToken.Type.FontFamily,
            value: "Comic Sans",
        },
    };
    const library = Library.create(config);
    const result = toCSS(library);

    Assert.is(result, '--token:"Comic Sans";');
});
toCssSuite("should convert multiple FontFamily", () => {
    const config: Config<DesignToken.FontFamily> = {
        token: {
            type: DesignToken.Type.FontFamily,
            value: ["Comic Sans", "Courier New", "serif"],
        },
    };
    const library = Library.create(config);
    const result = toCSS(library);

    Assert.is(result, '--token:"Comic Sans","Courier New",serif;');
});
toCssSuite("should fix malformed FontFamily", () => {
    const config: Config<DesignToken.FontFamily> = {
        token: {
            type: DesignToken.Type.FontFamily,
            // prettier-ignore
            value: ['"Comic Sans', 'Courier New"', '\'serif', 'system\''],
        },
    };

    const library = Library.create(config);
    const result = toCSS(library);

    Assert.is(result, '--token:"Comic Sans","Courier New",serif,system;');
});
toCssSuite("should convert keyword FontWeight", () => {
    const config: Config<DesignToken.FontWeight> = {
        token: {
            type: DesignToken.Type.FontWeight,
            value: "heavy",
        },
    };

    const library = Library.create(config);
    const result = toCSS(library);

    Assert.is(result, "--token:heavy;");
});
toCssSuite("should convert numerical FontWeight", () => {
    const config: Config<DesignToken.FontWeight> = {
        token: {
            type: DesignToken.Type.FontWeight,
            value: 400,
        },
    };

    const library = Library.create(config);
    const result = toCSS(library);

    Assert.is(result, "--token:400;");
});
toCssSuite("should convert Gradient", () => {
    const config: Config<DesignToken.Gradient> = {
        token: {
            type: DesignToken.Type.Gradient,
            value: [
                { color: "#FFFFFF", position: 0 },
                { color: "#AAAAAA", position: 0.5 },
                { color: "#000000", position: 1 },
            ],
        },
    };

    const library = Library.create(config);
    const result = toCSS(library);

    Assert.is(result, "--token:#FFFFFF 0%,#AAAAAA 50%,#000000 100%;");
});
toCssSuite("should convert Number", () => {
    const config: Config<DesignToken.Number> = {
        token: {
            type: DesignToken.Type.Number,
            value: 12,
        },
    };

    const library = Library.create(config);
    const result = toCSS(library);

    Assert.is(result, "--token:12;");
});
toCssSuite("should convert Shadow", () => {
    const config: Config<DesignToken.Shadow> = {
        token: {
            type: DesignToken.Type.Shadow,
            value: {
                color: "#FFFFFF",
                blur: "2px",
                offsetX: "0px",
                offsetY: "1px",
                spread: "3px",
            },
        },
    };

    const library = Library.create(config);
    const result = toCSS(library);

    Assert.is(result, "--token:0px 1px 2px 3px #FFFFFF;");
});

toPropertiesSuite(
    "should convert a library to CSS custom property names and var names",
    () => {
        interface Theme {
            a: DesignToken.Color;
            b: {
                c: DesignToken.Border;
                d: DesignToken.Dimension;
            };
        }
        const config: Library.Config<Theme> = {
            a: { type: DesignToken.Type.Color, value: "#FFFFFF" },
            b: {
                c: {
                    type: DesignToken.Type.Border,
                    value: { color: "#FFF", style: "solid", width: "2px" },
                },
                d: { type: DesignToken.Type.Dimension, value: "4px" },
            },
        };

        const library = Library.create(config);
        const properties = toProperties(library);
        Assert.is(properties.a.property, "--a");
        Assert.is(properties.a.var, "var(--a)");
        Assert.is(properties.b.c.property, "--b-c");
        Assert.is(properties.b.c.var, "var(--b-c)");
        Assert.is(properties.b.d.property, "--b-d");
        Assert.is(properties.b.d.var, "var(--b-d)");
    },
);

const C = DesignToken.Type.Color;

toCssSuite("[T1] concatenates multiple flat tokens in order", () => {
    const library = createUntyped({
        a: { type: C, value: "#111111" },
        b: { type: C, value: "#222222" },
    });

    Assert.is(toCSS(library), "--a:#111111;--b:#222222;");
});

toCssSuite.skip(
    "[T2] emits tokens declared before a nested group (fails: D1)",
    () => {
        const result = toCSS(
            createUntyped({
                a: { type: C, value: "#111111" },
                g: { type: C, b: { value: "#222222" } },
            }),
        );

        Assert.ok(result.includes("--a:#111111;"), result);
        Assert.ok(result.includes(":#222222;"), result);
    },
);

toCssSuite.skip("[T3] emits tokens from sibling groups (fails: D1)", () => {
    const result = toCSS(
        createUntyped({
            g1: { type: C, x: { value: "#111111" } },
            g2: { type: C, y: { value: "#222222" } },
        }),
    );

    Assert.ok(result.includes(":#111111;"), result);
    Assert.ok(result.includes(":#222222;"), result);
});

toCssSuite.skip(
    "[T4] nested names use '-' separators, matching toProperties (fails: D2)",
    () => {
        const library = createUntyped({
            g: { type: C, b: { value: "#222222" } },
        });

        Assert.is(toCSS(library), "--g-b:#222222;");
        const properties: any = toProperties(library);
        Assert.is(properties.g.b.property, "--g-b");
    },
);

toCssSuite.skip(
    "[T5] converts Transition with a cubic-bezier() timing function (fails: D4)",
    () => {
        const config: Config<DesignToken.Transition> = {
            token: {
                type: DesignToken.Type.Transition,
                value: {
                    duration: "100ms",
                    delay: "0ms",
                    timingFunction: [0, 0, 1, 1],
                },
            },
        };

        Assert.is(
            toCSS(Library.create(config)),
            "--token:100ms 0ms cubic-bezier(0, 0, 1, 1);",
        );
    },
);

toCssSuite("[T6] passes StrokeStyle keywords through", () => {
    const config: Config<DesignToken.StrokeStyle> = {
        token: { type: DesignToken.Type.StrokeStyle, value: "dotted" },
    };

    Assert.is(toCSS(Library.create(config)), "--token:dotted;");
});

toCssSuite("[T7] converts object StrokeStyle to 'dashed'", () => {
    const config: Config<DesignToken.StrokeStyle> = {
        token: {
            type: DesignToken.Type.StrokeStyle,
            value: { dashArray: ["1px", "2px"], lineCap: "round" },
        },
    };

    Assert.is(toCSS(Library.create(config)), "--token:dashed;");
});

toCssSuite.skip(
    "[T8][DECIDE: D3 format] converts Typography to a font shorthand (fails: D3)",
    () => {
        const config: Config<DesignToken.Typography> = {
            token: {
                type: DesignToken.Type.Typography,
                value: {
                    fontFamily: "Comic Sans",
                    fontSize: "12px",
                    fontWeight: 400,
                    letterSpacing: "0px",
                    lineHeight: 1.2,
                },
            },
        };

        Assert.is(
            toCSS(Library.create(config)),
            '--token:400 12px/1.2 "Comic Sans";',
        );
    },
);

toCssSuite.skip(
    "[T9] converts Gradient positions without float error (fails: D5)",
    () => {
        const config: Config<DesignToken.Gradient> = {
            token: {
                type: DesignToken.Type.Gradient,
                value: [
                    { color: "#111111", position: 0.07 },
                    { color: "#222222", position: 0.333 },
                ],
            },
        };

        Assert.is(
            toCSS(Library.create(config)),
            "--token:#111111 7%,#222222 33.3%;",
        );
    },
);

toCssSuite("[T10] normalizes quoting for single-word FontFamily", () => {
    const result = toCSS(
        createUntyped({
            a: { type: DesignToken.Type.FontFamily, value: "'Arial'" },
            b: { type: DesignToken.Type.FontFamily, value: "Arial" },
            c: {
                type: DesignToken.Type.FontFamily,
                value: '"Times New Roman"',
            },
        }),
    );

    Assert.is(result, '--a:Arial;--b:Arial;--c:"Times New Roman";');
});

toCssSuite("[T11] emits resolved values for alias tokens", () => {
    const library = createUntyped({
        a: { type: C, value: "#111111" },
        b: { type: C, value: (context: any) => context.a },
    });

    Assert.is(toCSS(library), "--a:#111111;--b:#111111;");
});

toCssSuite("[T12] emits resolved values for deep alias tokens", () => {
    const library = createUntyped({
        a: { type: C, value: "#111111" },
        b: {
            type: DesignToken.Type.Border,
            value: {
                color: (context: any) => context.a,
                width: "1px",
                style: "solid",
            },
        },
    });

    Assert.is(toCSS(library), "--a:#111111;--b:1px solid #111111;");
});

toCssSuite("[T13a] emits overrides for a flat extended library", () => {
    const extended = createUntyped({
        a: { type: C, value: "#111111" },
        b: { type: C, value: (context: any) => context.a },
    }).extend({ a: { value: "#999999" } });

    Assert.is(toCSS(extended), "--a:#999999;--b:#999999;");
});

toCssSuite.skip(
    "[T13b] emits tokens for an extended library with groups (fails: D6)",
    () => {
        const extended = createUntyped({
            g: { type: C, a: { value: "#111111" } },
        }).extend({ g: { a: { value: "#999999" } } });

        Assert.ok(toCSS(extended).includes(":#999999;"));
    },
);

toCssSuite("[T14] an empty library emits an empty string", () => {
    Assert.is(toCSS(createUntyped({})), "");
});

toCssSuite("[T15] reflects a value after set()", () => {
    const library = createUntyped({ a: { type: C, value: "#111111" } });

    library.tokens.a.set("#222222");

    Assert.is(toCSS(library), "--a:#222222;");
});

toPropertiesSuite("[P1] supports deep nesting", () => {
    const properties: any = toProperties(
        createUntyped({
            a: { b: { c: { type: C, d: { value: "#111111" } } } },
        }),
    );

    Assert.is(properties.a.b.c.d.property, "--a-b-c-d");
    Assert.is(properties.a.b.c.d.var, "var(--a-b-c-d)");
});

toPropertiesSuite("[P2] groups and property values are frozen", () => {
    const properties: any = toProperties(
        createUntyped({ g: { type: C, a: { value: "#111111" } } }),
    );

    Assert.ok(Object.isFrozen(properties.g), "group");
    Assert.ok(Object.isFrozen(properties.g.a), "property value");
});

toPropertiesSuite.skip("[P3] the root object is frozen (fails: U3)", () => {
    const properties = toProperties(
        createUntyped({ a: { type: C, value: "#111111" } }),
    );

    Assert.ok(Object.isFrozen(properties));
});

toPropertiesSuite(
    "[P4a] supports a flat extended library with new tokens",
    () => {
        const extended = createUntyped({
            a: { type: C, value: "#111111" },
        }).extend({ b: { type: C, value: "#222222" } });
        const properties: any = toProperties(extended);

        Assert.is(properties.a.property, "--a");
        Assert.is(properties.b.property, "--b");
    },
);

toPropertiesSuite.skip(
    "[P4b] supports an extended library with groups (fails: D6)",
    () => {
        const extended = createUntyped({
            g: { type: C, a: { value: "#111111" } },
        }).extend({});
        const properties: any = toProperties(extended);

        Assert.is(properties.g.a.property, "--g-a");
    },
);

toPropertiesSuite("[P7] keeps tokenless groups as empty groups", () => {
    const properties: any = toProperties(
        createUntyped({ g: { x: 1 }, b: { type: C, value: "#111111" } }),
    );

    Assert.equal(Object.keys(properties), ["g", "b"]);
    Assert.equal(Object.keys(properties.g), []);
});

toPropertiesSuite("[P5] preserves name casing", () => {
    const properties: any = toProperties(
        createUntyped({ tOkEn: { type: C, value: "#111111" } }),
    );

    Assert.is(properties.tOkEn.property, "--tOkEn");
});

toPropertiesSuite("[P6] does not emit a group's 'type' key", () => {
    const properties: any = toProperties(
        createUntyped({ g: { type: C, a: { value: "#111111" } } }),
    );

    Assert.equal(Object.keys(properties.g), ["a"]);
});

toCssSuite.run();
toPropertiesSuite.run();
