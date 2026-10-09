import { suite } from "uvu";
import * as Assert from "uvu/assert";
import { toCSS, toProperties } from "../lib/css-reflector.js";
import { DesignToken } from "../lib/design-token.js";
import { Library } from "../lib/library.js";
import { A, AB, aliasedPair } from "./helpers.js";
import { hex, ms, px } from "./values.js";

const toCssSuite = suite("toCss");
const toPropertiesSuite = suite("toProperties");

interface Config<T extends DesignToken.Any> {
    token: T;
}

toCssSuite("should convert Border", () => {
    const config: Config<DesignToken.Border> = {
        token: {
            $type: DesignToken.Type.Border,
            $value: { color: hex("#FFFFFF"), style: "dashed", width: px(2) },
        },
    };
    const library = Library.create(config);
    const result = toCSS(library);

    Assert.is(result, "--token:2px dashed #ffffff;");
});
toCssSuite("should convert Color", () => {
    const config: Config<DesignToken.Color> = {
        token: {
            $type: DesignToken.Type.Color,
            $value: hex("#FF0000"),
        },
    };
    const library = Library.create(config);
    const result = toCSS(library);

    Assert.is(result, "--token:#ff0000;");
});
toCssSuite("should convert CubicBezier", () => {
    const config: Config<DesignToken.CubicBezier> = {
        token: {
            $type: DesignToken.Type.CubicBezier,
            $value: [0, 0.5, 0.9, 0.7],
        },
    };
    const library = Library.create(config);
    const result = toCSS(library);

    Assert.is(result, "--token:cubic-bezier(0, 0.5, 0.9, 0.7);");
});
toCssSuite("should convert Dimension", () => {
    const config: Config<DesignToken.Dimension> = {
        token: {
            $type: DesignToken.Type.Dimension,
            $value: px(2),
        },
    };
    const library = Library.create(config);
    const result = toCSS(library);

    Assert.is(result, "--token:2px;");
});
toCssSuite("should convert Duration", () => {
    const config: Config<DesignToken.Duration> = {
        token: {
            $type: DesignToken.Type.Duration,
            $value: ms(100),
        },
    };
    const library = Library.create(config);
    const result = toCSS(library);

    Assert.is(result, "--token:100ms;");
});
toCssSuite("should convert single FontFamily", () => {
    const config: Config<DesignToken.FontFamily> = {
        token: {
            $type: DesignToken.Type.FontFamily,
            $value: "Comic Sans",
        },
    };
    const library = Library.create(config);
    const result = toCSS(library);

    Assert.is(result, '--token:"Comic Sans";');
});
toCssSuite("should convert multiple FontFamily", () => {
    const config: Config<DesignToken.FontFamily> = {
        token: {
            $type: DesignToken.Type.FontFamily,
            $value: ["Comic Sans", "Courier New", "serif"],
        },
    };
    const library = Library.create(config);
    const result = toCSS(library);

    Assert.is(result, '--token:"Comic Sans","Courier New",serif;');
});
toCssSuite("should fix malformed FontFamily", () => {
    const config: Config<DesignToken.FontFamily> = {
        token: {
            $type: DesignToken.Type.FontFamily,
            // prettier-ignore
            $value: ['"Comic Sans', 'Courier New"', '\'serif', 'system\''],
        },
    };

    const library = Library.create(config);
    const result = toCSS(library);

    Assert.is(result, '--token:"Comic Sans","Courier New",serif,system;');
});
toCssSuite("should convert keyword FontWeight", () => {
    const config: Config<DesignToken.FontWeight> = {
        token: {
            $type: DesignToken.Type.FontWeight,
            $value: "heavy",
        },
    };

    const library = Library.create(config);
    const result = toCSS(library);

    Assert.is(result, "--token:900;");
});
toCssSuite("should convert numerical FontWeight", () => {
    const config: Config<DesignToken.FontWeight> = {
        token: {
            $type: DesignToken.Type.FontWeight,
            $value: 400,
        },
    };

    const library = Library.create(config);
    const result = toCSS(library);

    Assert.is(result, "--token:400;");
});
toCssSuite("should convert Gradient", () => {
    const config: Config<DesignToken.Gradient> = {
        token: {
            $type: DesignToken.Type.Gradient,
            $value: [
                { color: hex("#FFFFFF"), position: 0 },
                { color: hex("#AAAAAA"), position: 0.5 },
                { color: hex("#000000"), position: 1 },
            ],
        },
    };

    const library = Library.create(config);
    const result = toCSS(library);

    Assert.is(result, "--token:#ffffff 0%,#aaaaaa 50%,#000000 100%;");
});
toCssSuite("should convert Number", () => {
    const config: Config<DesignToken.Number> = {
        token: {
            $type: DesignToken.Type.Number,
            $value: 12,
        },
    };

    const library = Library.create(config);
    const result = toCSS(library);

    Assert.is(result, "--token:12;");
});
toCssSuite("should convert Shadow", () => {
    const config: Config<DesignToken.Shadow> = {
        token: {
            $type: DesignToken.Type.Shadow,
            $value: {
                color: hex("#FFFFFF"),
                blur: px(2),
                offsetX: px(0),
                offsetY: px(1),
                spread: px(3),
            },
        },
    };

    const library = Library.create(config);
    const result = toCSS(library);

    Assert.is(result, "--token:0px 1px 2px 3px #ffffff;");
});

