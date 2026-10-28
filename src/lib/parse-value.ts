import { DesignToken } from "./design-token.js";
import {
    DIMENSION_UNITS,
    DURATION_UNITS,
    FONT_WEIGHTS,
    isKeyOf,
    LINE_CAPS,
    STROKE_STYLES,
} from "./standard-values.js";

/**
 * What reading a value needs from the document it's in.
 *
 * @internal
 */
export interface ValueContext {
    /**
     * Reports a problem with the value at `path`.
     */
    report(path: string, message: string): void;

    /**
     * Reads a value where the format allows a reference to a token of
     * `type`: a reference, or a recipe call. Returns the ref or computed
     * value it stands for, or `undefined` when it's neither.
     */
    reference(value: unknown, type: string, path: string): unknown;
}

type StandardType = keyof DesignToken.ValueByType;

const STANDARD_TYPES: ReadonlySet<string> = new Set(
    Object.values(DesignToken.Type),
);

/**
 * Tests whether a type is one of the standard types, defined by the DTCG
 * format.
 *
 * @internal
 */
export const isStandardType = (type: string): type is StandardType =>
    STANDARD_TYPES.has(type);

const isObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);

const isNumber = (value: unknown): value is number =>
    typeof value === "number" && Number.isFinite(value);

interface Range {
    min: number;
    max: number;
    /**
     * The maximum itself is not allowed, as for a hue of 360.
     */
    exclusive?: boolean;
}

const unit: Range = { min: 0, max: 1 };
const hue: Range = { min: 0, max: 360, exclusive: true };
const percentage: Range = { min: 0, max: 100 };
const open: Range = { min: -Infinity, max: Infinity };
const positive: Range = { min: 0, max: Infinity };

/**
 * The components of each color space, in order, with their ranges.
 *
 * @see {@link https://www.designtokens.org/tr/2025.10/color/}
 */
const COLOR_SPACES: Record<DesignToken.Values.ColorSpace, Range[]> = {
    srgb: [unit, unit, unit],
    "srgb-linear": [unit, unit, unit],
    hsl: [hue, percentage, percentage],
    hwb: [hue, percentage, percentage],
    lab: [percentage, open, open],
    lch: [percentage, positive, hue],
    oklab: [unit, open, open],
    oklch: [unit, positive, hue],
    "display-p3": [unit, unit, unit],
    "a98-rgb": [unit, unit, unit],
    "prophoto-rgb": [unit, unit, unit],
    rec2020: [unit, unit, unit],
    "xyz-d65": [unit, unit, unit],
    "xyz-d50": [unit, unit, unit],
};

/**
 * Rejects a key the format does not define, so a typo is an error instead of
 * being ignored.
 */
const onlyKeys = (
    value: Record<string, unknown>,
    allowed: string[],
    path: string,
    context: ValueContext,
) => {
    for (const key of Object.keys(value)) {
        if (!allowed.includes(key)) {
            context.report(
                path,
                `has an unsupported property "${key}". Expected ${allowed.join(", ")}.`,
            );
        }
    }
};

const describe = (value: unknown): string => {
    return JSON.stringify(value) ?? String(value);
};

/**
 * The keys of a table as alternatives, like `"a", "b" or "c"`.
 */
const oneOf = (table: Readonly<Record<string, unknown>>): string => {
    const keys = Object.keys(table).map((key) => `"${key}"`);
    const last = keys.pop();

    return keys.length > 0 ? `${keys.join(", ")} or ${last}` : `${last}`;
};

/**
 * Reads a value of a type: checks it, reports what's wrong, and returns the
 * config value, a copy with a ref where the document has a reference.
 */
type Reader = (value: unknown, path: string, context: ValueContext) => unknown;

/**
 * Reads a position that holds a value of `type`, or a reference to a token of
 * that type.
 */
const at = (
    type: StandardType,
    value: unknown,
    path: string,
    context: ValueContext,
): unknown =>
    context.reference(value, type, path) ?? READERS[type](value, path, context);

const inRange = (value: number, range: Range): boolean => {
    return (
        value >= range.min &&
        (range.exclusive ? value < range.max : value <= range.max)
    );
};

