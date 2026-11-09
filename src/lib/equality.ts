import { DesignToken } from "./design-token.js";

/**
 * Tells whether two values of a type are equal.
 */
export type Equality = (a: unknown, b: unknown) => boolean;

const T = DesignToken.Type;

const isObject = (value: unknown): value is Record<PropertyKey, unknown> =>
    typeof value === "object" && value !== null;

/**
 * Compares two objects member by member, each with its own equality. An
 * optional member is compared as it is written: one that's missing is equal
 * only to one that's missing.
 */
const members =
    (
        required: Readonly<Record<string, Equality>>,
        optional: Readonly<Record<string, Equality>> = {},
    ): Equality =>
    (a, b) => {
        if (
            !isObject(a) ||
            !isObject(b) ||
            Array.isArray(a) !== Array.isArray(b)
        ) {
            return false;
        }
        for (const key in required) {
            if (!required[key](a[key], b[key])) {
                return false;
            }
        }
        for (const key in optional) {
            const inA = Object.hasOwn(a, key);
            if (inA !== Object.hasOwn(b, key)) {
                return false;
            }
            if (inA && !optional[key](a[key], b[key])) {
                return false;
            }
        }
        return true;
    };

/**
 * Compares two arrays element by element, in order.
 */
const inOrder =
    (element: Equality): Equality =>
    (a, b) =>
        Array.isArray(a) &&
        Array.isArray(b) &&
        a.length === b.length &&
        a.every((value, i) => element(value, b[i]));

const same: Equality = Object.is;

/** Two values of either form, each compared by its own equality. */
const either =
    (isA: (value: unknown) => boolean, a: Equality, b: Equality): Equality =>
    (x, y) =>
        isA(x) ? isA(y) && a(x, y) : !isA(y) && b(x, y);

const measure = members({ value: same, unit: same });

// The hex of a color is a fallback for its components, so it isn't compared.
const color = members(
    { colorSpace: same, components: inOrder(same) },
    { alpha: same },
);

const strokeStyle = either(
    (value) => typeof value === "string",
    same,
    members({ dashArray: inOrder(measure), lineCap: same }),
);

const fontFamily = either(Array.isArray, inOrder(same), same);

const cubicBezier = inOrder(same);

const shadowLayer = members(
    {
        color,
        offsetX: measure,
        offsetY: measure,
        blur: measure,
        spread: measure,
    },
    { inset: same },
);

/**
 * The equality of each DTCG type. Members are compared by their own types,
 * so a dimension is equal to another of the same number and unit, and a
 * color to another of the same color space, components and alpha.
 */
export const standardEquality: Readonly<Record<DesignToken.Type, Equality>> = {
    [T.Border]: members({ color, width: measure, style: strokeStyle }),
    [T.Color]: color,
    [T.CubicBezier]: cubicBezier,
    [T.Dimension]: measure,
    [T.Duration]: measure,
    [T.FontFamily]: fontFamily,
    [T.FontWeight]: same,
    [T.Gradient]: inOrder(members({ color, position: same })),
    [T.Number]: same,
    [T.Shadow]: either(Array.isArray, inOrder(shadowLayer), shadowLayer),
    [T.StrokeStyle]: strokeStyle,
    [T.Transition]: members({
        duration: measure,
        delay: measure,
        timingFunction: cubicBezier,
    }),
    [T.Typography]: members({
        fontFamily,
        fontSize: measure,
        fontWeight: same,
        letterSpacing: measure,
        lineHeight: same,
    }),
};

/**
 * Tells whether a type name is one of DTCG's, which a custom type can't
 * take.
 */
export const isStandardType = (name: string): name is DesignToken.Type =>
    Object.hasOwn(standardEquality, name);
