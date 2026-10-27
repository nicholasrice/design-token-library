import { refs } from "../lib/ref.js";
import { DesignToken } from "../lib/design-token.js";
import { Library } from "../lib/library.js";
import { hex, px } from "./values.js";

/**
 * Custom token types and a library shape shared by the custom type specs.
 */
export interface Elevation {
    level: number;
    shadowColor: DesignToken.Values.Color;
    offsets: [DesignToken.Values.Dimension, DesignToken.Values.Dimension];
}

export interface Nested {
    outer: {
        inner: {
            size: DesignToken.Values.Dimension;
            tags: string[];
        };
    };
}

export type ElevationToken = DesignToken.Custom<"elevation", Elevation>;
export type RatioToken = DesignToken.Custom<"ratio", number>;
export type LabelToken = DesignToken.Custom<"label", string>;
export type FlagToken = DesignToken.Custom<"flag", boolean>;
export type StepsToken = DesignToken.Custom<"steps", number[]>;
export type NestedToken = DesignToken.Custom<"nested", Nested>;

export interface CustomTheme {
    colors: {
        $type: DesignToken.Type.Color;
        accent: DesignToken.Color;
        muted: DesignToken.Color;
    };
    unit: DesignToken.Dimension;
    font: DesignToken.FontFamily;
    elevation: {
        $type: "elevation";
        low: ElevationToken;
        high: ElevationToken;
        raised: { top: ElevationToken };
        scale: { $type: "ratio"; step: RatioToken };
    };
    ratio: RatioToken;
    label: LabelToken;
    flag: FlagToken;
    steps: StepsToken;
    nested: NestedToken;
}

const $ = refs<CustomTheme>();

/**
 * A config exercising static values, refs, deep refs, refs to
 * standard and custom tokens, and group type inheritance.
 */
export const customConfig = (): Library.Config<CustomTheme> => ({
    colors: {
        $type: DesignToken.Type.Color,
        accent: { $value: hex("#111111") },
        muted: { $value: $.colors.accent },
    },
    unit: { $type: DesignToken.Type.Dimension, $value: px(4) },
    font: {
        $type: DesignToken.Type.FontFamily,
        $value: ["Inter", "sans-serif"],
    },
    elevation: {
        $type: "elevation",
        // Inherits "elevation"; deep refs to standard tokens
        low: {
            $value: {
                level: 1,
                shadowColor: $.colors.accent,
                offsets: [$.unit, px(0)],
            },
        },
        // Deep refs to a custom token and to standard tokens
        high: {
            $value: {
                level: $.ratio,
                shadowColor: $.colors.accent,
                offsets: [$.unit, px(0)],
            },
        },
        // Inherits "elevation" through a nested group; a ref to a token
        raised: { top: { $value: $.elevation.high } },
        // A nested group overrides the inherited type
        scale: { $type: "ratio", step: { $value: 1.25 } },
    },
    ratio: { $type: "ratio", $value: 1.5 },
    label: { $type: "label", $value: "Inter, sans-serif" },
    flag: { $type: "flag", $value: true },
    // Array elements referring to another custom type's compatible value
    steps: {
        $type: "steps",
        $value: [1, $.ratio, 3],
    },
    nested: {
        $type: "nested",
        $value: {
            outer: {
                inner: {
                    size: $.unit,
                    tags: ["a", "b"],
                },
            },
        },
    },
});
