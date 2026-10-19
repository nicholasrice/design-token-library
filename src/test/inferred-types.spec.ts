/**
 * Type-level tests for configs whose shape is inferred, with no type argument
 * to `Library.create` or `extend` (#37). They are enforced by `tsc -b`.
 */
import { suite } from "uvu";
import * as Assert from "uvu/assert";
import { refs } from "../lib/ref.js";
import { DesignToken } from "../lib/design-token.js";
import { Library } from "../lib/library.js";
import { Equal, Expect } from "./helpers.js";
import { hex, ms, px } from "./values.js";

const Inferred = suite("Type-level API: inferred configs");
const T = DesignToken.Type;

// Valid values of every built-in type compile, written inline.
const valid = Library.create({
    border: {
        $type: T.Border,
        $value: {
            color: { colorSpace: "srgb", components: [0, 0, 0] },
            width: { value: 1, unit: "px" },
            style: "solid",
        },
    },
    color: {
        $type: T.Color,
        $value: {
            colorSpace: "oklch",
            components: [0.5, 0.1, "none"],
            alpha: 0.5,
            hex: "#777777",
        },
    },
    cubicBezier: { $type: T.CubicBezier, $value: [0.25, 0.1, 0.25, 1] },
    dimension: { $type: T.Dimension, $value: { value: 1, unit: "rem" } },
    duration: { $type: T.Duration, $value: { value: 200, unit: "ms" } },
    fontFamily: { $type: T.FontFamily, $value: ["Inter", "sans-serif"] },
    fontWeight: { $type: T.FontWeight, $value: "semi-bold" },
    gradient: {
        $type: T.Gradient,
        $value: [
            { color: hex("#000000"), position: 0 },
            { color: hex("#ffffff"), position: 1 },
        ],
    },
    number: { $type: T.Number, $value: 1.5 },
    shadow: {
        $type: T.Shadow,
        $value: {
            color: hex("#000000"),
            offsetX: px(0),
            offsetY: px(1),
            blur: px(2),
            spread: px(0),
        },
    },
    layeredShadow: {
        $type: T.Shadow,
        $value: [
            {
                color: hex("#000000"),
                offsetX: px(0),
                offsetY: px(1),
                blur: px(2),
                spread: px(0),
                inset: true,
            },
        ],
    },
    strokeStyle: {
        $type: T.StrokeStyle,
        $value: { dashArray: [{ value: 2, unit: "px" }], lineCap: "round" },
    },
    transition: {
        $type: T.Transition,
        $value: {
            duration: ms(200),
            delay: { value: 0, unit: "s" },
            timingFunction: [0, 0, 1, 1],
        },
    },
    typography: {
        $type: T.Typography,
        $value: {
            fontFamily: "Inter",
            fontSize: px(16),
            fontWeight: 400,
            letterSpacing: px(0),
            lineHeight: 1.5,
        },
    },
});

type ValueTypes = [
    Expect<
        Equal<
            typeof valid.tokens.border.$value,
            DesignToken.Values.Readonly.Border
        >
    >,
    Expect<
        Equal<
            typeof valid.tokens.cubicBezier.$value,
            DesignToken.Values.Readonly.CubicBezier
        >
    >,
    Expect<
        Equal<
            typeof valid.tokens.gradient.$value,
            DesignToken.Values.Readonly.Gradient
        >
    >,
    Expect<
        Equal<
            typeof valid.tokens.shadow.$value,
            DesignToken.Values.Readonly.Shadow
        >
    >,
    Expect<
        Equal<
            typeof valid.tokens.transition.$value,
            DesignToken.Values.Readonly.Transition
        >
    >,
    Expect<
        Equal<
            typeof valid.tokens.typography.$value,
            DesignToken.Values.Readonly.Typography
        >
    >,
];

// `$` metadata, nested groups and `$root` tokens.
const nested = Library.create({
    g: {
        $type: T.Color,
        $description: "group",
        h: {
            $root: { $type: T.Dimension, $value: px(4) },
            t: {
                $type: T.Dimension,
                $value: { value: 8, unit: "px" },
                $description: "token",
                $extensions: { k: 1 },
                $deprecated: "use g.h",
            },
        },
    },
});
type NestedTypes = [
    Expect<
        Equal<
            typeof nested.tokens.g.h.t.$value,
            DesignToken.Values.Readonly.Dimension
        >
    >,
    Expect<
        Equal<
            typeof nested.tokens.g.h.$root.$value,
            DesignToken.Values.Readonly.Dimension
        >
    >,
];