const color: Reader = (value, path, context) => {
    if (!isObject(value)) {
        context.report(
            path,
            `is not a color. A color is an object with a colorSpace and components, but found ${describe(value)}.`,
        );
        return value;
    }

    onlyKeys(
        value,
        ["colorSpace", "components", "alpha", "hex"],
        path,
        context,
    );

    const result = { ...value };
    const space = value.colorSpace;
    const ranges = isKeyOf(COLOR_SPACES, space)
        ? COLOR_SPACES[space]
        : undefined;

    if (!ranges) {
        context.report(
            `${path}.colorSpace`,
            `is ${describe(space)}, which is not a color space. Expected one of ${Object.keys(COLOR_SPACES).join(", ")}.`,
        );
    }

    if (!Array.isArray(value.components)) {
        context.report(`${path}.components`, "must be an array.");
    } else {
        if (ranges && value.components.length !== ranges.length) {
            context.report(
                `${path}.components`,
                `must have ${ranges.length} components for ${space}, but has ${value.components.length}.`,
            );
        }

        result.components = value.components.map(
            (component: unknown, index: number) => {
                const where = `${path}.components[${index}]`;

                if (component === "none") {
                    return component;
                }

                const ref = context.reference(component, "number", where);

                if (ref !== undefined) {
                    return ref;
                }

                if (!isNumber(component)) {
                    context.report(
                        where,
                        `must be a number or "none", but found ${describe(component)}.`,
                    );
                } else if (
                    ranges?.[index] &&
                    !inRange(component, ranges[index])
                ) {
                    const range = ranges[index];
                    context.report(
                        where,
                        `is ${component}, outside the range of ${space} component ${index + 1}: ${range.min} to ${range.max}${range.exclusive ? " (exclusive)" : ""}.`,
                    );
                }

                return component;
            },
        );
    }

    if (value.alpha !== undefined) {
        const where = `${path}.alpha`;
        const ref = context.reference(value.alpha, "number", where);

        if (ref !== undefined) {
            result.alpha = ref;
        } else if (!(isNumber(value.alpha) && inRange(value.alpha, unit))) {
            context.report(
                where,
                `must be a number from 0 to 1, but found ${describe(value.alpha)}.`,
            );
        }
    }

    if (
        value.hex !== undefined &&
        !(typeof value.hex === "string" && /^#[0-9a-fA-F]{6}$/.test(value.hex))
    ) {
        context.report(
            `${path}.hex`,
            `must be six digit hex notation like "#ff00ff", but found ${describe(value.hex)}.`,
        );
    }

    return result;
};

const withUnit =
    (name: string, units: Readonly<Record<string, true>>): Reader =>
    (value, path, context) => {
        if (!isObject(value)) {
            context.report(
                path,
                `is not a ${name}. A ${name} is an object with a value and a unit, but found ${describe(value)}.`,
            );
            return value;
        }

        onlyKeys(value, ["value", "unit"], path, context);

        if (!isKeyOf(units, value.unit)) {
            context.report(
                `${path}.unit`,
                `must be ${oneOf(units)}, but found ${describe(value.unit)}.`,
            );
        }

        return {
            ...value,
            value: at("number", value.value, `${path}.value`, context),
        };
    };

const fontFamily: Reader = (value, path, context) => {
    if (typeof value === "string") {
        return value;
    }

    if (
        Array.isArray(value) &&
        value.length > 0 &&
        value.every((name) => typeof name === "string")
    ) {
        return [...value];
    }

    context.report(
        path,
        `must be a string or an array of strings, but found ${describe(value)}.`,
    );
    return value;
};

const fontWeight: Reader = (value, path, context) => {
    const ok =
        (isNumber(value) && value >= 1 && value <= 1000) ||
        isKeyOf(FONT_WEIGHTS, value);

    if (!ok) {
        context.report(
            path,
            `must be a number from 1 to 1000 or a font weight keyword, but found ${describe(value)}.`,
        );
    }

    return value;
};

const cubicBezier: Reader = (value, path, context) => {
    if (!Array.isArray(value) || value.length !== 4 || !value.every(isNumber)) {
        context.report(
            path,
            `must be an array of four numbers, but found ${describe(value)}.`,
        );
        return value;
    }

    for (const index of [0, 2]) {
        if (!inRange(value[index], unit)) {
            context.report(
                `${path}[${index}]`,
                `is ${value[index]}, but the x coordinates of a cubic Bézier must be from 0 to 1.`,
            );
        }
    }

    return [...value];
};

const number: Reader = (value, path, context) => {
    if (!isNumber(value)) {
        context.report(path, `must be a number, but found ${describe(value)}.`);
    }

    return value;
};

const strokeStyle: Reader = (value, path, context) => {
    if (typeof value === "string") {
        if (!isKeyOf(STROKE_STYLES, value)) {
            context.report(
                path,
                `is "${value}", which is not a stroke style. Expected one of ${Object.keys(STROKE_STYLES).join(", ")}, or a dashArray and lineCap.`,
            );
        }
        return value;
    }

    if (!isObject(value)) {
        context.report(
            path,
            `must be a stroke style keyword or an object, but found ${describe(value)}.`,
        );
        return value;
    }

    onlyKeys(value, ["dashArray", "lineCap"], path, context);

    const result = { ...value };

    if (!Array.isArray(value.dashArray) || value.dashArray.length === 0) {
        context.report(`${path}.dashArray`, "must be an array of dimensions.");
    } else {
        result.dashArray = value.dashArray.map((dash: unknown, index: number) =>
            at("dimension", dash, `${path}.dashArray[${index}]`, context),
        );
    }

    if (!isKeyOf(LINE_CAPS, value.lineCap)) {
        context.report(
            `${path}.lineCap`,
            `must be ${oneOf(LINE_CAPS)}, but found ${describe(value.lineCap)}.`,
        );
    }

    return result;
};

/**
 * Reads the required properties of an object that have a type, each of which
 * may be a reference to a token of its type.
 */
const properties = (
    value: Record<string, unknown>,
    types: Record<string, StandardType>,
    path: string,
    context: ValueContext,
): Record<string, unknown> => {
    const result = { ...value };

    for (const [property, type] of Object.entries(types)) {
        if (value[property] === undefined) {
            context.report(`${path}.${property}`, "is required.");
        } else {
            result[property] = at(
                type,
                value[property],
                `${path}.${property}`,
                context,
            );
        }
    }

    return result;
};

/**
 * A reader of an object whose every property is required and has a type.
 */
const composite =
    (name: string, types: Record<string, StandardType>): Reader =>
    (value, path, context) => {
        if (!isObject(value)) {
            context.report(
                path,
                `is not a ${name}. A ${name} is an object, but found ${describe(value)}.`,
            );
            return value;
        }

        onlyKeys(value, Object.keys(types), path, context);

        return properties(value, types, path, context);
    };

const shadowLayer: Reader = (value, path, context) => {
    if (!isObject(value)) {
        context.report(
            path,
            `is not a shadow. A shadow is an object, but found ${describe(value)}.`,
        );
        return value;
    }

    onlyKeys(
        value,
        ["color", "offsetX", "offsetY", "blur", "spread", "inset"],
        path,
        context,
    );

    if (value.inset !== undefined && typeof value.inset !== "boolean") {
        context.report(
            `${path}.inset`,
            `must be true or false, but found ${describe(value.inset)}.`,
        );
    }

    return properties(
        value,
        {
            color: "color",
            offsetX: "dimension",
            offsetY: "dimension",
            blur: "dimension",
            spread: "dimension",
        },
        path,
        context,
    );
};

const shadow: Reader = (value, path, context) => {
    if (!Array.isArray(value)) {
        return shadowLayer(value, path, context);
    }

    if (value.length === 0) {
        context.report(path, "must have at least one shadow.");
    }

    return value.map((layer, index) => {
        const where = `${path}[${index}]`;

        return (
            context.reference(layer, "shadow", where) ??
            shadowLayer(layer, where, context)
        );
    });
};

const gradient: Reader = (value, path, context) => {
    if (!Array.isArray(value) || value.length === 0) {
        context.report(
            path,
            `must be an array of gradient stops, but found ${describe(value)}.`,
        );
        return value;
    }

    return value.map((stop, index) => {
        const where = `${path}[${index}]`;
        const ref = context.reference(stop, "gradient", where);

        if (ref !== undefined) {
            return ref;
        }

        if (!isObject(stop)) {
            context.report(
                where,
                `is not a gradient stop. A stop is an object with a color and a position, but found ${describe(stop)}.`,
            );
            return stop;
        }

        onlyKeys(stop, ["color", "position"], where, context);

        const result = properties(stop, { color: "color" }, where, context);
        const position = `${where}.position`;

        if (stop.position === undefined) {
            context.report(position, "is required.");
        } else {
            const ref = context.reference(stop.position, "number", position);

            if (ref !== undefined) {
                result.position = ref;
            } else if (!isNumber(stop.position)) {
                context.report(
                    position,
                    `must be a number from 0 to 1, but found ${describe(stop.position)}.`,
                );
            }
        }

        return result;
    });
};

const READERS: Record<StandardType, Reader> = {
    border: composite("border", {
        color: "color",
        width: "dimension",
        style: "strokeStyle",
    }),
    color,
    cubicBezier,
    dimension: withUnit("dimension", DIMENSION_UNITS),
    duration: withUnit("duration", DURATION_UNITS),
    fontFamily,
    fontWeight,
    gradient,
    number,
    shadow,
    strokeStyle,
    transition: composite("transition", {
        duration: "duration",
        delay: "duration",
        timingFunction: "cubicBezier",
    }),
    typography: composite("typography", {
        fontFamily: "fontFamily",
        fontSize: "dimension",
        fontWeight: "fontWeight",
        letterSpacing: "dimension",
        lineHeight: "number",
    }),
};

/**
 * Reads the `$value` of a token of a standard type, in the shapes of the
 * 2025.10 format and color module. A reference inside a composite value is
 * checked to name a token of the type the position needs.
 *
 * @internal
 */
export const readValue = (
    type: StandardType,
    value: unknown,
    path: string,
    context: ValueContext,
): unknown => READERS[type](value, path, context);
