/**
 * @public
 */
export namespace DesignToken {
  /**
   * An enumeration of all supported types defined
   * by {@link https://tr.designtokens.org/format/#types}
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
    export type Dimension = `${Values.Number}px` | `${Values.Number}rm`;

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
    export type Duration = `${Values.Number}ms`;

    /**
     * Cubic Bézier coordinates.
     *
     * @see {@link https://tr.designtokens.org/format/#cubic-bezier}
     */
    export type CubicBezier = [
      P1x: Values.Number,
      P1y: Values.Number,
      P2x: Values.Number,
      P2y: Values.Number
    ];

    /**
     * @see {@link https://tr.designtokens.org/format/#shadow}
     */
    export interface Shadow {
      color: Values.Color;
      offsetX: Values.Dimension;
      offsetY: Values.Dimension;
      blur: Values.Dimension;
      spread: Values.Dimension;
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
          dashArray: Values.Dimension[];
          lineCap: "round" | "butt" | "square";
        };

    /**
     * @see {@link https://tr.designtokens.org/format/#border}
     */
    export interface Border {
      color: Values.Color;
      width: Values.Dimension;
      style: Values.StrokeStyle;
    }

    /**
     * @see {@link https://tr.designtokens.org/format/#transition}
     */
    export interface Transition {
      duration: Values.Duration;
      delay: Values.Duration;
      timingFunction: Values.CubicBezier;
    }

    /**
     * @see {@link https://tr.designtokens.org/format/#gradient}
     * @remarks
     * Position values must be a number withing [0, 1].
     */
    export type Gradient = Array<{
      color: Values.Color;
      position: Values.Number;
    }>;

    /**
     * @see {@link https://tr.designtokens.org/format/#typography}
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
   * @internal
   */
  export type TokenByType<T extends DesignToken.Type> =
    T extends DesignToken.Type.Border
      ? DesignToken.Border
      : T extends DesignToken.Type.Color
      ? DesignToken.Color
      : T extends DesignToken.Type.CubicBezier
      ? DesignToken.CubicBezier
      : T extends DesignToken.Type.Dimension
      ? DesignToken.Dimension
      : T extends DesignToken.Type.Duration
      ? DesignToken.Duration
      : T extends DesignToken.Type.FontFamily
      ? DesignToken.FontFamily
      : T extends DesignToken.Type.FontWeight
      ? DesignToken.FontWeight
      : T extends DesignToken.Type.Gradient
      ? DesignToken.Gradient
      : T extends DesignToken.Type.Number
      ? DesignToken.Number
      : T extends DesignToken.Type.Shadow
      ? DesignToken.Shadow
      : T extends DesignToken.Type.StrokeStyle
      ? DesignToken.StrokeStyle
      : T extends DesignToken.Type.Transition
      ? DesignToken.Transition
      : T extends DesignToken.Type.Typography
      ? DesignToken.Typography
      : never;

  /**
   * @internal
   */
  export type TypeByToken<T extends DesignToken.Any> =
    T extends DesignToken.Border
      ? DesignToken.Type.Border
      : T extends DesignToken.Color
      ? DesignToken.Type.Color
      : T extends DesignToken.CubicBezier
      ? DesignToken.Type.CubicBezier
      : T extends DesignToken.Dimension
      ? DesignToken.Type.Dimension
      : T extends DesignToken.Duration
      ? DesignToken.Type.Duration
      : T extends DesignToken.FontFamily
      ? DesignToken.Type.FontFamily
      : T extends DesignToken.FontWeight
      ? DesignToken.Type.FontWeight
      : T extends DesignToken.Gradient
      ? DesignToken.Type.Gradient
      : T extends DesignToken.Number
      ? DesignToken.Type.Number
      : T extends DesignToken.Shadow
      ? DesignToken.Type.Shadow
      : T extends DesignToken.StrokeStyle
      ? DesignToken.Type.StrokeStyle
      : T extends DesignToken.Transition
      ? DesignToken.Type.Transition
      : T extends DesignToken.Typography
      ? DesignToken.Type.Typography
      : never;

