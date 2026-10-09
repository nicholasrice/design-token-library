import { DesignToken } from "../lib/design-token.js";
import { Library } from "../lib/library.js";

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

/**
 * A config exercising static values, aliases, deep aliases, aliases to
 * standard and custom tokens, and group type inheritance.
 */
export const customConfig = (): Library.Config<CustomTheme> => ({
    colors: {
        $type: DesignToken.Type.Color,
        accent: { $value: "#111111" },
        muted: { $value: (context) => context.colors.accent },
    },
    unit: { $type: DesignToken.Type.Dimension, $value: "4px" },
    elevation: {
        $type: "elevation",
        // Inherits "elevation"; deep aliases to standard tokens
        low: {
            $value: {
                level: 1,
                shadowColor: (context) => context.colors.accent,
                offsets: [(context) => context.unit, "0px"],
            },
        },
        // Alias resolving to a raw value
        high: {
            $value: (context) => ({
                ...context.elevation.low.$value,
                level: context.ratio.$value * 2,
            }),
        },
        // Inherits "elevation" through a nested group; alias to a token
        raised: { top: { $value: (context) => context.elevation.high } },
        // A nested group overrides the inherited type
        scale: { $type: "ratio", step: { $value: 1.25 } },
    },
    ratio: { $type: "ratio", $value: 1.5 },
    // A custom token aliasing a standard token's compatible value
    label: {
        $type: "label",
        $value: (context) => context.colors.accent.$value,
    },
    flag: { $type: "flag", $value: true },
    // Array elements aliasing another custom type's compatible value
    steps: { $type: "steps", $value: [1, (context) => context.ratio, 3] },
    nested: {
        $type: "nested",
        $value: {
            outer: {
                inner: { size: (context) => context.unit, tags: ["a", "b"] },
            },
        },
    },
});