// Libraries built from untyped config have no custom types to convert.
const untypedCSS = (library: unknown) => toCSS(library as Library.Library<{}>);

const css = (type: string, value: any) =>
    untypedCSS(
        Library.create({ token: { $type: type, $value: value } } as any),
    );

toCssSuite("should convert colors in each color space", () => {
    const space = (colorSpace: string, components: any[], alpha?: number) =>
        css("color", { colorSpace, components, alpha });

    Assert.is(space("srgb", [1, 0.5, 0]), "--token:#ff8000;");
    Assert.is(space("srgb", [0, 0, 0], 0.5), "--token:#00000080;");
    Assert.is(space("srgb", ["none", 0, 0]), "--token:color(srgb none 0 0);");
    Assert.is(space("hsl", [210, 50, 40]), "--token:hsl(210 50% 40%);");
    Assert.is(
        space("hsl", ["none", 0, 100], 0.5),
        "--token:hsl(none 0% 100% / 0.5);",
    );
    Assert.is(space("hwb", [210, 10, 20]), "--token:hwb(210 10% 20%);");
    Assert.is(space("lab", [50, 40, 60]), "--token:lab(50 40 60);");
    Assert.is(space("lch", [50, 40, 60]), "--token:lch(50 40 60);");
    Assert.is(space("oklab", [0.5, 0.1, 0.1]), "--token:oklab(0.5 0.1 0.1);");
    Assert.is(space("oklch", [0.5, 0.1, 200]), "--token:oklch(0.5 0.1 200);");
    Assert.is(
        space("display-p3", [1, 0, 0]),
        "--token:color(display-p3 1 0 0);",
    );

    for (const name of [
        "srgb-linear",
        "a98-rgb",
        "prophoto-rgb",
        "rec2020",
        "xyz-d65",
        "xyz-d50",
    ]) {
        Assert.is(
            space(name, [0.1, 0.2, 0.3]),
            `--token:color(${name} 0.1 0.2 0.3);`,
        );
    }
});

toCssSuite("should convert rem dimensions and second durations", () => {
    Assert.is(css("dimension", { value: 1.5, unit: "rem" }), "--token:1.5rem;");
    Assert.is(css("duration", { value: 0.2, unit: "s" }), "--token:0.2s;");
});