  /**
   * @internal
   */
  export type TokenByValue<T> = T extends DesignToken.Values.Border
    ? DesignToken.Border
    : T extends DesignToken.Values.Color
    ? DesignToken.Color
    : T extends DesignToken.Values.CubicBezier
    ? DesignToken.CubicBezier
    : T extends DesignToken.Values.Dimension
    ? DesignToken.Dimension
    : T extends DesignToken.Values.Duration
    ? DesignToken.Duration
    : T extends DesignToken.Values.FontFamily
    ? DesignToken.FontFamily
    : T extends DesignToken.Values.FontWeight
    ? DesignToken.FontWeight
    : T extends DesignToken.Values.Gradient
    ? DesignToken.Gradient
    : T extends DesignToken.Values.Number
    ? DesignToken.Number
    : T extends DesignToken.Values.Shadow
    ? DesignToken.Shadow
    : T extends DesignToken.Values.StrokeStyle
    ? DesignToken.StrokeStyle
    : T extends DesignToken.Values.Transition
    ? DesignToken.Transition
    : T extends DesignToken.Values.Typography
    ? DesignToken.Typography
    : never;

  /**
   * @internal
   */
  export type ValueByType<T> = T extends DesignToken.Values.Border
    ? DesignToken.Type.Border
    : T extends DesignToken.Values.Color
    ? DesignToken.Type.Color
    : T extends DesignToken.Values.CubicBezier
    ? DesignToken.Type.CubicBezier
    : T extends DesignToken.Values.Dimension
    ? DesignToken.Type.Dimension
    : T extends DesignToken.Values.Duration
    ? DesignToken.Type.Duration
    : T extends DesignToken.Values.FontFamily
    ? DesignToken.Type.FontFamily
    : T extends DesignToken.Values.FontWeight
    ? DesignToken.Type.FontWeight
    : T extends DesignToken.Values.Gradient
    ? DesignToken.Type.Gradient
    : T extends DesignToken.Values.Number
    ? DesignToken.Type.Number
    : T extends DesignToken.Values.Shadow
    ? DesignToken.Type.Shadow
    : T extends DesignToken.Values.StrokeStyle
    ? DesignToken.Type.StrokeStyle
    : T extends DesignToken.Values.Transition
    ? DesignToken.Type.Transition
    : T extends DesignToken.Values.Typography
    ? DesignToken.Type.Typography
    : never;

  /**
   * @internal
   */
  export type ValueByToken<T extends DesignToken.Any> =
    T extends DesignToken.Border
      ? DesignToken.Values.Border
      : T extends Color
      ? DesignToken.Values.Color
      : T extends DesignToken.CubicBezier
      ? DesignToken.Values.CubicBezier
      : T extends DesignToken.Dimension
      ? DesignToken.Values.Dimension
      : T extends DesignToken.Duration
      ? DesignToken.Values.Duration
      : T extends DesignToken.FontFamily
      ? DesignToken.Values.FontFamily
      : T extends DesignToken.FontWeight
      ? DesignToken.Values.FontWeight
      : T extends DesignToken.Gradient
      ? DesignToken.Values.Gradient
      : T extends DesignToken.Number
      ? DesignToken.Values.Number
      : T extends DesignToken.Shadow
      ? DesignToken.Values.Shadow
      : T extends DesignToken.StrokeStyle
      ? DesignToken.Values.StrokeStyle
      : T extends DesignToken.Transition
      ? DesignToken.Values.Transition
      : T extends Typography
      ? DesignToken.Values.Typography
      : never;

  /**
   * All properties supported by a DesignToken
   */
  export interface Properties<
    Type extends DesignToken.Type,
    Value extends DesignToken.Values.Any
  > {
    description?: string;
    type?: Type;
    extensions?: Record<string, any>;
    value: Value;
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
   * A group of DesignTokens.
   */
  export type Group = {
    /**
     * If the group has a type, the type is inferred for all descendent design tokens,
     * unless specified by the token.
     */
    type?: DesignToken.Type;
  };

  /**
   * @internal
   */
  export type Any =
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
}