// A typed config variable, which has no index signature, is accepted.
interface Theme {
    a: DesignToken.Color;
}
const themeConfig: Library.Config<Theme> = {
    a: { $type: T.Color, $value: hex("#111111") },
};
const fromVariable = Library.create(themeConfig);
type VariableTypes = [
    Expect<
        Equal<
            typeof fromVariable.tokens.a.$value,
            DesignToken.Values.Readonly.Color
        >
    >,
];

// Custom types keep the value they declare, with literals kept, and
// aren't checked.
const custom = Library.create({
    elevation: { $type: "elevation", $value: { level: 1, label: "raised" } },
});
type CustomTypes = [
    Expect<
        Equal<
            typeof custom.tokens.elevation.$value,
            DesignToken.DeepReadonly<{ level: number; label: "raised" }>
        >
    >,
];

// set() on an inferred token accepts a valid value and a ref of a library
// with a token of that path and type.
valid.tokens.dimension.set({ value: 2, unit: "px" });
valid.tokens.dimension.set(px(3));
valid.tokens.dimension.set(
    refs<{ dimension: DesignToken.Dimension }>().dimension,
);

// Never called: these configs are only type-checked.
const invalidConfigs = () => {
    Library.create({
        border: {
            $type: T.Border,
            // @ts-expect-error a Border's width is a Dimension
            $value: { color: hex("#000000"), width: 1, style: "solid" },
        },
    });
    Library.create({
        border: {
            $type: T.Border,
            // @ts-expect-error "wavy" is not a stroke style
            $value: {
                color: hex("#000000"),
                width: px(1),
                style: "wavy",
            },
        },
    });
    Library.create({
        color: {
            $type: T.Color,
            // @ts-expect-error a color has three components
            $value: { colorSpace: "srgb", components: [0, 0] },
        },
    });
    Library.create({
        color: {
            $type: T.Color,
            // @ts-expect-error "rgb" is not a color space
            $value: { colorSpace: "rgb", components: [0, 0, 0] },
        },
    });
    Library.create({
        // @ts-expect-error a CubicBezier has four numbers
        cubicBezier: { $type: T.CubicBezier, $value: [0, 0, 1] },
    });
    Library.create({
        // @ts-expect-error a Duration's unit is "ms" or "s"
        duration: { $type: T.Duration, $value: { value: 1, unit: "px" } },
    });
    Library.create({
        // @ts-expect-error "heavier" is not a font weight
        fontWeight: { $type: T.FontWeight, $value: "heavier" },
    });
    Library.create({
        gradient: {
            $type: T.Gradient,
            // @ts-expect-error a gradient stop has a position
            $value: [{ color: hex("#000000") }],
        },
    });
    Library.create({
        // @ts-expect-error a Number token rejects a string
        number: { $type: T.Number, $value: "1" },
    });
    Library.create({
        shadow: {
            $type: T.Shadow,
            // @ts-expect-error a shadow layer has offsets, blur and spread
            $value: [{ color: hex("#000000") }],
        },
    });
    Library.create({
        transition: {
            $type: T.Transition,
            $value: {
                // @ts-expect-error a Transition's duration is a Duration
                duration: px(1),
                delay: ms(0),
                timingFunction: [0, 0, 1, 1],
            },
        },
    });
    Library.create({
        typography: {
            $type: T.Typography,
            // @ts-expect-error a Typography's lineHeight is a number
            $value: {
                fontFamily: "Inter",
                fontSize: px(16),
                fontWeight: 400,
                letterSpacing: px(0),
                lineHeight: "1.5",
            },
        },
    });
    Library.create({
        g: {
            h: {
                // @ts-expect-error a token two groups deep is checked
                t: { $type: T.Dimension, $value: hex("#000000") },
            },
        },
    });
    Library.create({
        g: {
            // @ts-expect-error a $root token is checked
            $root: { $type: T.Dimension, $value: hex("#000000") },
        },
    });
    // An override in an extend config that restates its type is checked.
    Library.create({ a: { $type: T.Color, $value: hex("#111111") } }).extend({
        // @ts-expect-error a Color token rejects a number value
        a: { $type: T.Color, $value: 12 },
    });
    // @ts-expect-error set() checks an inferred token against its type
    valid.tokens.cubicBezier.set([0, 0, 1]);
};

Inferred("inferred type-level assertions compile", () => {
    Assert.ok([valid, nested, fromVariable, custom, invalidConfigs]);
});

Inferred.run();
