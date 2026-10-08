import { suite } from "uvu";
import * as Assert from "uvu/assert";
import { spy } from "sinon";
import { toCSS, toProperties } from "../lib/css-reflector.js";
import { DesignToken } from "../lib/design-token.js";
import { Library } from "../lib/library.js";
import type { FontStyleToken } from "./my-design-system/custom-types.js";
import { hex, ms, px, toHex } from "./values.js";

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
toCssSuite("should convert .ShadowGradient", () => {
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

toCssSuite(
    "should emit tokens from all sibling groups, not just the last",
    () => {
        interface Theme {
            groupA: { one: DesignToken.Color };
            groupB: { two: DesignToken.Color };
        }
        const config: Library.Config<Theme> = {
            groupA: {
                one: { $type: DesignToken.Type.Color, $value: hex("#111111") },
            },
            groupB: {
                two: { $type: DesignToken.Type.Color, $value: hex("#222222") },
            },
        };
        const library = Library.create(config);
        const result = toCSS(library);

        Assert.ok(
            result.includes("--groupA.one:#111111;"),
            `expected groupA token in output, got: ${result}`,
        );
        Assert.ok(
            result.includes("--groupB.two:#222222;"),
            `expected groupB token in output, got: ${result}`,
        );
    },
);

toCssSuite("should omit tokens rejected by the filter", () => {
    interface Theme {
        a: DesignToken.Color;
        b: DesignToken.Color;
    }
    const library = Library.create<Theme>({
        a: { $type: DesignToken.Type.Color, $value: hex("#111111") },
        b: { $type: DesignToken.Type.Color, $value: hex("#222222") },
    });

    Assert.is(
        toCSS(library, { filter: (token) => token.name !== "b" }),
        "--a:#111111;",
    );
});

toCssSuite("should not resolve tokens rejected by the filter", () => {
    const read = spy(() => hex("#000000"));
    const library = Library.create({
        a: { $type: DesignToken.Type.Color, $value: hex("#111111") },
        b: { $type: DesignToken.Type.Color, $value: read },
    } as Library.Config<{ a: DesignToken.Color; b: DesignToken.Color }>);

    toCSS(library, { filter: (token) => token.name === "a" });
    Assert.is(read.callCount, 0);
});

toCssSuite("should serialize a custom type with a provided converter", () => {
    const library = Library.create<{ style: FontStyleToken }>({
        style: { $type: "fontStyle", $value: "regular" },
    });

    Assert.is(toCSS(library), "--style:regular;", "no converter, raw value");
    Assert.is(
        toCSS(library, {
            converters: {
                fontStyle: (value) => (value === "regular" ? "normal" : value),
            },
        }),
        "--style:normal;",
    );
});

toCssSuite("should prefer a provided converter over a built-in one", () => {
    const library = Library.create<Config<DesignToken.Color>>({
        token: { $type: DesignToken.Type.Color, $value: hex("#FF0000") },
    });

    Assert.is(
        toCSS(library, {
            converters: {
                color: (value: DesignToken.Values.Color) =>
                    toHex(value).toUpperCase(),
            },
        }),
        "--token:#FF0000;",
    );
});

toCssSuite("should name custom properties with a provided function", () => {
    interface Theme {
        group: { a: DesignToken.Color };
    }
    const library = Library.create<Theme>({
        group: { a: { $type: DesignToken.Type.Color, $value: hex("#111111") } },
    });

    Assert.is(toCSS(library), "--group.a:#111111;", "default is unchanged");
    Assert.is(
        toCSS(library, { name: (token) => token.name.replaceAll(".", "-") }),
        "--group-a:#111111;",
    );
});

toPropertiesSuite("should omit tokens rejected by the filter", () => {
    interface Theme {
        a: DesignToken.Color;
        b: DesignToken.Color;
    }
    const library = Library.create<Theme>({
        a: { $type: DesignToken.Type.Color, $value: hex("#111111") },
        b: { $type: DesignToken.Type.Color, $value: hex("#222222") },
    });
    const properties = toProperties(library, {
        filter: (token) => token.name !== "b",
    }) as any;

    Assert.is(properties.a.property, "--a");
    Assert.is(properties.b, undefined);
});

toPropertiesSuite("should name properties with a provided function", () => {
    interface Theme {
        group: { a: DesignToken.Color };
    }
    const library = Library.create<Theme>({
        group: { a: { $type: DesignToken.Type.Color, $value: hex("#111111") } },
    });
    const properties = toProperties(library, {
        name: (token) => `brand-${token.name.replaceAll(".", "_")}`,
    });

    Assert.is(properties.group.a.property, "--brand-group_a");
    Assert.is(properties.group.a.var, "var(--brand-group_a)");
});

const css = (type: string, value: any) =>
    toCSS(Library.create({ token: { $type: type, $value: value } } as any));

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

toCssSuite("should show a value with no converter as JSON", () => {
    Assert.is(css("custom", { a: 1 }), '--token:{"a":1};');
    Assert.is(css("custom", ["a", "b"]), "--token:a,b;");
});

toCssSuite("should name a $root token for its group", () => {
    const library = Library.create<any>({
        accent: {
            $type: "color",
            $root: { $value: hex("#111111") },
            light: { $value: hex("#222222") },
        },
    });

    Assert.is(toCSS(library), "--accent:#111111;--accent.light:#222222;");
    const properties: any = toProperties(library);
    Assert.is(properties.accent.$root.property, "--accent");
    Assert.is(properties.accent.light.property, "--accent-light");
});

toCssSuite.run();
toPropertiesSuite.run();
