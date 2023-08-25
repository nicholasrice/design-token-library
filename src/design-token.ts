export namespace DesignToken {
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
   * An implementation of {@link https://tr.designtokens.org/}
   */
  export namespace Values {
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
     * Position values must be a number withing [0, 1].
     * @see {@link https://tr.designtokens.org/format/#gradient}
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

  interface OptionalProperties {
    description?: string;
    type?: DesignToken.Type;
    extensions?: Record<string, any>;
  }

  type TokenByType<T extends DesignToken.Type> =
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
  type TokenByValue<T> = T extends DesignToken.Values.Border
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
  export type Alias<T, K extends DesignToken.Any> = (root: T) => K;
  export type DeepAlias<T, V extends DesignToken.Values.Any> = V extends {}
    ? { [K in keyof V]: V[K] | ((theme: T) => TokenByValue<V[K]>) }
    : never;

  interface TypedTokenProperties<
    Type extends DesignToken.Type,
    Value extends DesignToken.Values.Any,
    Theme = any
  > extends OptionalProperties {
    value: Value | DeepAlias<Theme, Value> | Alias<Theme, TokenByType<Type>>;
    type?: Type;
  }

  export type Border<Theme extends {} = any> = TypedTokenProperties<
    DesignToken.Type.Border,
    DesignToken.Values.Border,
    Theme
  >;
  export type Color<Theme extends {} = any> = TypedTokenProperties<
    DesignToken.Type.Color,
    DesignToken.Values.Color,
    Theme
  >;
  export type CubicBezier<Theme extends {} = any> = TypedTokenProperties<
    DesignToken.Type.CubicBezier,
    DesignToken.Values.CubicBezier,
    Theme
  >;
  export type Dimension<Theme extends {} = any> = TypedTokenProperties<
    DesignToken.Type.Dimension,
    DesignToken.Values.Dimension,
    Theme
  >;
  export type Duration<Theme extends {} = any> = TypedTokenProperties<
    DesignToken.Type.Duration,
    DesignToken.Values.Duration,
    Theme
  >;
  export type FontFamily<Theme extends {} = any> = TypedTokenProperties<
    DesignToken.Type.FontFamily,
    DesignToken.Values.FontFamily,
    Theme
  >;
  export type FontWeight<Theme extends {} = any> = TypedTokenProperties<
    DesignToken.Type.FontWeight,
    DesignToken.Values.FontWeight,
    Theme
  >;
  export type Gradient<Theme extends {} = any> = TypedTokenProperties<
    DesignToken.Type.Gradient,
    DesignToken.Values.Gradient,
    Theme
  >;
  export type Number<Theme extends {} = any> = TypedTokenProperties<
    DesignToken.Type.Number,
    DesignToken.Values.Number,
    Theme
  >;
  export type Shadow<Theme extends {} = any> = TypedTokenProperties<
    DesignToken.Type.Shadow,
    DesignToken.Values.Shadow,
    Theme
  >;

  export type StrokeStyle<Theme extends {} = any> = TypedTokenProperties<
    DesignToken.Type.StrokeStyle,
    DesignToken.Values.StrokeStyle,
    Theme
  >;

  export type Transition<Theme extends {} = any> = TypedTokenProperties<
    DesignToken.Type.Transition,
    DesignToken.Values.Transition,
    Theme
  >;
  export type Typography<Theme extends {} = any> = TypedTokenProperties<
    DesignToken.Type.Typography,
    DesignToken.Values.Typography,
    Theme
  >;

  export type Group = {
    type?: DesignToken.Type;
  };
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
 * Consumers should define a token library type that is a big nested object that conforms to the appropriate structure.
 * We can expose a DesignTokenLibrary<T> type that validates structure of a provided generic.
 *
 * Question:
 * How do we enable alias tokens?
 * How do we enable function values that serve as alias?
 */
export type DesignTokenLibrary<T extends {}, R extends {} = T> = {
  [K in keyof T]: T[K] extends DesignToken.Any
    ? T[K]
    : K extends "type"
    ? DesignToken.Type
    : T[K] extends {}
    ? DesignTokenLibrary<T[K], R>
    : never;
};

/**
 * Tests an object w/ only a value property
 */
interface NoTypeGroup {
  tokenName: DesignToken.Border;
}
const NoTypeGroup: DesignTokenLibrary<NoTypeGroup> = {
  tokenName: {
    type: DesignToken.Type.Border,
    value: {
      color: "#FFFFFF",
      style: "solid",
      width: "2px",
    },
  },
};

/**
 * Test
 */
interface TypeGroup {
  type: DesignToken.Type.Border;
  tokenName: DesignToken.Border<TypeGroup>;
}
const TypeGroup: DesignTokenLibrary<TypeGroup> = {
  type: DesignToken.Type.Border,
  tokenName: {
    value: {
      color: "#FFFFFF",
      style: "solid",
      width: "2px",
    },
  },
};

interface NestedTypeGroup {
  groupName: TypeGroup;
  typedGroup: TypeGroup;
}
const NestedTypeGroup: DesignTokenLibrary<NestedTypeGroup> = {
  groupName: {
    type: DesignToken.Type.Border,
    tokenName: {
      type: DesignToken.Type.Border,
      description: "foobar",
      value: {
        color: "#FFFFFF",
        style: "solid",
        width: "2px",
      },
    },
  },
  typedGroup: {
    type: DesignToken.Type.Border,
    tokenName: {
      value: {
        color: "#FFF",
        style: "solid",
        width: "2px",
      },
    },
  },
};
