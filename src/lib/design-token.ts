/**
 * @public
 */
export namespace DesignToken {
    /**
     * An enumeration of all supported types defined
     * by {@link https://www.designtokens.org/tr/2025.10/format/#types}
     */
    export enum Type {
        Border = "border",
        Color = "color",
        CubicBezier = "cubicBezier",
        Dimension = "dimension",
        Duration = "duration",
        FontFamily = "fontFamily",
        FontWeight = "fontWeight",
        Gradient = "gradient",
        Number = "number",
        Shadow = "shadow",
        StrokeStyle = "strokeStyle",
        Transition = "transition",
        Typography = "typography",
    }

    /**
     * The values supported for each {@link DesignToken.Type | DesignToken type}.
     */
    export namespace Values {
        /**
         * The color spaces of the {@link https://www.designtokens.org/tr/2025.10/color/ | Color module}.
         */
        export type ColorSpace =
            | "srgb"
            | "srgb-linear"
            | "hsl"
            | "hwb"
            | "lab"
            | "lch"
            | "oklab"
            | "oklch"
            | "display-p3"
            | "a98-rgb"
            | "prophoto-rgb"
            | "rec2020"
            | "xyz-d65"
            | "xyz-d50";

        /**
         * A color component: a number, or `"none"` for a missing component.
         */
        export type ColorComponent = Values.Number | "none";

        /**
         * A color in a color space. Every color space has three components,
         * whose ranges depend on the color space.
         *
         * @see {@link https://www.designtokens.org/tr/2025.10/color/}
         */
        export interface Color {
            colorSpace: ColorSpace;
            components: [ColorComponent, ColorComponent, ColorComponent];
            /**
             * From 0 (transparent) to 1 (opaque). Defaults to 1.
             */
            alpha?: Values.Number;
            /**
             * A fallback in six digit CSS hex notation.
             */
            hex?: `#${string}`;
        }

        /**
         * A number with a unit, which is required even when the number is 0.
         *
         * @see {@link https://www.designtokens.org/tr/2025.10/format/#dimension}
         */
        export interface Dimension {
            value: Values.Number;
            unit: "px" | "rem";
        }

        /**
         * The name of the font family, or an array of names in order of
         * preference.
         *
         * @see {@link https://www.designtokens.org/tr/2025.10/format/#font-family}
         */
        export type FontFamily = string | string[];

        /**
         * @see {@link https://www.designtokens.org/tr/2025.10/format/#number}
         */
        export type Number = number;

        /**
         * A number from 1 to 1000, or a font-weight keyword.
         *
         * @see {@link https://www.designtokens.org/tr/2025.10/format/#font-weight}
         */
        export type FontWeight =
            | Values.Number
            | "thin"
            | "hairline"
            | "extra-light"
            | "ultra-light"
            | "light"
            | "normal"
            | "regular"
            | "book"
            | "medium"
            | "semi-bold"
            | "demi-bold"
            | "bold"
            | "extra-bold"
            | "ultra-bold"
            | "black"
            | "heavy"
            | "extra-black"
            | "ultra-black";

        /**
         * A length of time in milliseconds or seconds.
         *
         * @see {@link https://www.designtokens.org/tr/2025.10/format/#duration}
         */
        export interface Duration {
            value: Values.Number;
            unit: "ms" | "s";
        }

        /**
         * Cubic Bézier coordinates. The x coordinates are within [0, 1].
         *
         * @see {@link https://www.designtokens.org/tr/2025.10/format/#cubic-bezier}
         */
        export type CubicBezier = [
            P1x: Values.Number,
            P1y: Values.Number,
            P2x: Values.Number,
            P2y: Values.Number,
        ];

        /**
         * One shadow.
         *
         * @see {@link https://www.designtokens.org/tr/2025.10/format/#shadow}
         */
        export interface ShadowLayer {
            color: Values.Color;
            offsetX: Values.Dimension;
            offsetY: Values.Dimension;
            blur: Values.Dimension;
            spread: Values.Dimension;
            /**
             * An inner shadow. Defaults to `false`.
             */
            inset?: boolean;
        }

