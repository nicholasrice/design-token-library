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
}

/**
 * TODO:
 * 1. @see {@link https://tr.designtokens.org/format/#additional-types}
 * 2. How will token aliases be represented
 * 3. Do we need StrokeStyle type? How does this reflect to CSS?
 * 4. Can we make this flexible to work outside parts of the token system that aren't specced?
 */
