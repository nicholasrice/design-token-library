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
            P2y: Values.Number,
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
     * The single source of truth mapping each {@link DesignToken.Type} to its
     * token interface and value type. Every mapper below is derived from this
     * registry, so a type is added in exactly one place.
     *
     * @remarks
     * This is the extension point for custom (non-DTCG) token types. It is an
     * `interface` so a consumer can register a type through declaration
     * merging, without editing this library:
     *
     * ```ts
     * interface FontStyleToken {
     *   $type?: "fontStyle";
     *   $description?: string;
     *   $extensions?: Record<string, any>;
     *   $deprecated?: boolean | string;
     *   $value: "regular" | "italic";
     * }
     *
     * declare module "design-token-library" {
     *   namespace DesignToken {
     *     interface TypeDefinitions {
     *       fontStyle: { value: FontStyleToken["value"]; token: FontStyleToken };
     *     }
     *   }
     * }
     * ```
     *
     * The key is the string used as the token's `type`. Declare the token
     * interface directly: {@link DesignToken.Properties} stays constrained to
     * the DTCG types. Give the token a distinct `type` literal so tokens remain
     * distinguishable from one another.
     *
     * Looking up a token type from a *value* (used for aliases nested inside
     * composite values) finds the registered types whose value type can hold it
     * and keeps the narrowest, so a color maps to `Color` rather than
     * `FontFamily`. Registered custom types take part automatically.
     *
     * @public
     */
    export interface TypeDefinitions {
        [Type.Border]: { value: Values.Border; token: Border };
        [Type.Color]: { value: Values.Color; token: Color };
        [Type.CubicBezier]: { value: Values.CubicBezier; token: CubicBezier };
        [Type.Dimension]: { value: Values.Dimension; token: Dimension };
        [Type.Duration]: { value: Values.Duration; token: Duration };
        [Type.FontFamily]: { value: Values.FontFamily; token: FontFamily };
        [Type.FontWeight]: { value: Values.FontWeight; token: FontWeight };
        [Type.Gradient]: { value: Values.Gradient; token: Gradient };
        [Type.Number]: { value: Values.Number; token: Number };
        [Type.Shadow]: { value: Values.Shadow; token: Shadow };
        [Type.StrokeStyle]: { value: Values.StrokeStyle; token: StrokeStyle };
        [Type.Transition]: { value: Values.Transition; token: Transition };
        [Type.Typography]: { value: Values.Typography; token: Typography };
    }

    /**
     * The registered types whose value type can hold `V`.
     *
     * Value types overlap (every `Color` is also a `FontFamily`), so more than
     * one type usually matches. `V` is wrapped so a union such as `FontWeight`
     * is matched as a whole instead of member by member.
     */
    type HoldsValue<V> = {
        [K in keyof TypeDefinitions]: [V] extends [TypeDefinitions[K]["value"]]
            ? K
            : never;
    }[keyof TypeDefinitions];

    /**
     * The types in `All` that hold a value type no other type in `All` holds
     * more narrowly: `Color` over `FontFamily` for a color, `Number` over
     * `FontWeight` for a number. Independent of declaration order.
     */
    type Narrowest<
        All extends keyof TypeDefinitions,
        K extends keyof TypeDefinitions = All,
    > = K extends any
        ? [StrictlyNarrower<K, All>] extends [never]
            ? K
            : never
        : never;

    /**
     * The types in `All` whose value type is strictly narrower than that of `K`.
     */
    type StrictlyNarrower<
        K extends keyof TypeDefinitions,
        All extends keyof TypeDefinitions,
    > = All extends any
        ? [TypeDefinitions[All]["value"]] extends [TypeDefinitions[K]["value"]]
            ? [TypeDefinitions[K]["value"]] extends [
                  TypeDefinitions[All]["value"],
              ]
                ? never
                : All
            : never
        : never;

    /**
     * @internal
     */
    export type TypeByToken<T extends DesignToken.Any> = T extends any
        ? {
              [K in keyof TypeDefinitions]: T extends TypeDefinitions[K]["token"]
                  ? K
                  : never;
          }[keyof TypeDefinitions]
        : never;

    /**
     * @internal
     */
    export type TokenByValue<V> = TypeDefinitions[Narrowest<
        HoldsValue<V>
    >]["token"];

    /**
     * @internal
     */
    export type ValueByToken<T extends DesignToken.Any> = T extends any
        ? {
              [K in keyof TypeDefinitions]: T extends TypeDefinitions[K]["token"]
                  ? TypeDefinitions[K]["value"]
                  : never;
          }[keyof TypeDefinitions]
        : never;

    /**
     * All properties supported by a DesignToken
     */
    export interface Properties<
        Type extends DesignToken.Type,
        Value extends DesignToken.Values.Any,
    > {
        $description?: string;
        $type?: Type;
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
     * A group of DesignTokens.
     */
    export type Group = {
        /**
         * If the group has a type, the type is inferred for all descendent design tokens,
         * unless specified by the token.
         */
        $type?: keyof DesignToken.TypeDefinitions;
        $description?: string;
        $extensions?: Record<string, any>;
        $deprecated?: boolean | string;
    };

    /**
     * @internal
     */
    export type Any = TypeDefinitions[keyof TypeDefinitions]["token"];
}
