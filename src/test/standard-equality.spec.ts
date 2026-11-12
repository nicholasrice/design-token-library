import { suite } from "uvu";
import * as Assert from "uvu/assert";
import { DesignToken } from "../lib/design-token.js";
import { standardEquality } from "../lib/equality.js";

const Standard = suite("the equality of each DTCG type");
const T = DesignToken.Type;

const px = (value: number) => ({ value, unit: "px" });
const ms = (value: number) => ({ value, unit: "ms" });
const color = (r = 0, alpha?: number) => ({
    colorSpace: "srgb",
    components: [r, 0, 0],
    ...(alpha === undefined ? {} : { alpha }),
});
const shadow = (overrides: object = {}) => ({
    color: color(),
    offsetX: px(1),
    offsetY: px(2),
    blur: px(3),
    spread: px(4),
    ...overrides,
});
const dashed = (overrides: object = {}) => ({
    dashArray: [px(1), px(2)],
    lineCap: "round",
    ...overrides,
});

// Each row is [type, a, b, whether they are equal]. A value is compared to a
// copy of itself, and to a copy with one member changed, so each member is
// shown to be compared.
const cases: [DesignToken.Type, string, unknown, unknown, boolean][] = [
    [T.Number, "the same number", 1, 1, true],
    [T.Number, "another number", 1, 2, false],
    [T.Number, "NaN and NaN", NaN, NaN, true],
    [T.Number, "0 and -0", 0, -0, false],

    [T.FontWeight, "the same weight", 400, 400, true],
    [T.FontWeight, "another weight", 400, 700, false],
    [T.FontWeight, "a name and a number", "bold", 700, false],

    [T.Dimension, "the same dimension", px(1), px(1), true],
    [T.Dimension, "another value", px(1), px(2), false],
    [T.Dimension, "another unit", px(1), { value: 1, unit: "rem" }, false],
    [T.Duration, "the same duration", ms(1), ms(1), true],
    [T.Duration, "another unit", ms(1), { value: 1, unit: "s" }, false],

    [T.Color, "the same color", color(), color(), true],
    [T.Color, "another component", color(0), color(1), false],
    [
        T.Color,
        "another color space",
        color(),
        { ...color(), colorSpace: "hsl" },
        false,
    ],
    [T.Color, "the same alpha", color(0, 0.5), color(0, 0.5), true],
    [T.Color, "another alpha", color(0, 0.5), color(0, 1), false],
    [T.Color, "an alpha and none", color(0, 1), color(), false],
    [
        T.Color,
        "another hex, which isn't compared",
        { ...color(), hex: "#000000" },
        { ...color(), hex: "#ffffff" },
        true,
    ],
    [
        T.Color,
        "fewer components",
        color(),
        { ...color(), components: [0, 0] },
        false,
    ],

    [T.CubicBezier, "the same curve", [0, 0, 1, 1], [0, 0, 1, 1], true],
    [T.CubicBezier, "another point", [0, 0, 1, 1], [0, 0.5, 1, 1], false],

    [T.FontFamily, "the same name", "Inter", "Inter", true],
    [T.FontFamily, "another name", "Inter", "Arial", false],
    [T.FontFamily, "the same list", ["Inter", "x"], ["Inter", "x"], true],
    [T.FontFamily, "another order", ["Inter", "x"], ["x", "Inter"], false],
    [T.FontFamily, "a name and a list of it", "Inter", ["Inter"], false],

    [T.StrokeStyle, "the same keyword", "solid", "solid", true],
    [T.StrokeStyle, "another keyword", "solid", "dashed", false],
    [T.StrokeStyle, "a keyword and an object", "solid", dashed(), false],
    [T.StrokeStyle, "the same dashes", dashed(), dashed(), true],
    [
        T.StrokeStyle,
        "another dash",
        dashed(),
        dashed({ dashArray: [px(1), px(3)] }),
        false,
    ],
    [
        T.StrokeStyle,
        "another lineCap",
        dashed(),
        dashed({ lineCap: "square" }),
        false,
    ],

    [
        T.Border,
        "the same border",
        { color: color(), width: px(1), style: "solid" },
        { color: color(), width: px(1), style: "solid" },
        true,
    ],
    [
        T.Border,
        "another color",
        { color: color(0), width: px(1), style: "solid" },
        { color: color(1), width: px(1), style: "solid" },
        false,
    ],
    [
        T.Border,
        "another width",
        { color: color(), width: px(1), style: "solid" },
        { color: color(), width: px(2), style: "solid" },
        false,
    ],
    [
        T.Border,
        "another style's lineCap",
        { color: color(), width: px(1), style: dashed() },
        { color: color(), width: px(1), style: dashed({ lineCap: "butt" }) },
        false,
    ],

    [
        T.Gradient,
        "the same stops",
        [{ color: color(), position: 0 }],
        [{ color: color(), position: 0 }],
        true,
    ],
    [
        T.Gradient,
        "another position",
        [{ color: color(), position: 0 }],
        [{ color: color(), position: 1 }],
        false,
    ],
    [
        T.Gradient,
        "another stop color",
        [{ color: color(0), position: 0 }],
        [{ color: color(1), position: 0 }],
        false,
    ],

    [T.Shadow, "the same shadow", shadow(), shadow(), true],
    [T.Shadow, "another color", shadow(), shadow({ color: color(1) }), false],
    [T.Shadow, "another offsetX", shadow(), shadow({ offsetX: px(9) }), false],
    [T.Shadow, "another offsetY", shadow(), shadow({ offsetY: px(9) }), false],
    [T.Shadow, "another blur", shadow(), shadow({ blur: px(9) }), false],
    [T.Shadow, "another spread", shadow(), shadow({ spread: px(9) }), false],
    [T.Shadow, "inset and none", shadow({ inset: false }), shadow(), false],
    [
        T.Shadow,
        "the same inset",
        shadow({ inset: true }),
        shadow({ inset: true }),
        true,
    ],
    [T.Shadow, "the same layers", [shadow()], [shadow()], true],
    [
        T.Shadow,
        "another layer",
        [shadow(), shadow()],
        [shadow(), shadow({ blur: px(9) })],
        false,
    ],
    [T.Shadow, "a shadow and a list of it", shadow(), [shadow()], false],

    [
        T.Transition,
        "the same transition",
        { duration: ms(1), delay: ms(0), timingFunction: [0, 0, 1, 1] },
        { duration: ms(1), delay: ms(0), timingFunction: [0, 0, 1, 1] },
        true,
    ],
    [
        T.Transition,
        "another duration",
        { duration: ms(1), delay: ms(0), timingFunction: [0, 0, 1, 1] },
        { duration: ms(2), delay: ms(0), timingFunction: [0, 0, 1, 1] },
        false,
    ],
    [
        T.Transition,
        "another delay",
        { duration: ms(1), delay: ms(0), timingFunction: [0, 0, 1, 1] },
        { duration: ms(1), delay: ms(5), timingFunction: [0, 0, 1, 1] },
        false,
    ],
    [
        T.Transition,
        "another timingFunction",
        { duration: ms(1), delay: ms(0), timingFunction: [0, 0, 1, 1] },
        { duration: ms(1), delay: ms(0), timingFunction: [0, 1, 1, 1] },
        false,
    ],
];

