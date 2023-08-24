export namespace DesignToken {
  export type Type =
    | "border"
    | "color"
    | "cubicBezier"
    | "dimension"
    | "duration"
    | "fontFamily"
    | "fontWeight"
    | "gradient"
    | "number"
    | "shadow"
    | "strokeStyle"
    | "transition"
    | "typography";

  /**
   * An implementation of {@link https://tr.designtokens.org/}
   */
  export namespace Types {
    /**
     * @see {@link https://tr.designtokens.org/format/#types}
     */

    /**
     * A six or 8 digit hexadecimal string.
     *
     * @see {@link https://tr.designtokens.org/format/#color}
     *
     * @remarks
     * Ideally we would be able to enumerate a-zA-Z1-9 * 6 | 8 chars
     * and narrow this type, however TypeScript cannot handle that
     * many type union combinations and will fail to compile. This
     * is the best representation of a 6 or 8 digit hex char that
     * can be accomplished
     *
     */
    export type Color = `#${string}`;

    /**
     * A dimension value (floating or integer) with a 'px' or 'rm' unit.
     *
     * @see {@link https://tr.designtokens.org/format/#dimension}
     */
    export type Dimension = `${Types.Number}px` | `${Types.Number}rm`;

    /**
     * The name of the font family;
     *
     * @see {@link https://tr.designtokens.org/format/#font-family}
     */
    export type FontFamily = string | string[];

    /**
     * @see {@link https://tr.designtokens.org/format/#number}
     */
    export type Number = number;

    /**
     * A number between 0 and 1000, or a font-weight keyword.
     *
     * @see {@link https://tr.designtokens.org/format/#font-weight}
     */
    export type FontWeight =
      | Types.Number
      | "thin"
      | "hairline"
      | "extra-light"
      | "ultra-light"
      | "light"
      | "normal"
      | "regular"
      | "book"
      | "medium"
      | "smi-bold"
      | "demi-bold"
      | "bold"
      | "extra-bold"
      | "ultra-bold"
      | "black"
      | "heavy"
      | "extra-black"
      | "ultra-black";
    /**
     * A duration value in milliseconds
     *
     * @see {@link https://tr.designtokens.org/format/#duration}
     */
    export type Duration = `${Types.Number}ms`;

    /**
     * Cubic Bézier coordinates.
     *
     * @see {@link https://tr.designtokens.org/format/#cubic-bezier}
     */
    export type CubicBezier = [
      P1x: Types.Number,
      P1y: Types.Number,
      P2x: Types.Number,
      P2y: Types.Number
    ];

    /**
     * @see {@link https://tr.designtokens.org/format/#shadow}
     */
    export interface Shadow {
      color: Types.Color;
      offsetX: Types.Dimension;
      offsetY: Types.Dimension;
      blur: Types.Dimension;
      spread: Types.Dimension;
    }
    /**
     *
     * @see {@link https://tr.designtokens.org/format/#stroke-style}
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
          dashArray: Types.Dimension[];
          lineCap: "round" | "butt" | "square";
        };

    /**
     * @see {@link https://tr.designtokens.org/format/#border}
     */
    export interface Border {
      color: Types.Color;
      width: Types.Dimension;
      style: Types.StrokeStyle;
    }

    /**
     * @see {@link https://tr.designtokens.org/format/#transition}
     */
    export interface Transition {
      duration: Types.Duration;
      delay: Types.Duration;
      timingFunction: Types.CubicBezier;
    }

    /**
     * Position values must be a number withing [0, 1].
     * @see {@link https://tr.designtokens.org/format/#gradient}
     */
    export type Gradient = Array<{
      color: Types.Color;
      position: Types.Number;
    }>;

    /**
     * @see {@link https://tr.designtokens.org/format/#typography}
     */
    export interface Typography {
      fontFamily: Types.FontFamily;
      fontSize: Types.Dimension;
      fontWeight: Types.FontWeight;
      letterSpacing: Types.Dimension;
      lineHeight: Types.Number;
    }
  }

  interface OptionalProperties {
    description?: string;
    type?: DesignToken.Type;
    extensions?: Record<string, any>;
  }

  interface TypedTokenProperties<Value, Type extends DesignToken.Type>
    extends OptionalProperties {
    value: Value;
    type?: Type;
  }

  export namespace TokenProperties {
    export type Color = TypedTokenProperties<DesignToken.Types.Color, "color">;
    export type Dimension = TypedTokenProperties<
      DesignToken.Types.Dimension,
      "dimension"
    >;
    export type FontFamily = TypedTokenProperties<
      DesignToken.Types.FontFamily,
      "fontFamily"
    >;
    export type FontWeight = TypedTokenProperties<
      DesignToken.Types.FontWeight,
      "fontWeight"
    >;
    export type Number = TypedTokenProperties<
      DesignToken.Types.Number,
      "number"
    >;
    export type Duration = TypedTokenProperties<
      DesignToken.Types.Duration,
      "duration"
    >;
    export type CubicBezier = TypedTokenProperties<
      DesignToken.Types.CubicBezier,
      "cubicBezier"
    >;
    export type StrokeStyle = TypedTokenProperties<
      DesignToken.Types.StrokeStyle,
      "strokeStyle"
    >;
    export type Border = TypedTokenProperties<
      DesignToken.Types.Border,
      "border"
    >;

    export type Transition = TypedTokenProperties<
      DesignToken.Types.Transition,
      "transition"
    >;
    export type Gradient = TypedTokenProperties<
      DesignToken.Types.Gradient,
      "gradient"
    >;
    export type Typography = TypedTokenProperties<
      DesignToken.Types.Typography,
      "typography"
    >;

    export type Any =
      | DesignToken.TokenProperties.Border
      | DesignToken.TokenProperties.Color
      | DesignToken.TokenProperties.CubicBezier
      | DesignToken.TokenProperties.Dimension
      | DesignToken.TokenProperties.Duration
      | DesignToken.TokenProperties.FontFamily
      | DesignToken.TokenProperties.FontWeight
      | DesignToken.TokenProperties.Gradient
      | DesignToken.TokenProperties.Number
      | DesignToken.TokenProperties.StrokeStyle
      | DesignToken.TokenProperties.Transition
      | DesignToken.TokenProperties.Typography;
  }

  export type TokenPropertiesByTokenType<T extends DesignToken.Type | "any"> =
    T extends "any"
      ? DesignToken.TokenProperties.Any
      : T extends "border"
      ? DesignToken.TokenProperties.Border
      : T extends "color"
      ? DesignToken.TokenProperties.Color
      : T extends "cubiceBezier"
      ? DesignToken.TokenProperties.CubicBezier
      : T extends "dimension"
      ? DesignToken.TokenProperties.Dimension
      : T extends "duration"
      ? DesignToken.TokenProperties.Duration
      : T extends "fontFamily"
      ? DesignToken.TokenProperties.FontFamily
      : T extends "fontWeight"
      ? DesignToken.TokenProperties.FontWeight
      : T extends "gradient"
      ? DesignToken.TokenProperties.Gradient
      : T extends "number"
      ? DesignToken.TokenProperties.Number
      : T extends "strokeStyle"
      ? DesignToken.TokenProperties.StrokeStyle
      : T extends "transition"
      ? DesignToken.TokenProperties.Transition
      : T extends "typography"
      ? DesignToken.TokenProperties.Typography
      : never;

  export interface Group<T extends DesignToken.Type | "any" = "any">
    extends Record<string, Group<T> | TokenPropertiesByTokenType<T>> {}
}

/**
 *
 * TODO:
 * 1. @see {@link https://tr.designtokens.org/format/#additional-types}
 * 2. How will token aliases be represented
 * 3. Do we need StrokeStyle type? How does this reflect to CSS?
 * 4. Can we make this flexible to work outside parts of the token system that aren't specced?
 */

const group: DesignToken.Group<"any"> = {
  someToken: {
    value: "#FFFFFFF",
    type: "color",
  },

  someGroup: {
    someToken: {
      value: "#ffff",
      type: "color",
    },
    someOtherGroup: {
      anotherNestedGroup: {
        value: "2px",
        type: "dimension",
        description: "foobar",
      },
    },
  },
};
