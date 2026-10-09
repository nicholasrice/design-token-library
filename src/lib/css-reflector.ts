import { DesignToken } from "./design-token.js";
import { Library } from "./library.js";
import { isToken } from "./utilities.js";

/**
 * Converts a token value to a CSS value.
 *
 * @public
 */
export type CSSConverter<V, T extends DesignToken.Shape = DesignToken.Shape> = (
    value: V,
    token: Library.Token<T, {}>,
) => string;

/**
 * A union of the custom tokens in a library of shape `T`: tokens whose
 * type is not defined by {@link https://www.designtokens.org/tr/2025.10/format/#types}.
 *
 * @public
 */
export type CustomTokensOf<T> = Exclude<
    Library.TokensOf<T>,
    { $type?: DesignToken.Type }
>;

/**
 * A {@link CSSConverter} for each custom token type in a library of shape `T`,
 * keyed by type name.
 *
 * @public
 */
export type CSSConverters<T> = ConvertersOf<CustomTokensOf<T>>;

type ConvertersOf<C> = {
    [N in C extends { $type: infer N extends string } ? N : never]: C extends {
        $type: N;
    }
        ? C extends DesignToken.Shape
            ? CSSConverter<DesignToken.ValueByToken<C>, C>
            : never
        : never;
};

/**
 * Options that control how custom properties are named.
 *
 * @public
 */
export interface CSSPropertiesOptions {
    /**
     * Derives a token's custom property name, without the leading `--`.
     *
     * @remarks
     * Defaults to the token's name with `.` replaced by `-`. Pass the same
     * function to {@link toCSS} and {@link toProperties} to keep the names
     * aligned.
     */
    name?(token: Library.Token<any, any>): string;
}

/**
 * Options accepted by {@link toCSS}.
 *
 * @remarks
 * `converters` is required when the library contains custom token types,
 * and must provide a converter for each of them.
 *
 * @public
 */
export type CSSOptions<T> = CSSPropertiesOptions &
    ([CustomTokensOf<T>] extends [never]
        ? { converters?: { readonly [type: string]: never } }
        : { converters: CSSConverters<T> });

/**
 * The trailing arguments of {@link toCSS}: {@link CSSOptions} are
 * required when the library contains custom token types.
 *
 * @public
 */
export type ToCSSArgs<T> = [CustomTokensOf<T>] extends [never]
    ? [options?: CSSOptions<T>]
    : [options: CSSOptions<T>];

/**
 * Convert a library to CSS custom property declarations.
 *
 * @remarks
 * Libraries with custom token types must provide a converter for each
 * custom type.
 *
 * @public
 */
export function toCSS<T extends {}, R extends {}>(
    library: Library.Library<T, R>,
    ...[options]: ToCSSArgs<NoInfer<T>>
): string {
    // Converters are checked by `ToCSSArgs`; at runtime they're keyed by type.
    const converters: unknown = options?.converters ?? {};
    return recurseToCss(
        library.tokens,
        converters as RuntimeConverters,
        options?.name ?? defaultName,
    );
}

type NameFn = (token: Library.Token<any, any>) => string;

/**
 * `$` cannot begin a CSS identifier, so a group's `$root` token is named for
 * the group: `color.$root` is `--color`.
 */
const defaultName: NameFn = (token) =>
    token.name.replace(/\.\$root$/, "").replaceAll(".", "-");

const needsJSON = (value: unknown): boolean => {
    return (
        typeof value === "object" &&
        value !== null &&
        (!Array.isArray(value) || value.some((v) => typeof v === "object"))
    );
};

type RuntimeConverters = Readonly<Record<string, CSSConverter<any>>>;

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
    [K in keyof Readonly<T>]: T[K] extends DesignToken.Shape
        ? CSSPropertyValues
        : K extends keyof DesignToken.Group
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
    const getName = options.name ?? defaultName;
    const recurse = (
        section: Library.TokenLibrary<any>,
        properties: CSSPropertiesLibrary<any>,
    ) => {
        for (const key in section) {
            const sectionValue: any = section[key];

            if (isToken(sectionValue)) {
                const property = `--${getName(sectionValue)}`;
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

const standardTypes: ReadonlySet<string> = new Set(
    Object.values(DesignToken.Type),
);

const recurseToCss = (
    librarySection: { readonly [key: string]: any },
    customConverters: RuntimeConverters,
    getName: NameFn,
): string => {
    let result = "";
    for (const key in librarySection) {
        const tokenOrGroup = librarySection[key];

        if (isToken(tokenOrGroup)) {
            const { $type: type, name } = tokenOrGroup;
            let value = tokenOrGroup.$value;

            if (Reflect.has(TokenConverters, type)) {
                value = Reflect.get(TokenConverters, type)(value);
            } else if (Reflect.has(customConverters, type)) {
                value = customConverters[type](value, tokenOrGroup);
            } else if (!standardTypes.has(type)) {
                throw new Error(
                    `No CSS converter provided for custom type '${type}' of token '${name}'.`,
                );
            } else if (needsJSON(value)) {
                // A standard type with no converter: show the value rather
                // than "[object Object]".
                value = JSON.stringify(value);
            }
            result += `--${getName(tokenOrGroup)}:${value};`;
        } else {
            result += recurseToCss(tokenOrGroup, customConverters, getName);
        }
    }

    return result;
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
