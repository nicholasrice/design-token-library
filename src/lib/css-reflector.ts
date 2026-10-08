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
                        : sectionValue.name.replaceAll(".", "-")
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
            }

            const name = options.name
                ? options.name(tokenOrGroup)
                : tokenOrGroup.name;
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
/**
 * Convert a border value to CSS
 */
const borderConverter = (value: DesignToken.Values.Border): string => {
    return `${value.width} ${value.style} ${value.color}`;
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

type Unpacked<T> = T extends (infer U)[] ? U : T;

const gradientReducer = (
    accumulated: string,
    value: Unpacked<DesignToken.Values.Gradient>,
): string => {
    return accumulated + `${value.color} ${value.position * 100}%,`;
};
const gradientConverter = (value: DesignToken.Values.Gradient): string => {
    return value.reduce(gradientReducer, "").replace(/,$/, "");
};

const shadowConverter = (value: DesignToken.Values.Shadow): string => {
    return `${value.offsetX} ${value.offsetY} ${value.blur} ${value.spread} ${value.color}`;
};

const strokeStyleConverter = (
    value: DesignToken.Values.StrokeStyle,
): string => {
    // CSS doesn't support customizing dashed borders at the time of authoring.
    return typeof value === "string" ? value : "dashed";
};

const transitionConverter = (value: DesignToken.Values.Transition): string => {
    return `${value.duration} ${value.delay} ${value.timingFunction}`;
};

const TokenConverters = {
    [DesignToken.Type.Border]: borderConverter,
    [DesignToken.Type.CubicBezier]: joiner,
    [DesignToken.Type.FontFamily]: fontFamilyConverter,
    [DesignToken.Type.Gradient]: gradientConverter,
    [DesignToken.Type.Shadow]: shadowConverter,
    [DesignToken.Type.StrokeStyle]: strokeStyleConverter,
    [DesignToken.Type.Transition]: transitionConverter,
};
