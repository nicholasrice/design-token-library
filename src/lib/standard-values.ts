import type { DesignToken } from "./design-token.js";

/*
 * The keywords of the standard value shapes, as tables keyed by the types in
 * `DesignToken.Values`. The types stay the definition: a table that misses a
 * keyword, or has one the type doesn't, doesn't compile.
 */

/**
 * A font weight keyword.
 *
 * @internal
 */
export type FontWeightKeyword = Exclude<DesignToken.Values.FontWeight, number>;

/**
 * The numeric weight of each font weight keyword.
 *
 * @see {@link https://www.designtokens.org/tr/2025.10/format/#font-weight}
 *
 * @internal
 */
export const FONT_WEIGHTS: Readonly<Record<FontWeightKeyword, number>> = {
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
