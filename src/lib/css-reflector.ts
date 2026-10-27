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
 * A converter for any of the standard types, which is used in place of the one
 * of the library.
 */
type StandardConverters = {
    [N in keyof DesignToken.ValueByType]?: CSSConverter<
        DesignToken.ValueByType[N],
        Extract<DesignToken.Standard, { $type: N }>
    >;
};

/**
 * What a library of shape `T` accepts for each custom token type: a
 * {@link CSSConverter}, or `false` for a type that is not serialized.
 *
 * @public
 */
export type CSSConverterEntries<T> = {
    [N in keyof CSSConverters<T>]: CSSConverters<T>[N] | false;
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
 * Options accepted by {@link toProperties}.
 *
 * @public
 */
export interface ToPropertiesOptions extends CSSPropertiesOptions {
    /**
     * The converters given to {@link toCSS}. A token whose custom type is `false`
     * isn't written by `toCSS`, so it has no custom property and is left out.
     */
    converters?: {
        readonly [type: string]: ((value: any, token: any) => string) | false;
    };
}

/**
 * Options accepted by {@link toCSS}.
 *
 * @remarks
 * `converters` is required when the library contains custom token types,
 * and must have an entry for each of them: a converter, or `false` for a type
 * whose tokens are not written to CSS.
 * It can have a converter for a standard type as well, which is used in place
 * of the one of the library, see {@link convert} for what it does.
 *
 * @public
 */
export type CSSOptions<T> = CSSPropertiesOptions &
    ([CustomTokensOf<T>] extends [never]
        ? { converters?: StandardConverters }
        : { converters: CSSConverterEntries<T> & StandardConverters });

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
 * custom type, or `false` to leave tokens of that type out of the CSS.
 * A converter for a standard type is used in place of the one of the library.
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

type RuntimeConverters = Readonly<Record<string, CSSConverter<any> | false>>;

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
 *
 * @remarks
 * Pass the same `converters` given to {@link toCSS} to leave out the tokens it does
 * not write (a custom type whose converter is `false`). They are still in the
 * {@link CSSPropertiesLibrary} type, but missing at runtime.
 *
 * @public
 */
export function toProperties<T extends Library.Library<any>>(
    library: T,
    options: ToPropertiesOptions = {},
): CSSPropertiesLibrary<T["tokens"]> {
    const getName = options.name ?? defaultName;
    const converters: Readonly<Record<string, unknown>> =
        options.converters ?? {};
    const recurse = (
        section: Library.TokenLibrary<any>,
        properties: CSSPropertiesLibrary<any>,
    ) => {
        for (const key in section) {
            const sectionValue: any = section[key];

            if (isToken(sectionValue)) {
                // `toCSS` doesn't write a token whose type is `false`.
                if (converters[sectionValue.$type] === false) {
                    continue;
                }

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

    return Object.freeze(properties);
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

            if (Reflect.has(customConverters, type)) {
                const converter = customConverters[type];

                if (converter === false) {
                    continue;
                }

                value = converter(value, tokenOrGroup);
            } else if (Reflect.has(TokenConverters, type)) {
                value = Reflect.get(TokenConverters, type)(value);
            } else if (!standardTypes.has(type)) {
                throw new Error(
                    `No CSS converter provided for custom type '${type}' of token '${name}'.`,
                );
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
    // Round away float artifacts, e.g. 0.07 * 100 is 7.000000000000001.
    const position = Number((value.position * 100).toPrecision(12));

    return accumulated + `${colorConverter(value.color)} ${position}%,`;
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

/**
 * Convert typography to the CSS `font` shorthand. `letterSpacing` cannot be
 * expressed in the shorthand, so it is omitted.
 */
const typographyConverter = (value: DesignToken.Values.Typography): string => {
    return `${fontWeightConverter(value.fontWeight)} ${dimensionConverter(
        value.fontSize,
    )}/${value.lineHeight} ${fontFamilyConverter(value.fontFamily)}`;
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
    [DesignToken.Type.Typography]: typographyConverter,
};

/**
 * Converts a value of a standard type to CSS, the way {@link toCSS} does for a
 * token of the type, without a converter for the type in `converters`.
 *
 * @remarks
 * A converter for a custom type that has values of standard types uses it for
 * each of them, and a converter for a standard type can use it for what it
 * keeps.
 *
 * @example
 * ```ts
 * toCSS(library, {
 *     converters: {
 *         elevation: (value) =>
 *             `${convert("dimension", value.offset)} ${convert("color", value.color)}`,
 *     },
 * });
 * ```
 *
 * @param type - The type, like `"color"`
 * @param value - The value of a token of the type
 * @returns The value as it is written to CSS
 *
 * @public
 */
export function convert<Name extends keyof DesignToken.ValueByType>(
    type: Name,
    value: DesignToken.ValueByType[Name],
): string {
    const converter = (
        TokenConverters as Record<string, ((value: any) => string) | undefined>
    )[type];

    return converter ? converter(value) : String(value);
}
