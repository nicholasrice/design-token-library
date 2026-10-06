import { DesignToken } from "../../lib/design-token.js";
import { Library } from "../../lib/library.js";
import { Recipe, RecipeRegistry } from "../../lib/recipe.js";

/**
 * A palette is an ordered list of colors. It is plain data, so it can be cloned,
 * compared, and serialized; behavior lives in exported helpers such as
 * {@link closestIndexOf} rather than on the value.
 */
export type PaletteValue = DesignToken.Values.Color[];

/**
 * A custom token type. It is declared directly rather than through
 * `DesignToken.Properties`, which stays constrained to the DTCG types.
 */
export interface PaletteToken {
    description?: string;
    type?: "palette";
    extensions?: Record<string, any>;
    value: PaletteValue;
}

// Register "palette" as a custom token type. This is the declaration-merging
// extension point on DesignToken.TypeDefinitions; no core edit is needed.
declare module "../../lib/design-token.js" {
    namespace DesignToken {
        interface TypeDefinitions {
            palette: { value: PaletteValue; token: PaletteToken };
        }
    }
}

const channels = (color: string): number[] =>
    [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16));

const toHex = (values: number[]): DesignToken.Values.Color =>
    `#${values
        .map((v) => Math.round(v).toString(16).padStart(2, "0"))
        .join("")
        .toUpperCase()}`;

const mix = (a: string, b: string, t: number): DesignToken.Values.Color => {
    const from = channels(a);
    const to = channels(b);

    return toHex(from.map((v, i) => v + (to[i] - v) * t));
};

/**
 * The index of the palette color nearest to `color` (by RGB distance).
 */
export function closestIndexOf(palette: PaletteValue, color: string): number {
    const target = channels(color);
    let closest = 0;
    let closestDistance = Infinity;

    palette.forEach((candidate, index) => {
        const distance = channels(candidate).reduce(
            (sum, v, i) => sum + (v - target[i]) ** 2,
            0,
        );
        if (distance < closestDistance) {
            closest = index;
            closestDistance = distance;
        }
    });

    return closest;
}

export interface PaletteProps {
    base: DesignToken.Values.Color;
    steps: number;
}

/**
 * A value recipe (no `keys`): produces a single `palette` token. Runs from black
 * up to `base` at the midpoint, then on to white. An odd `steps` therefore puts
 * `base` in the palette exactly.
 */
export const createPalette: Recipe<PaletteProps, PaletteValue> = {
    name: "createPalette",
    type: "palette",
    create({ base, steps }) {
        return Array.from({ length: steps }, (_, i) => {
            const t = steps === 1 ? 0.5 : i / (steps - 1);

            return t < 0.5
                ? mix("#000000", base, t * 2)
                : mix(base, "#FFFFFF", (t - 0.5) * 2);
        });
    },
};

export const stateKeys = ["rest", "hover", "active", "focus"] as const;
export type StateKey = (typeof stateKeys)[number];

export interface StatesProps {
    base: DesignToken.Values.Color;
    palette: PaletteValue;
}

/**
 * A group recipe (has `keys`): consumes a palette value and produces a fixed set
 * of interactive-state colors, using the {@link closestIndexOf} helper.
 */
export const createStates: Recipe<StatesProps, Record<StateKey, string>> = {
    name: "createStates",
    type: DesignToken.Type.Color,
    keys: () => [...stateKeys],
    create({ base, palette }) {
        const rest = closestIndexOf(palette, base);
        const at = (index: number) =>
            palette[Math.min(Math.max(index, 0), palette.length - 1)];

        return {
            rest: at(rest),
            hover: at(rest + 1),
            active: at(rest - 1),
            focus: at(rest + 2),
        };
    },
};

export interface PaletteTheme {
    color: {
        palette: { stepCount: DesignToken.Number };
        neutral: {
            base: DesignToken.Color;
            palette: PaletteToken;
        };
        accent: {
            base: DesignToken.Color;
            palette: PaletteToken;
            dark: DesignToken.Color;
            states: Record<StateKey, DesignToken.Color>;
            focusRing: DesignToken.Color;
        };
    };
}

export const paletteTheme: Library.Config<PaletteTheme> = {
    color: {
        palette: {
            stepCount: { type: DesignToken.Type.Number, value: 5 },
        },
        neutral: {
            base: { type: DesignToken.Type.Color, value: "#787878" },
            palette: {
                $recipe: "createPalette",
                $with: {
                    base: "{color.neutral.base}",
                    steps: "{color.palette.stepCount}",
                },
            },
        },
        accent: {
            base: { type: DesignToken.Type.Color, value: "#09AEF6" },
            palette: {
                $recipe: "createPalette",
                $with: {
                    base: "{color.accent.base}",
                    steps: "{color.palette.stepCount}",
                },
            },
            // A computed token that reads a palette value.
            dark: {
                type: DesignToken.Type.Color,
                value: (theme) => theme.color.accent.palette.value[1],
            },
            // A group recipe that consumes another recipe's palette.
            states: {
                $recipe: "createStates",
                $with: {
                    base: "{color.accent.base}",
                    palette: "{color.accent.palette}",
                },
            },
            // A token aliasing a token generated by a recipe that itself
            // consumed a recipe: stepCount -> palette -> states -> focusRing.
            focusRing: {
                type: DesignToken.Type.Color,
                value: (theme) => theme.color.accent.states.focus,
            },
        },
    },
};

export const createPaletteRegistry = (): RecipeRegistry => {
    const registry = new RecipeRegistry();
    registry.register(createPalette);
    registry.register(createStates);

    return registry;
};
