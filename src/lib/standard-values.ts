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

type StrokeStyleKeyword = Extract<DesignToken.Values.StrokeStyle, string>;

/**
 * The stroke style keywords.
 *
 * @see {@link https://www.designtokens.org/tr/2025.10/format/#stroke-style}
 *
 * @internal
 */
export const STROKE_STYLES: Readonly<Record<StrokeStyleKeyword, true>> = {
    solid: true,
    dashed: true,
    dotted: true,
    double: true,
    groove: true,
    ridge: true,
    outset: true,
    inset: true,
};

type LineCap = Exclude<DesignToken.Values.StrokeStyle, string>["lineCap"];

/**
 * The line caps of a stroke style with a dash array.
 *
 * @internal
 */
export const LINE_CAPS: Readonly<Record<LineCap, true>> = {
    round: true,
    butt: true,
    square: true,
};

/**
 * The units of a dimension.
 *
 * @internal
 */
export const DIMENSION_UNITS: Readonly<
    Record<DesignToken.Values.Dimension["unit"], true>
> = { px: true, rem: true };

/**
 * The units of a duration.
 *
 * @internal
 */
export const DURATION_UNITS: Readonly<
    Record<DesignToken.Values.Duration["unit"], true>
> = { ms: true, s: true };

/**
 * Tests whether a value is one of the keys of a table.
 *
 * @internal
 */
export const isKeyOf = <K extends string>(
    table: Readonly<Record<K, unknown>>,
    value: unknown,
): value is K => typeof value === "string" && Object.hasOwn(table, value);