toCssSuite("should convert every font weight keyword to a number", () => {
    const expected: Record<string, number> = {
        thin: 100,
        hairline: 100,
        "extra-light": 200,
        "ultra-light": 200,
        light: 300,
        normal: 400,
        regular: 400,
        book: 400,
        medium: 500,
        "semi-bold": 600,
        "demi-bold": 600,
        bold: 700,
        "extra-bold": 800,
        "ultra-bold": 800,
        black: 900,
        heavy: 900,
        "extra-black": 950,
        "ultra-black": 950,
    };

    for (const keyword in expected) {
        Assert.is(
            css("fontWeight", keyword),
            `--token:${expected[keyword]};`,
            keyword,
        );
    }
});

toCssSuite("should convert layered and inset shadows", () => {
    const layer = (inset?: boolean) => ({
        color: hex("#000000"),
        offsetX: px(0),
        offsetY: px(1),
        blur: px(2),
        spread: px(0),
        inset,
    });

    Assert.is(
        css("shadow", [layer(), layer(true)]),
        "--token:0px 1px 2px 0px #000000, inset 0px 1px 2px 0px #000000;",
    );
});

toCssSuite("should convert a transition in CSS shorthand order", () => {
    Assert.is(
        css("transition", {
            duration: ms(200),
            delay: ms(50),
            timingFunction: [0.4, 0, 0.2, 1],
        }),
        "--token:200ms cubic-bezier(0.4, 0, 0.2, 1) 50ms;",
    );
});

toCssSuite("should convert a stroke style with a dash array", () => {
    Assert.is(
        css("strokeStyle", { dashArray: [px(2)], lineCap: "round" }),
        "--token:dashed;",
    );
});

toCssSuite("should show a standard value with no converter as JSON", () => {
    const typography = {
        fontFamily: "serif",
        fontSize: px(16),
        fontWeight: 400,
        letterSpacing: px(0),
        lineHeight: 1.5,
    };

    Assert.is(
        css("typography", typography),
        `--token:${JSON.stringify(typography)};`,
    );
});

