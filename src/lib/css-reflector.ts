import { DesignToken } from "./design-token.js";
import { Library } from "./library.js";
import { isToken } from "./utilities.js";

/**
 * Options that control which tokens are reflected to CSS custom properties and
 * what those properties are named.
 *
 * @public
 */
export interface CSSPropertiesOptions {
    /**
     * Return `false` to omit a token from the output. The filter runs before a
     * token's value is read, so omitted tokens are never resolved.
     */
    filter?(token: Library.Token<any, any>): boolean;

    /**
     * Derives a token's custom property name, without the leading `--`.
     *
     * @remarks
     * Defaults to the token's name with `.` replaced by `-` for
     * {@link toProperties}, and to the token's name as-is for {@link toCSS}.
     * Pass the same function to both to keep the names aligned.
     *
     * A group's `$root` token is named for the group: `color.accent.$root`
     * becomes `color.accent`.
     */
    name?(token: Library.Token<any, any>): string;
}

/**
 * Options accepted by {@link toCSS}.
 *
 * @public
 */
export interface CSSOptions extends CSSPropertiesOptions {
    /**
     * Converts token values to CSS, keyed by token type. A converter takes
     * precedence over the built-in converter for the same type, and is how a
     * custom token type is serialized.
     */
    converters?: Record<
        string,
        (value: any, token: Library.Token<any, any>) => string
    >;
}

/**
 * @public
 */
export function toCSS(
    library: Library.Library<any, any>,
    options: CSSOptions = {},
): string {
    return recurseToCss(library.tokens, options);
}

interface CSSPropertyValues {
    readonly var: `var(--${string})`;
    readonly property: `--${string}`;
}

/**
 * A collection of {@link @CSSPropertyValues} that mirrors the
 * structure of the source {@link Library.Library<any> | Library}.
 * @public
 */
export type CSSPropertiesLibrary<T extends {}> = {
    [K in keyof Readonly<T>]: T[K] extends
        | DesignToken.Any
        | Library.Token<any, any>
        ? CSSPropertyValues
        : K extends `$${string}`
          ? T[K]
          : T[K] extends {}
            ? CSSPropertiesLibrary<T[K]>
            : never;
};

/**
 * Construct an {@link CSSPropertiesLibrary} from a {@link Library.Library<any>}.
 * @public
 */
export function toProperties<T extends Library.Library<any>>(
    library: T,
    options: CSSPropertiesOptions = {},
): CSSPropertiesLibrary<T["tokens"]> {
    const recurse = (
        section: Library.TokenLibrary<any>,
        properties: CSSPropertiesLibrary<any>,
    ) => {
        for (const key in section) {
            const sectionValue = section[key];

            if (isToken(sectionValue)) {
                if (options.filter && !options.filter(sectionValue)) {
                    continue;
                }

                const property = `--${
                    options.name
                        ? options.name(sectionValue)
                        : nameOf(sectionValue).replaceAll(".", "-")
                }`;
                const propertyValue = Object.freeze({
                    var: `var(${property})`,
                    property,
                });
                Reflect.defineProperty(properties, key, {
                    value: propertyValue,
                    enumerable: true,
                });
            } else {
                const value = {};
                recurse(sectionValue, value);
                Reflect.defineProperty(properties, key, {
                    value: Object.freeze(value),
                    enumerable: true,
                });
            }
        }
    };

    const properties: CSSPropertiesLibrary<T["tokens"]> = {} as any;
    recurse(library.tokens, properties);

    return properties;
}

/**
 * `$` cannot begin a CSS identifier, so a `$root` token takes its group's name.
 */
const nameOf = (token: Library.Token<any, any>): string => {
    return token.name.replace(/(^|\.)\$root$/, "") || "root";
};

const needsJSON = (value: unknown): boolean => {
    return (
        typeof value === "object" &&
        value !== null &&
        (!Array.isArray(value) || value.some((v) => typeof v === "object"))
    );
};

const recurseToCss = (
    librarySection: Library.TokenLibrary<any, any>,
    options: CSSOptions,
): string => {
    let result = "";
    for (const key in librarySection) {
        const tokenOrGroup = librarySection[key];

        if (isToken(tokenOrGroup)) {
            if (options.filter && !options.filter(tokenOrGroup)) {
                continue;
            }

            let value = tokenOrGroup.$value;
            const converter = findConverter(tokenOrGroup, options);

            if (converter) {
                value = converter(value, tokenOrGroup);
            } else if (needsJSON(value)) {
                // A custom type with no converter: show the value rather than
                // "[object Object]". Provide a converter for valid CSS.
                value = JSON.stringify(value);
            }

            const name = options.name
                ? options.name(tokenOrGroup)
                : nameOf(tokenOrGroup);
            result += `--${name}:${value};`;
        } else {
            result += recurseToCss(tokenOrGroup, options);
        }
    }

    return result;
};

/**
 * Provided converters win over the built-in ones. Own-property checks keep a
 * token type such as "toString" from resolving to an inherited method.
 */