        /**
         * One shadow, or several layered shadows.
         *
         * @see {@link https://www.designtokens.org/tr/2025.10/format/#shadow}
         */
        export type Shadow = ShadowLayer | ShadowLayer[];

        /**
         * @see {@link https://www.designtokens.org/tr/2025.10/format/#stroke-style}
         */
        export type StrokeStyle =
            | "solid"
            | "dashed"
            | "dotted"
            | "double"
            | "groove"
            | "ridge"
            | "outset"
            | "inset"
            | {
                  dashArray: Values.Dimension[];
                  lineCap: "round" | "butt" | "square";
              };

        /**
         * @see {@link https://www.designtokens.org/tr/2025.10/format/#border}
         */
        export interface Border {
            color: Values.Color;
            width: Values.Dimension;
            style: Values.StrokeStyle;
        }

        /**
         * @see {@link https://www.designtokens.org/tr/2025.10/format/#transition}
         */
        export interface Transition {
            duration: Values.Duration;
            delay: Values.Duration;
            timingFunction: Values.CubicBezier;
        }

        /**
         * @see {@link https://www.designtokens.org/tr/2025.10/format/#gradient}
         * @remarks
         * Position values must be a number within [0, 1].
         */
        export type Gradient = Array<{
            color: Values.Color;
            position: Values.Number;
        }>;

        /**
         * @see {@link https://www.designtokens.org/tr/2025.10/format/#typography}
         */
        export interface Typography {
            fontFamily: Values.FontFamily;
            fontSize: Values.Dimension;
            fontWeight: Values.FontWeight;
            letterSpacing: Values.Dimension;
            lineHeight: Values.Number;
        }

        /**
         * @internal
         */
        export type Any =
            | Color
            | Dimension
            | FontFamily
            | Number
            | FontWeight
            | Duration
            | CubicBezier
            | Shadow
            | StrokeStyle
            | Border
            | Transition
            | Gradient
            | Typography;
    }

    /**
     * The value of a token.
     *
     * @internal
     */
    export type ValueByToken<T extends DesignToken.Shape> = T["$value"];

    /**
     * The type of a token. Tokens that don't declare a `$type` resolve to
     * the type inherited from their ancestor groups, `G`.
     *
     * @internal
     */
    export type TypeByToken<
        T extends DesignToken.Shape,
        G extends string = never,
    > = "$type" extends keyof T ? NonNullable<T["$type"]> : G;

    /**
     * The structural shape of any token: an object with a `$value`.
     * This mirrors how tokens are distinguished from groups at runtime.
     *
     * @internal
     */
    export interface Shape {
        $description?: string;
        $type?: string;
        $extensions?: Record<string, any>;
        $deprecated?: boolean | string;
        $value: unknown;
    }

    /**
     * All properties supported by a DesignToken
     */
    export interface Properties<
        Type extends DesignToken.Type,
        Value extends DesignToken.Values.Any,
    > {
        $description?: string;
        /**
         * The token's type. In a {@link (Library:namespace).Config}, it may be omitted
         * when it's inherited from an ancestor group.
         */
        $type: Type;
        $extensions?: Record<string, any>;
        /**
         * `true`, or a string explaining why, when the token is deprecated.
         */
        $deprecated?: boolean | string;
        $value: Value;
    }