toCssSuite("should name a $root token for its group", () => {
    const library = Library.create<any>({
        accent: {
            $type: "color",
            $root: { $value: hex("#111111") },
            light: { $value: hex("#222222") },
        },
    });

    Assert.is(untypedCSS(library), "--accent:#111111;--accent-light:#222222;");
    const properties: any = toProperties(library);
    Assert.is(properties.accent.$root.property, "--accent");
    Assert.is(properties.accent.light.property, "--accent-light");
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
            a: { $type: DesignToken.Type.Color, $value: hex("#FFFFFF") },
            b: {
                c: {
                    $type: DesignToken.Type.Border,
                    $value: {
                        color: hex("#FFF"),
                        style: "solid",
                        width: px(2),
                    },
                },
                d: { $type: DesignToken.Type.Dimension, $value: px(4) },
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

interface Grouped {
    g: { $type: DesignToken.Type.Color; a: DesignToken.Color };
}

const grouped = () =>
    Library.create<Grouped>({ g: { $type: C, a: { $value: hex("#111111") } } });

toCssSuite("concatenates multiple flat tokens in order", () => {
    const library = Library.create<AB>({
        a: { $type: C, $value: hex("#111111") },
        b: { $type: C, $value: hex("#222222") },
    });

    Assert.is(toCSS(library), "--a:#111111;--b:#222222;");
});

toCssSuite("emits tokens declared before a nested group", () => {
    interface Theme {
        a: DesignToken.Color;
        g: { $type: DesignToken.Type.Color; b: DesignToken.Color };
    }
    const result = toCSS(
        Library.create<Theme>({
            a: { $type: C, $value: hex("#111111") },
            g: { $type: C, b: { $value: hex("#222222") } },
        }),
    );

    Assert.ok(result.includes("--a:#111111;"), result);
    Assert.ok(result.includes(":#222222;"), result);
});

toCssSuite("emits tokens from sibling groups", () => {
    interface Theme {
        g1: { $type: DesignToken.Type.Color; x: DesignToken.Color };
        g2: { $type: DesignToken.Type.Color; y: DesignToken.Color };
    }
    const result = toCSS(
        Library.create<Theme>({
            g1: { $type: C, x: { $value: hex("#111111") } },
            g2: { $type: C, y: { $value: hex("#222222") } },
        }),
    );

    Assert.ok(result.includes(":#111111;"), result);
    Assert.ok(result.includes(":#222222;"), result);
});

toCssSuite(
    "name option customizes property names in toCSS and toProperties",
    () => {
        const library = grouped();
        const name = (token: { name: string }) => `x_${token.name}`;

        Assert.is(toCSS(library, { name }), "--x_g.a:#111111;");
        Assert.is(toProperties(library, { name }).g.a.property, "--x_g.a");
    },
);

toCssSuite("nested names use '-' separators, matching toProperties", () => {
    const library = grouped();

    Assert.is(toCSS(library), "--g-a:#111111;");
    Assert.is(toProperties(library).g.a.property, "--g-a");
});

toCssSuite.skip(
    "converts Transition with a cubic-bezier() timing function (fails: #12)",
    () => {
        const config: Config<DesignToken.Transition> = {
            token: {
                $type: DesignToken.Type.Transition,
                $value: {
                    duration: ms(100),
                    delay: ms(0),
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

toCssSuite("passes StrokeStyle keywords through", () => {
    const config: Config<DesignToken.StrokeStyle> = {
        token: { $type: DesignToken.Type.StrokeStyle, $value: "dotted" },
    };

    Assert.is(toCSS(Library.create(config)), "--token:dotted;");
});

toCssSuite("converts object StrokeStyle to 'dashed'", () => {
    const config: Config<DesignToken.StrokeStyle> = {
        token: {
            $type: DesignToken.Type.StrokeStyle,
            $value: { dashArray: [px(1), px(2)], lineCap: "round" },
        },
    };

    Assert.is(toCSS(Library.create(config)), "--token:dashed;");
});

toCssSuite.skip("converts Typography to a font shorthand (fails: #11)", () => {
    const config: Config<DesignToken.Typography> = {
        token: {
            $type: DesignToken.Type.Typography,
            $value: {
                fontFamily: "Comic Sans",
                fontSize: px(12),
                fontWeight: 400,
                letterSpacing: px(0),
                lineHeight: 1.2,
            },
        },
    };

    Assert.is(
        toCSS(Library.create(config)),
        '--token:400 12px/1.2 "Comic Sans";',
    );
});

toCssSuite.skip(
    "converts Gradient positions without float error (fails: #13)",
    () => {
        const config: Config<DesignToken.Gradient> = {
            token: {
                $type: DesignToken.Type.Gradient,
                $value: [
                    { color: hex("#111111"), position: 0.07 },
                    { color: hex("#222222"), position: 0.333 },
                ],
            },
        };

        Assert.is(
            toCSS(Library.create(config)),
            "--token:#111111 7%,#222222 33.3%;",
        );
    },
);

toCssSuite("normalizes quoting for single-word FontFamily", () => {
    interface Theme {
        a: DesignToken.FontFamily;
        b: DesignToken.FontFamily;
        c: DesignToken.FontFamily;
    }
    const result = toCSS(
        Library.create<Theme>({
            a: { $type: DesignToken.Type.FontFamily, $value: "'Arial'" },
            b: { $type: DesignToken.Type.FontFamily, $value: "Arial" },
            c: {
                $type: DesignToken.Type.FontFamily,
                $value: '"Times New Roman"',
            },
        }),
    );

    Assert.is(result, '--a:Arial;--b:Arial;--c:"Times New Roman";');
});

toCssSuite("emits resolved values for alias tokens", () => {
    Assert.is(toCSS(aliasedPair()), "--a:#111111;--b:#111111;");
});

toCssSuite("emits resolved values for deep alias tokens", () => {
    interface Theme {
        a: DesignToken.Color;
        b: DesignToken.Border;
    }
    const library = Library.create<Theme>({
        a: { $type: C, $value: hex("#111111") },
        b: {
            $type: DesignToken.Type.Border,
            $value: {
                color: (context) => context.a,
                width: px(1),
                style: "solid",
            },
        },
    });

    Assert.is(toCSS(library), "--a:#111111;--b:1px solid #111111;");
});

toCssSuite("emits overrides for a flat extended library", () => {
    const extended = aliasedPair().extend<{}>({
        a: { $value: hex("#999999") },
    });

    Assert.is(toCSS(extended), "--a:#999999;--b:#999999;");
});

toCssSuite("emits tokens for an extended library with groups", () => {
    const extended = grouped().extend<{}>({
        g: { a: { $value: hex("#999999") } },
    });

    Assert.ok(toCSS(extended).includes(":#999999;"));
});

toCssSuite("an empty library emits an empty string", () => {
    Assert.is(toCSS(Library.create<{}>({})), "");
});

toCssSuite("reflects a value after set()", () => {
    const library = Library.create<A>({
        a: { $type: C, $value: hex("#111111") },
    });

    library.tokens.a.set(hex("#222222"));

    Assert.is(toCSS(library), "--a:#222222;");
});

toPropertiesSuite("supports deep nesting", () => {
    interface Theme {
        a: {
            b: { c: { $type: DesignToken.Type.Color; d: DesignToken.Color } };
        };
    }
    const properties = toProperties(
        Library.create<Theme>({
            a: { b: { c: { $type: C, d: { $value: hex("#111111") } } } },
        }),
    );

    Assert.is(properties.a.b.c.d.property, "--a-b-c-d");
    Assert.is(properties.a.b.c.d.var, "var(--a-b-c-d)");
});

toPropertiesSuite("groups and property values are frozen", () => {
    const properties = toProperties(grouped());

    Assert.ok(Object.isFrozen(properties.g), "group");
    Assert.ok(Object.isFrozen(properties.g.a), "property value");
});

toPropertiesSuite.skip("the root object is frozen (fails: #23)", () => {
    const properties = toProperties(
        Library.create<A>({ a: { $type: C, $value: hex("#111111") } }),
    );

    Assert.ok(Object.isFrozen(properties));
});

toPropertiesSuite("supports a flat extended library with new tokens", () => {
    const extended = Library.create<A>({
        a: { $type: C, $value: hex("#111111") },
    }).extend<{ b: DesignToken.Color }>({
        b: { $type: C, $value: hex("#222222") },
    });
    const properties = toProperties(extended);

    Assert.is(properties.a.property, "--a");
    Assert.is(properties.b.property, "--b");
});

toPropertiesSuite("supports an extended library with groups", () => {
    const properties = toProperties(grouped().extend<{}>({}));

    Assert.is(properties.g.a.property, "--g-a");
});

toPropertiesSuite("keeps tokenless groups as empty groups", () => {
    const properties = toProperties(
        Library.create({
            g: { x: 1 },
            b: { $type: C, $value: hex("#111111") },
        }),
    );

    Assert.equal(Object.keys(properties), ["g", "b"]);
    Assert.equal(Object.keys(properties.g), []);
});

toPropertiesSuite("preserves name casing", () => {
    interface Theme {
        tOkEn: DesignToken.Color;
    }
    const properties = toProperties(
        Library.create<Theme>({ tOkEn: { $type: C, $value: hex("#111111") } }),
    );

    Assert.is(properties.tOkEn.property, "--tOkEn");
});

toPropertiesSuite("does not emit a group's 'type' key", () => {
    const properties = toProperties(grouped());

    Assert.equal(Object.keys(properties.g), ["a"]);
});

toCssSuite.run();
toPropertiesSuite.run();