const findConverter = (
    token: Library.Token<any, any>,
    options: CSSOptions,
): ((value: any, token: Library.Token<any, any>) => string) | undefined => {
    const type: string | undefined = token.$type;

    if (type === undefined) {
        return undefined;
    }

    if (options.converters && Object.hasOwn(options.converters, type)) {
        return options.converters[type];
    }

    return Reflect.has(TokenConverters, type)
        ? Reflect.get(TokenConverters, type)
        : undefined;
};

const joiner = <T extends []>(value: T): string => {
    return value.join(" ");
};

const dimensionConverter = (value: DesignToken.Values.Dimension): string => {
    return `${value.value}${value.unit}`;
};

const durationConverter = (value: DesignToken.Values.Duration): string => {
    return `${value.value}${value.unit}`;
};

const percent = (component: number | "none"): string => {
    return component === "none" ? "none" : `${component}%`;
};

const hexByte = (component: number): string => {
    const byte = Math.min(255, Math.max(0, Math.round(component * 255)));

    return byte.toString(16).padStart(2, "0");
};

/**
 * Convert a color to CSS. An sRGB color becomes hex, and the other color
 * spaces become the CSS color function for the space.
 */
const colorConverter = (value: DesignToken.Values.Color): string => {
    const alpha = value.alpha ?? 1;
    const components = value.components;
    const slash = alpha === 1 ? "" : ` / ${alpha}`;
    const [a, b, c] = components;

    switch (value.colorSpace) {
        case "srgb":
            if (components.every((component) => component !== "none")) {
                return `#${(components as number[]).map(hexByte).join("")}${
                    alpha === 1 ? "" : hexByte(alpha)
                }`;
            }
            break;
        case "hsl":
            return `hsl(${a} ${percent(b)} ${percent(c)}${slash})`;
        case "hwb":
            return `hwb(${a} ${percent(b)} ${percent(c)}${slash})`;
        case "lab":
        case "lch":
        case "oklab":
        case "oklch":
            return `${value.colorSpace}(${components.join(" ")}${slash})`;
    }

    return `color(${value.colorSpace} ${components.join(" ")}${slash})`;
};

/**
 * Convert a border value to CSS
 */
const borderConverter = (value: DesignToken.Values.Border): string => {
    return `${dimensionConverter(value.width)} ${strokeStyleConverter(
        value.style,
    )} ${colorConverter(value.color)}`;
};

const cubicBezierConverter = (
    value: DesignToken.Values.CubicBezier,
): string => {
    return `cubic-bezier(${value.join(", ")})`;
};

const fontFamilyConverter = (value: DesignToken.Values.FontFamily): string => {
    return typeof value === "string"
        ? fontFamilyQuoter(value)
        : value.map(fontFamilyQuoter).join();
};
const fontFamilyQuoter = (value: string): string => {
    const test = /^(\'|\")?(.*?)(\'|\")?$/;
    const result = test.exec(value);

    if (result !== null && (result[1] || result[3])) {
        value = result[2];
    }

    return value.includes(" ") ? `"${value}"` : value;
};

const fontWeights: Record<string, number> = {
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

const fontWeightConverter = (value: DesignToken.Values.FontWeight): string => {
    return String(typeof value === "number" ? value : fontWeights[value]);
};

type Unpacked<T> = T extends (infer U)[] ? U : T;

const gradientReducer = (
    accumulated: string,
    value: Unpacked<DesignToken.Values.Gradient>,
): string => {
    return (
        accumulated + `${colorConverter(value.color)} ${value.position * 100}%,`
    );
};
const gradientConverter = (value: DesignToken.Values.Gradient): string => {
    return value.reduce(gradientReducer, "").replace(/,$/, "");
};

const shadowConverter = (value: DesignToken.Values.Shadow): string => {
    return (Array.isArray(value) ? value : [value])
        .map(
            (layer) =>
                `${layer.inset ? "inset " : ""}${dimensionConverter(
                    layer.offsetX,
                )} ${dimensionConverter(layer.offsetY)} ${dimensionConverter(
                    layer.blur,
                )} ${dimensionConverter(layer.spread)} ${colorConverter(
                    layer.color,
                )}`,
        )
        .join(", ");
};

const strokeStyleConverter = (
    value: DesignToken.Values.StrokeStyle,
): string => {
    // CSS doesn't support customizing dashed borders at the time of authoring.
    return typeof value === "string" ? value : "dashed";
};

const transitionConverter = (value: DesignToken.Values.Transition): string => {
    return `${durationConverter(value.duration)} ${cubicBezierConverter(
        value.timingFunction,
    )} ${durationConverter(value.delay)}`;
};

const TokenConverters = {
    [DesignToken.Type.Border]: borderConverter,
    [DesignToken.Type.Color]: colorConverter,
    [DesignToken.Type.CubicBezier]: cubicBezierConverter,
    [DesignToken.Type.Dimension]: dimensionConverter,
    [DesignToken.Type.Duration]: durationConverter,
    [DesignToken.Type.FontFamily]: fontFamilyConverter,
    [DesignToken.Type.FontWeight]: fontWeightConverter,
    [DesignToken.Type.Gradient]: gradientConverter,
    [DesignToken.Type.Shadow]: shadowConverter,
    [DesignToken.Type.StrokeStyle]: strokeStyleConverter,
    [DesignToken.Type.Transition]: transitionConverter,
};
