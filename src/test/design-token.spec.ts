import { suite } from "uvu";
import * as Assert from "uvu/assert";
import { DesignToken } from "../lib/design-token.js";
import { Library } from "../lib/library.js";
import type {
    BadgeToken,
    BooleanToken,
    FontStyleToken,
    FontStyleValue,
} from "./my-design-system/custom-types.js";

/**
 * Compile-time assertions for the registry-derived type mappers, in particular
 * the value-keyed mappers, whose value types overlap structurally (a color is
 * also a string, a number is also a font weight) and must resolve to the
 * narrowest matching token. If any of these regress, `tsc -b` fails.
 */
type Equal<A, B> =
    (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
        ? true
        : false;

type Expect<T extends true> = T;

// Token-keyed mappers.
export type _TypeByToken = Expect<
    Equal<DesignToken.TypeByToken<DesignToken.Color>, DesignToken.Type.Color>
>;
export type _ValueByToken = Expect<
    Equal<DesignToken.ValueByToken<DesignToken.Color>, DesignToken.Values.Color>
>;

// Value-keyed mappers: the structural-overlap risk area. Each resolves to the
// narrowest token type that can hold the value, regardless of declaration order.
type Typography = DesignToken.Values.Typography;
type Border = DesignToken.Values.Border;

// Color ⊆ string ⊆ FontFamily: Color, not Color | FontFamily.
export type _ColorNotFontFamily = Expect<
    Equal<DesignToken.TokenByValue<DesignToken.Values.Color>, DesignToken.Color>
>;
// Dimension template literal: Dimension, not FontFamily.
export type _DimensionNotFontFamily = Expect<
    Equal<
        DesignToken.TokenByValue<DesignToken.Values.Dimension>,
        DesignToken.Dimension
    >
>;
// number ⊆ FontWeight: Number is narrower, so a number field takes a Number token.
export type _NumberIsNumber = Expect<
    Equal<DesignToken.TokenByValue<number>, DesignToken.Number>
>;
export type _LineHeightIsNumber = Expect<
    Equal<
        DesignToken.TokenByValue<Typography["lineHeight"]>,
        DesignToken.Number
    >
>;
// A union value is matched as a whole, not member by member.
export type _FontWeightIsFontWeight = Expect<
    Equal<
        DesignToken.TokenByValue<Typography["fontWeight"]>,
        DesignToken.FontWeight
    >
>;
export type _BorderStyleIsStrokeStyle = Expect<
    Equal<DesignToken.TokenByValue<Border["style"]>, DesignToken.StrokeStyle>
>;
// A plain string (e.g. an entry in a font stack) can hold only a FontFamily.
export type _StringIsFontFamily = Expect<
    Equal<DesignToken.TokenByValue<string>, DesignToken.FontFamily>
>;

// Custom types registered through DesignToken.TypeDefinitions resolve through
// the same mappers as the DTCG types.
export type _CustomTypeByToken = Expect<
    Equal<DesignToken.TypeByToken<FontStyleToken>, "fontStyle">
>;
export type _CustomValueByToken = Expect<
    Equal<DesignToken.ValueByToken<FontStyleToken>, FontStyleValue>
>;
// Custom types take part in value lookups without being listed anywhere.
export type _CustomByValue = Expect<
    Equal<DesignToken.TokenByValue<FontStyleValue>, FontStyleToken>
>;
export type _CustomBooleanByValue = Expect<
    Equal<DesignToken.TokenByValue<boolean>, BooleanToken>
>;
export type _CustomIsAny = Expect<
    Equal<FontStyleToken extends DesignToken.Any ? true : false, true>
>;
// A custom token must not be mistaken for a DTCG token, or the reverse.
export type _CustomDoesNotShadowCore = Expect<
    Equal<DesignToken.TypeByToken<DesignToken.Color>, DesignToken.Type.Color>
>;

const Types = suite("DesignToken.types");
const CustomTypes = suite("DesignToken.customTypes");

Types("registry-derived mappers match the original ladders", () => {
    // The assertions above are compile-time; this keeps uvu's runner happy.
    Assert.ok(true);
});

CustomTypes("custom token types are typed, aliasable and reactive", () => {
    interface Theme {
        italic: BooleanToken;
        style: FontStyleToken;
    }
    const library = Library.create<Theme>({
        italic: { $type: "boolean", $value: true },
        style: {
            $type: "fontStyle",
            $value: (theme) => (theme.italic.$value ? "italic" : "regular"),
        },
    });
    // These assignments are checked at compile time as well.
    const type: "fontStyle" = library.tokens.style.$type;
    const italic: boolean = library.tokens.italic.$value;

    Assert.is(type, "fontStyle");
    Assert.is(italic, true);
    Assert.is(library.tokens.style.$value, "italic");

    library.tokens.italic.set(false);
    Assert.is(library.tokens.style.$value, "regular");
});

CustomTypes(
    "a composite custom value can mix literal and aliased fields",
    () => {
        interface Theme {
            accent: DesignToken.Color;
            badge: BadgeToken;
        }
        const library = Library.create<Theme>({
            accent: { $type: DesignToken.Type.Color, $value: "#FFFFFF" },
            badge: {
                $type: "badge",
                // `visible` is not a DTCG value; `color` is, so it can alias.
                $value: { visible: true, color: (theme) => theme.accent },
            },
        });

        Assert.equal(library.tokens.badge.$value, {
            visible: true,
            color: "#FFFFFF",
        });

        library.tokens.accent.set("#000000");
        Assert.equal(library.tokens.badge.$value, {
            visible: true,
            color: "#000000",
        });
    },
);

CustomTypes("a group can declare a custom type for its tokens", () => {
    interface Theme {
        $type: "fontStyle";
        heading: FontStyleToken;
    }
    const library = Library.create<Theme>({
        $type: "fontStyle",
        heading: { $value: "italic" },
    });

    Assert.is(library.tokens.heading.$type, "fontStyle");
});

Types.run();
CustomTypes.run();