const typography = (overrides: object = {}) => ({
    fontFamily: "Inter",
    fontSize: px(16),
    fontWeight: 400,
    letterSpacing: px(0),
    lineHeight: 1.5,
    ...overrides,
});

cases.push(
    [T.Typography, "the same typography", typography(), typography(), true],
    ...(
        [
            ["fontFamily", ["Inter", "x"]],
            ["fontSize", px(14)],
            ["fontWeight", 700],
            ["letterSpacing", px(1)],
            ["lineHeight", 2],
        ] as const
    ).map(([member, value]): (typeof cases)[number] => [
        T.Typography,
        `another ${member}`,
        typography(),
        typography({ [member]: value }),
        false,
    ]),
);

for (const [type, description, a, b, expected] of cases) {
    Standard(
        `${type}: ${description} ${expected ? "is" : "isn't"} equal`,
        () => {
            const isEqual = standardEquality[type];
            Assert.is(isEqual(a, b), expected);
            Assert.is(isEqual(b, a), expected, "the other way");
        },
    );
}

Standard("every DTCG type has a case", () => {
    const tested = new Set(cases.map(([type]) => type));
    for (const type of Object.values(T)) {
        Assert.ok(tested.has(type), type);
    }
});

Standard("an object type isn't equal to an array with its members", () => {
    const array = Object.assign([], px(1));

    Assert.not.ok(standardEquality[T.Dimension](px(1), array));
    Assert.not.ok(standardEquality[T.Dimension](array, px(1)));
});

Standard("an object type isn't equal to a value that isn't an object", () => {
    for (const value of [null, undefined, 1, "1px"]) {
        Assert.not.ok(standardEquality[T.Dimension](px(1), value));
        Assert.not.ok(standardEquality[T.Dimension](value, px(1)));
    }
});

Standard.run();