    export type Border = Properties<
        DesignToken.Type.Border,
        DesignToken.Values.Border
    >;
    export type Color = Properties<
        DesignToken.Type.Color,
        DesignToken.Values.Color
    >;
    export type CubicBezier = Properties<
        DesignToken.Type.CubicBezier,
        DesignToken.Values.CubicBezier
    >;
    export type Dimension = Properties<
        DesignToken.Type.Dimension,
        DesignToken.Values.Dimension
    >;
    export type Duration = Properties<
        DesignToken.Type.Duration,
        DesignToken.Values.Duration
    >;
    export type FontFamily = Properties<
        DesignToken.Type.FontFamily,
        DesignToken.Values.FontFamily
    >;
    export type FontWeight = Properties<
        DesignToken.Type.FontWeight,
        DesignToken.Values.FontWeight
    >;
    export type Gradient = Properties<
        DesignToken.Type.Gradient,
        DesignToken.Values.Gradient
    >;
    export type Number = Properties<
        DesignToken.Type.Number,
        DesignToken.Values.Number
    >;
    export type Shadow = Properties<
        DesignToken.Type.Shadow,
        DesignToken.Values.Shadow
    >;

    export type StrokeStyle = Properties<
        DesignToken.Type.StrokeStyle,
        DesignToken.Values.StrokeStyle
    >;

    export type Transition = Properties<
        DesignToken.Type.Transition,
        DesignToken.Values.Transition
    >;
    export type Typography = Properties<
        DesignToken.Type.Typography,
        DesignToken.Values.Typography
    >;

    /**
     * Type names reserved by {@link https://www.designtokens.org/tr/2025.10/format/#types}.
     * Custom types cannot use these names.
     */
    export type ReservedTypeName = `${DesignToken.Type}`;

    /**
     * Resolves to `true` if `V` is, or contains, a function.
     *
     * @internal
     */
    export type HasFunction<V> = V extends Function
        ? true
        : V extends object
          ? true extends { [K in keyof V]-?: HasFunction<V[K]> }[keyof V]
              ? true
              : false
          : false;

    /**
     * The `$type` of a {@link DesignToken.Custom} token. Resolves to an error
     * message type when `Name` is reserved or `Value` is not serializable, so
     * that invalid custom tokens cannot be configured.
     *
     * @internal
     */
    export type CustomTypeName<
        Name extends string,
        Value,
    > = Name extends ReservedTypeName
        ? `Error: '${Name}' is a reserved DTCG type name`
        : HasFunction<Value> extends true
          ? "Error: custom token values must be serializable and cannot contain functions"
          : Name;

    /**
     * A token of a custom type that is not defined by
     * {@link https://www.designtokens.org/tr/2025.10/format/#types}.
     *
     * @remarks
     * `Name` identifies the type and must not be a {@link DesignToken.ReservedTypeName}.
     * `Value` can be any serializable (JSON-like) value. Functions are not allowed
     * because function values are evaluated as aliases.
     *
     * @example
     * ```ts
     * interface Elevation { level: number; shadow: DesignToken.Values.Shadow }
     * type ElevationToken = DesignToken.Custom<"elevation", Elevation>;
     * ```
     */
    export interface Custom<Name extends string, Value> {
        $description?: string;
        $type: CustomTypeName<Name, Value>;
        $extensions?: Record<string, any>;
        $deprecated?: boolean | string;
        $value: Value;
    }

    /**
     * The structural base of all {@link DesignToken.Custom} tokens.
     *
     * @internal
     */
    export interface AnyCustom {
        $description?: string;
        $type: string;
        $extensions?: Record<string, any>;
        $deprecated?: boolean | string;
        $value: unknown;
    }

    /**
     * A group of DesignTokens.
     */
    export type Group = {
        /**
         * If the group has a type, the type is inferred for all descendent design tokens,
         * unless specified by the token.
         */
        $type?: string;
        $description?: string;
        $extensions?: Record<string, any>;
        $deprecated?: boolean | string;
    };

    /**
     * All tokens of a type defined by {@link https://www.designtokens.org/tr/2025.10/format/#types}.
     *
     * @internal
     */
    export type Standard =
        | Border
        | Color
        | CubicBezier
        | Dimension
        | Duration
        | FontFamily
        | FontWeight
        | Gradient
        | Number
        | Shadow
        | StrokeStyle
        | Transition
        | Typography;

    /**
     * @internal
     */
    export type Any = Standard | AnyCustom;
}
