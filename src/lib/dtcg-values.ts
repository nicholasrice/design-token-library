import { DesignToken } from "./design-token.js";
import { isRef } from "./recipe.js";

/**
 * What a validator needs from the document being loaded.
 *
 * @internal
 */
export interface ValueContext {
    /**
     * Reports a problem with the value at `path`.
     */
    report(path: string, message: string): void;

    /**
     * Checks that a `{reference}` names a token of the type a value position
     * needs.
     */
    checkRef(ref: string, expected: string, path: string): void;
}

const DTCG_TYPES: ReadonlySet<string> = new Set(
    Object.values(DesignToken.Type),
);

/**
 * Tests whether a type is one defined by the format module.
 *
 * @internal
 */
export const isDTCGType = (type: string): boolean => DTCG_TYPES.has(type);

const isObject = (value: unknown): value is Record<string, any> =>
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
const COLOR_SPACES: Record<string, Range[]> = {
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

const FONT_WEIGHTS = new Set([
    "thin",
    "hairline",
    "extra-light",
    "ultra-light",
    "light",
    "normal",
    "regular",
    "book",
    "medium",
    "semi-bold",
    "demi-bold",
    "bold",
    "extra-bold",
    "ultra-bold",
    "black",
    "heavy",
    "extra-black",
    "ultra-black",
]);

const STROKE_KEYWORDS = new Set([
    "solid",
    "dashed",
    "dotted",
    "double",
    "groove",
    "ridge",
    "outset",
    "inset",
]);

const LINE_CAPS = new Set(["round", "butt", "square"]);

/**
 * Rejects a key the format does not define, so a typo is an error instead of
 * being ignored.
 */
const onlyKeys = (
    value: Record<string, any>,
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

type Validator = (value: unknown, path: string, context: ValueContext) => void;

/**
 * Validates a position that holds a value of `type`, or a reference to a token
 * of that type.
 */
const sub = (
    type: string,
    value: unknown,
    path: string,
    context: ValueContext,
) => {
    if (isRef(value)) {
        context.checkRef(value, type, path);
    } else {
        VALIDATORS[type](value, path, context);
    }
};

const inRange = (value: number, range: Range): boolean => {
    return (
        value >= range.min &&
        (range.exclusive ? value < range.max : value <= range.max)
    );
};

const color: Validator = (value, path, context) => {
    if (!isObject(value)) {
        context.report(
            path,
            `is not a color. A color is an object with a colorSpace and components, but found ${describe(value)}.`,
        );
        return;
    }

    onlyKeys(
        value,
        ["colorSpace", "components", "alpha", "hex"],
        path,
        context,
    );

    const ranges = COLOR_SPACES[value.colorSpace];

    if (!ranges) {
        context.report(
            `${path}.colorSpace`,
            `is ${describe(value.colorSpace)}, which is not a color space. Expected one of ${Object.keys(COLOR_SPACES).join(", ")}.`,
        );
    }

    if (!Array.isArray(value.components)) {
        context.report(`${path}.components`, "must be an array.");
    } else {
        if (ranges && value.components.length !== ranges.length) {
            context.report(
                `${path}.components`,
                `must have ${ranges.length} components for ${value.colorSpace}, but has ${value.components.length}.`,
            );
        }

        value.components.forEach((component: unknown, index: number) => {
            const where = `${path}.components[${index}]`;

            if (component === "none") {
                return;
            }

            if (isRef(component)) {
                context.checkRef(component, "number", where);
                return;
            }

            if (!isNumber(component)) {
                context.report(
                    where,
                    `must be a number or "none", but found ${describe(component)}.`,
                );
            } else if (ranges?.[index] && !inRange(component, ranges[index])) {
                const range = ranges[index];
                context.report(
                    where,
                    `is ${component}, outside the range of ${value.colorSpace} component ${index + 1}: ${range.min} to ${range.max}${range.exclusive ? " (exclusive)" : ""}.`,
                );
            }
        });
    }

    if (isRef(value.alpha)) {
        context.checkRef(value.alpha, "number", `${path}.alpha`);
    } else if (
        value.alpha !== undefined &&
        !(isNumber(value.alpha) && inRange(value.alpha, unit))
    ) {
        context.report(
            `${path}.alpha`,
            `must be a number from 0 to 1, but found ${describe(value.alpha)}.`,
        );
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
};

const withUnit =
    (name: string, units: string[]): Validator =>
    (value, path, context) => {
        if (!isObject(value)) {
            context.report(
                path,
                `is not a ${name}. A ${name} is an object with a value and a unit, but found ${describe(value)}.`,
            );
            return;
        }

        onlyKeys(value, ["value", "unit"], path, context);

        if (isRef(value.value)) {
            context.checkRef(value.value, "number", `${path}.value`);
        } else if (!isNumber(value.value)) {
            context.report(
                `${path}.value`,
                `must be a number, but found ${describe(value.value)}.`,
            );
        }

        if (!units.includes(value.unit)) {
            context.report(
                `${path}.unit`,
                `must be ${units.map((u) => `"${u}"`).join(" or ")}, but found ${describe(value.unit)}.`,
            );
        }
    };

const fontFamily: Validator = (value, path, context) => {
    const ok =
        typeof value === "string" ||
        (Array.isArray(value) &&
            value.length > 0 &&
            value.every((name) => typeof name === "string"));

    if (!ok) {
        context.report(
            path,
            `must be a string or an array of strings, but found ${describe(value)}.`,
        );
    }
};

const fontWeight: Validator = (value, path, context) => {
    const ok =
        (isNumber(value) && value >= 1 && value <= 1000) ||
        (typeof value === "string" && FONT_WEIGHTS.has(value));

    if (!ok) {
        context.report(
            path,
            `must be a number from 1 to 1000 or a font weight keyword, but found ${describe(value)}.`,
        );
    }
};

const cubicBezier: Validator = (value, path, context) => {
    if (!Array.isArray(value) || value.length !== 4 || !value.every(isNumber)) {
        context.report(
            path,
            `must be an array of four numbers, but found ${describe(value)}.`,
        );
        return;
    }

    for (const index of [0, 2]) {
        if (!inRange(value[index], unit)) {
            context.report(
                `${path}[${index}]`,
                `is ${value[index]}, but the x coordinates of a cubic Bézier must be from 0 to 1.`,
            );
        }
    }
};

const number: Validator = (value, path, context) => {
    if (!isNumber(value)) {
        context.report(path, `must be a number, but found ${describe(value)}.`);
    }
};

const strokeStyle: Validator = (value, path, context) => {
    if (typeof value === "string") {
        if (!STROKE_KEYWORDS.has(value)) {
            context.report(
                path,
                `is "${value}", which is not a stroke style. Expected one of ${[...STROKE_KEYWORDS].join(", ")}, or a dashArray and lineCap.`,
            );
        }
        return;
    }

    if (!isObject(value)) {
        context.report(
            path,
            `must be a stroke style keyword or an object, but found ${describe(value)}.`,
        );
        return;
    }

    onlyKeys(value, ["dashArray", "lineCap"], path, context);

    if (!Array.isArray(value.dashArray) || value.dashArray.length === 0) {
        context.report(`${path}.dashArray`, "must be an array of dimensions.");
    } else {
        value.dashArray.forEach((dash: unknown, index: number) =>
            sub("dimension", dash, `${path}.dashArray[${index}]`, context),
        );
    }

    if (!LINE_CAPS.has(value.lineCap)) {
        context.report(
            `${path}.lineCap`,
            `must be "round", "butt" or "square", but found ${describe(value.lineCap)}.`,
        );
    }
};

/**
 * A validator for an object whose every property is required and has a type.
 */
const composite =
    (name: string, properties: Record<string, string>): Validator =>
    (value, path, context) => {
        if (!isObject(value)) {
            context.report(
                path,
                `is not a ${name}. A ${name} is an object, but found ${describe(value)}.`,
            );
            return;
        }

        onlyKeys(value, Object.keys(properties), path, context);

        for (const [property, type] of Object.entries(properties)) {
            if (value[property] === undefined) {
                context.report(`${path}.${property}`, "is required.");
            } else {
                sub(type, value[property], `${path}.${property}`, context);
            }
        }
    };

const shadowLayer: Validator = (value, path, context) => {
    if (!isObject(value)) {
        context.report(
            path,
            `is not a shadow. A shadow is an object, but found ${describe(value)}.`,
        );
        return;
    }

    onlyKeys(
        value,
        ["color", "offsetX", "offsetY", "blur", "spread", "inset"],
        path,
        context,
    );

    const required: Record<string, string> = {
        color: "color",
        offsetX: "dimension",
        offsetY: "dimension",
        blur: "dimension",
        spread: "dimension",
    };

    for (const [property, type] of Object.entries(required)) {
        if (value[property] === undefined) {
            context.report(`${path}.${property}`, "is required.");
        } else {
            sub(type, value[property], `${path}.${property}`, context);
        }
    }

    if (value.inset !== undefined && typeof value.inset !== "boolean") {
        context.report(
            `${path}.inset`,
            `must be true or false, but found ${describe(value.inset)}.`,
        );
    }
};

const shadow: Validator = (value, path, context) => {
    if (Array.isArray(value)) {
        if (value.length === 0) {
            context.report(path, "must have at least one shadow.");
        }

        value.forEach((layer, index) => {
            if (isRef(layer)) {
                context.checkRef(layer, "shadow", `${path}[${index}]`);
            } else {
                shadowLayer(layer, `${path}[${index}]`, context);
            }
        });
    } else {
        shadowLayer(value, path, context);
    }
};

const gradient: Validator = (value, path, context) => {
    if (!Array.isArray(value) || value.length === 0) {
        context.report(
            path,
            `must be an array of gradient stops, but found ${describe(value)}.`,
        );
        return;
    }

    value.forEach((stop, index) => {
        const where = `${path}[${index}]`;

        if (isRef(stop)) {
            context.checkRef(stop, "gradient", where);
            return;
        }

        if (!isObject(stop)) {
            context.report(
                where,
                `is not a gradient stop. A stop is an object with a color and a position, but found ${describe(stop)}.`,
            );
            return;
        }

        onlyKeys(stop, ["color", "position"], where, context);

        if (stop.color === undefined) {
            context.report(`${where}.color`, "is required.");
        } else {
            sub("color", stop.color, `${where}.color`, context);
        }

        if (stop.position === undefined) {
            context.report(`${where}.position`, "is required.");
        } else if (isRef(stop.position)) {
            context.checkRef(stop.position, "number", `${where}.position`);
        } else if (!isNumber(stop.position)) {
            context.report(
                `${where}.position`,
                `must be a number from 0 to 1, but found ${describe(stop.position)}.`,
            );
        }
    });
};

const VALIDATORS: Record<string, Validator> = {
    [DesignToken.Type.Color]: color,
    [DesignToken.Type.Dimension]: withUnit("dimension", ["px", "rem"]),
    [DesignToken.Type.Duration]: withUnit("duration", ["ms", "s"]),
    [DesignToken.Type.FontFamily]: fontFamily,
    [DesignToken.Type.FontWeight]: fontWeight,
    [DesignToken.Type.CubicBezier]: cubicBezier,
    [DesignToken.Type.Number]: number,
    [DesignToken.Type.StrokeStyle]: strokeStyle,
    [DesignToken.Type.Border]: composite("border", {
        color: "color",
        width: "dimension",
        style: "strokeStyle",
    }),
    [DesignToken.Type.Transition]: composite("transition", {
        duration: "duration",
        delay: "duration",
        timingFunction: "cubicBezier",
    }),
    [DesignToken.Type.Shadow]: shadow,
    [DesignToken.Type.Gradient]: gradient,
    [DesignToken.Type.Typography]: composite("typography", {
        fontFamily: "fontFamily",
        fontSize: "dimension",
        fontWeight: "fontWeight",
        letterSpacing: "dimension",
        lineHeight: "number",
    }),
};

/**
 * Validates the `$value` of a token of a DTCG type against the 2025.10 format.
 * A reference inside a composite value is checked to name a token of the type
 * the position needs.
 *
 * @internal
 */
export const validateValue = (
    type: string,
    value: unknown,
    path: string,
    context: ValueContext,
): void => {
    VALIDATORS[type](value, path, context);
};
