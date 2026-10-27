/**
 * Type-level tests for custom token types. These are enforced by `tsc -b`:
 * a failing `Expect`, a `@ts-expect-error` that no longer errors, or a valid
 * assignment that errors fails the build.
 *
 * Negative cases are wrapped in functions that are never called, so that
 * invalid configs don't throw when this module is loaded.
 */
import { suite } from "uvu";
import * as Assert from "uvu/assert";
import {
    CSSConverters,
    CSSPropertiesLibrary,
    convert,
    toCSS,
    toProperties,
} from "../lib/css-reflector.js";
import { refs } from "../lib/ref.js";
import { DesignToken } from "../lib/design-token.js";
import { Library } from "../lib/library.js";
import {
    CustomTheme,
    Elevation,
    ElevationToken,
    LabelToken,
    Nested,
    RatioToken,
    customConfig,
} from "./custom-types.fixtures.js";
import { Equal, Expect, IsKnown } from "./helpers.js";
import { hex, px } from "./values.js";

const Types = suite("Custom token types: type-level API");

const C = DesignToken.Type.Color;
const library = Library.create(customConfig());
type Tokens = typeof library.tokens;

/* Value and type resolution */
type Resolution = [
    // Object values
    Expect<
        Equal<
            Tokens["elevation"]["low"]["$value"],
            DesignToken.DeepReadonly<Elevation>
        >
    >,
    // Primitive values
    Expect<Equal<Tokens["ratio"]["$value"], number>>,
    Expect<Equal<Tokens["label"]["$value"], string>>,
    Expect<Equal<Tokens["flag"]["$value"], boolean>>,
    // Array, nested object and tuple values
    Expect<Equal<Tokens["steps"]["$value"], readonly number[]>>,
    Expect<Equal<Tokens["nested"]["$value"], DesignToken.DeepReadonly<Nested>>>,
    Expect<
        Equal<
            Tokens["elevation"]["low"]["$value"]["offsets"],
            DesignToken.DeepReadonly<
                [DesignToken.Values.Dimension, DesignToken.Values.Dimension]
            >
        >
    >,
    // Literal type names, including inherited ones
    Expect<Equal<Tokens["elevation"]["low"]["$type"], "elevation">>,
    Expect<Equal<Tokens["elevation"]["raised"]["top"]["$type"], "elevation">>,
    Expect<Equal<Tokens["elevation"]["scale"]["step"]["$type"], "ratio">>,
    Expect<Equal<Tokens["elevation"]["$type"], "elevation">>,
    // Standard tokens are unchanged
    Expect<
        Equal<
            Tokens["colors"]["accent"]["$value"],
            DesignToken.Values.Readonly.Color
        >
    >,
    Expect<Equal<Tokens["colors"]["accent"]["$type"], DesignToken.Type.Color>>,
    Expect<
        Equal<Tokens["unit"]["$value"], DesignToken.Values.Readonly.Dimension>
    >,
    // Nothing public is `any` or `unknown`
    Expect<IsKnown<Tokens["elevation"]["low"]["$value"]>>,
    Expect<IsKnown<Tokens["elevation"]["low"]["$type"]>>,
    Expect<IsKnown<Library.TokenValues<CustomTheme>["elevation"]["low"]>>,
    Expect<IsKnown<Library.TokenRecord<CustomTheme>["$value"]>>,
    Expect<IsKnown<Library.TokenRecord<CustomTheme>["$type"]>>,
    Expect<IsKnown<Parameters<CSSConverters<CustomTheme>["elevation"]>[0]>>,
];

// Subscriber records are a union discriminated by `type`
library.subscribe({
    onChange(records) {
        for (const record of records) {
            if (record.$type === "elevation") {
                const value = record.$value;
                type Narrowed = Expect<
                    Equal<typeof value, DesignToken.DeepReadonly<Elevation>>
                >;
            } else if (record.$type === "ratio") {
                const value = record.$value;
                type Narrowed = Expect<Equal<typeof value, number>>;
            } else if (record.$type === DesignToken.Type.Color) {
                const value = record.$value;
                type Narrowed = Expect<
                    Equal<typeof value, DesignToken.Values.Readonly.Color>
                >;
            }
        }
    },
});
type RecordTypes = Expect<
    Equal<
        Library.TokenRecord<CustomTheme>["$type"],
        | DesignToken.Type.Color
        | DesignToken.Type.Dimension
        | DesignToken.Type.FontFamily
        | "elevation"
        | "ratio"
        | "label"
        | "flag"
        | "steps"
        | "nested"
    >
>;

/* Config values. Static values, refs and deep refs are covered by `customConfig`. */
interface Standard {
    a: DesignToken.Color;
    n: DesignToken.Number;
    gradient: DesignToken.Gradient;
    curve: DesignToken.CubicBezier;
}
const standard = refs<Standard>();
// Gradient stop refs (#28) and CubicBezier number refs (#29)
const standardAliases: Library.Config<Standard> = {
    a: { $type: C, $value: hex("#111111") },
    n: { $type: DesignToken.Type.Number, $value: 0.5 },
    gradient: {
        $type: DesignToken.Type.Gradient,
        $value: [
            { color: standard.a, position: 0 },
            { color: hex("#222222"), position: standard.n },
        ],
    },
    curve: {
        $type: DesignToken.Type.CubicBezier,
        $value: [standard.n, 0, 1, 1],
    },
};

function configValueNegatives() {
    interface Theme {
        c: DesignToken.Color;
        e: ElevationToken;
        r: RatioToken;
    }
    const valid: Library.Config<Theme> = {
        c: { $type: C, $value: hex("#111111") },
        e: {
            $type: "elevation",
            $value: {
                level: 1,
                shadowColor: hex("#111111"),
                offsets: [px(0), px(0)],
            },
        },
        r: { $type: "ratio", $value: 1 },
    };

    // wrong static field type
    const wrongField: Library.Config<Theme> = {
        ...valid,
        e: {
            $type: "elevation",
            $value: {
                // @ts-expect-error level is a number
                level: "1",
                shadowColor: hex("#111111"),
                offsets: [px(0), px(0)],
            },
        },
    };
    // wrong static value
    const wrongValue: Library.Config<Theme> = {
        ...valid,
        // @ts-expect-error a ratio is a number
        r: { $type: "ratio", $value: "1" },
    };
    // alias resolving to an incompatible token
    const wrongAlias: Library.Config<Theme> = {
        ...valid,
        // @ts-expect-error a Color token is not a number
        r: { $type: "ratio", $value: $.c },
    };
    // deep alias resolving to an incompatible token
    const wrongDeepAlias: Library.Config<Theme> = {
        ...valid,
        e: {
            $type: "elevation",
            $value: {
                // @ts-expect-error a Color token is not a number
                level: $.c,
                shadowColor: hex("#111111"),
                offsets: [px(0), px(0)],
            },
        },
    };

    // set() rejects wrong values
    const lib = Library.create(valid);
    // @ts-expect-error missing properties
    lib.tokens.e.set({ level: 1 });
    // @ts-expect-error a ratio is a number
    lib.tokens.r.set("1");
    // @ts-expect-error a Color token is not a number
    lib.tokens.r.set($.c);

    return [wrongField, wrongValue, wrongAlias, wrongDeepAlias];
}

/* Declaration constraints */
function declarationNegatives() {
    // reserved names
    const reserved: Library.Config<{
        c: DesignToken.Custom<"color", string>;
        b: DesignToken.Custom<"border", string>;
    }> = {
        // @ts-expect-error 'color' is a reserved DTCG type name
        c: { $type: "color", $value: "red" },
        // @ts-expect-error 'border' is a reserved DTCG type name
        b: { $type: "border", $value: px(1) },
    };
    type ReservedMessage = Expect<
        Equal<
            DesignToken.Custom<"color", string>["$type"],
            "Error: 'color' is a reserved DTCG type name"
        >
    >;

    // a value can be a function, or may be one: it's data
    const functions: Library.Config<{
        f: DesignToken.Custom<"fn", () => void>;
        maybe: DesignToken.Custom<"maybeFn", string | (() => void)>;
    }> = {
        f: { $type: "fn", $value: () => {} },
        maybe: { $type: "maybeFn", $value: "none" },
    };
    type FunctionTypes = [
        Expect<Equal<DesignToken.Custom<"fn", () => void>["$type"], "fn">>,
        Expect<
            Equal<
                DesignToken.Custom<"maybeFn", string | (() => void)>["$type"],
                "maybeFn"
            >
        >,
    ];

    // an object or a class instance with functions is data
    class Palette {
        constructor(readonly swatches: number[]) {}
        first() {
            return this.swatches[0];
        }
    }
    interface WithFunctions {
        a: { b: () => void };
        visit: (node: WithFunctions) => void;
        children: WithFunctions[];
    }
    const withFunctions: Library.Config<{
        p: DesignToken.Custom<"palette", Palette>;
        w: DesignToken.Custom<"withFunctions", WithFunctions>;
    }> = {
        p: { $type: "palette", $value: new Palette([1]) },
        w: {
            $type: "withFunctions",
            $value: { a: { b: () => {} }, visit: () => {}, children: [] },
        },
    };
    type DataTypes = [
        Expect<
            Equal<DesignToken.Custom<"palette", Palette>["$type"], "palette">
        >,
        Expect<
            Equal<
                DesignToken.Custom<"withFunctions", WithFunctions>["$type"],
                "withFunctions"
            >
        >,
    ];

    // a value that contains itself, like a tree, is accepted
    interface Tree {
        fn: string;
        args: Array<number | Tree>;
    }
    const recursive: Library.Config<{ t: DesignToken.Custom<"tree", Tree> }> = {
        t: {
            $type: "tree",
            $value: { fn: "add", args: [1, { fn: "add", args: [2] }] },
        },
    };
    type RecursiveType = Expect<
        Equal<DesignToken.Custom<"tree", Tree>["$type"], "tree">
    >;

    // the config type must match the declared name
    const mismatched: Library.Config<{ r: RatioToken }> = {
        // @ts-expect-error 'label' is not 'ratio'
        r: { $type: "label", $value: 1 },
    };

    return [reserved, functions, withFunctions, recursive, mismatched];
}

/* Group type inheritance. Inheriting, nested inheritance and overriding are covered by `customConfig`. */
function inheritanceNegatives() {
    // a group of a different type
    const differentGroup: Library.Config<{
        g: { $type: "elevation"; r: RatioToken };
    }> = {
        // @ts-expect-error 'ratio' isn't inherited from an 'elevation' group
        g: { $type: "elevation", r: { $value: 1 } },
    };

    // no ancestor group type
    const noGroup: Library.Config<{ r: RatioToken }> = {
        // @ts-expect-error no type to inherit
        r: { $value: 1 },
    };

    // wide, union and optional group types pass on nothing
    interface Groups {
        wide: { $type: string; r: RatioToken };
        union: { $type: "ratio" | "label"; r: RatioToken };
        optional: { $type?: "ratio"; r: RatioToken };
        standardWide: { $type: DesignToken.Type; d: DesignToken.Dimension };
    }
    const groups: Library.Config<Groups> = {
        // @ts-expect-error a string group type passes on nothing
        wide: { $type: "ratio", r: { $value: 1 } },
        // @ts-expect-error a union group type passes on nothing
        union: { $type: "ratio", r: { $value: 1 } },
        // @ts-expect-error an optional group type passes on nothing
        optional: { $type: "ratio", r: { $value: 1 } },
        standardWide: {
            $type: DesignToken.Type.Dimension,
            // @ts-expect-error DesignToken.Type passes on nothing
            d: { $value: px(1) },
        },
    };
    const groupsWithTypes: Library.Config<Groups> = {
        wide: { $type: "ratio", r: { $type: "ratio", $value: 1 } },
        union: { $type: "ratio", r: { $type: "ratio", $value: 1 } },
        optional: { r: { $type: "ratio", $value: 1 } },
        standardWide: {
            $type: DesignToken.Type.Dimension,
            d: { $type: DesignToken.Type.Dimension, $value: px(1) },
        },
    };

    // the group type must match the interface
    const wrongGroupType: Library.Config<{
        g: { $type: "ratio"; r: RatioToken };
    }> = {
        // @ts-expect-error 'label' is not 'ratio'
        g: { $type: "label", r: { $value: 1 } },
    };

    // standard tokens follow the same rules
    const standard: Library.Config<{
        borders: { $type: DesignToken.Type.Border; c: DesignToken.Color };
        colors: { $type: DesignToken.Type.Color; c: DesignToken.Color };
    }> = {
        borders: {
            $type: DesignToken.Type.Border,
            // @ts-expect-error a Color isn't inherited from a Border group
            c: { $value: hex("#111111") },
        },
        colors: { $type: C, c: { $value: hex("#111111") } },
    };

    return [
        differentGroup,
        noGroup,
        groups,
        groupsWithTypes,
        wrongGroupType,
        standard,
    ];
}

/* Extended libraries */
interface Extension {
    elevation: { floating: ElevationToken };
    spacing: { $type: "ratio"; tight: RatioToken };
    z: DesignToken.Custom<"z-index", number>;
}
const $ = refs<CustomTheme>();
const extended = library.extend<Extension>({
    elevation: {
        // static, ref and deep ref overrides
        low: {
            $value: {
                level: 0,
                shadowColor: hex("#000000"),
                offsets: [px(0), px(0)],
            },
        },
        high: { $value: $.elevation.low },
        raised: {
            top: {
                $value: {
                    level: $.ratio,
                    shadowColor: hex("#000000"),
                    offsets: [px(0), px(0)],
                },
            },
        },
        // inherits the source group's type
        floating: {
            $value: {
                level: 3,
                shadowColor: $.colors.muted,
                offsets: [px(0), px(1)],
            },
        },
    },
    // New groups and tokens
    spacing: { $type: "ratio", tight: { $value: 0.5 } },
    z: { $type: "z-index", $value: 10 },
});
type ExtendedTokens = typeof extended.tokens;
type Extended = [
    Expect<
        Equal<
            ExtendedTokens["elevation"]["floating"]["$value"],
            DesignToken.DeepReadonly<Elevation>
        >
    >,
    Expect<
        Equal<ExtendedTokens["elevation"]["floating"]["$type"], "elevation">
    >,
    Expect<Equal<ExtendedTokens["spacing"]["tight"]["$type"], "ratio">>,
    Expect<Equal<ExtendedTokens["z"]["$value"], number>>,
    Expect<Equal<ExtendedTokens["z"]["$type"], "z-index">>,
    Expect<
        Equal<
            ExtendedTokens["elevation"]["low"]["$value"],
            DesignToken.DeepReadonly<Elevation>
        >
    >,
    Expect<
        Equal<
            Library.TokenRecord<CustomTheme & Extension>["$type"],
            Library.TokenRecord<CustomTheme>["$type"] | "z-index"
        >
    >,
];

function extendNegatives() {
    // incompatible override
    library.extend({
        // @ts-expect-error a ratio is a number
        ratio: { $value: "1" },
    });
    // a source group of a different type
    library.extend<{ elevation: { r: LabelToken } }>({
        // @ts-expect-error 'label' isn't inherited from an 'elevation' group
        elevation: { r: { $value: "x" } },
    });
}

/* convert */
type Convert = [
    Expect<
        Equal<
            Parameters<typeof convert<"color">>[1],
            DesignToken.Values.Readonly.Color
        >
    >,
    Expect<
        Equal<
            Parameters<typeof convert<"dimension">>[1],
            DesignToken.Values.Readonly.Dimension
        >
    >,
    Expect<Equal<ReturnType<typeof convert>, string>>,
];
function convertCases() {
    convert("color", hex("#111111"));
    convert("dimension", px(1));
    convert("number", 1);
    // @ts-expect-error a color is not a dimension
    convert("dimension", hex("#111111"));
    // @ts-expect-error 'elevation' is not a standard type
    convert("elevation", 1);
    return [];
}

/* CSS */
const converters: CSSConverters<CustomTheme> = {
    elevation: (value) => `${value.level}`,
    ratio: (value) => `${value}`,
    label: (value) => value,
    flag: (value) => (value ? "1" : "0"),
    steps: (value) => value.join(" "),
    nested: (value) => String(value.outer.inner.size.value),
};
type CSSTypes = [
    // Converter arguments
    Expect<
        Equal<
            Parameters<CSSConverters<CustomTheme>["elevation"]>[0],
            DesignToken.DeepReadonly<Elevation>
        >
    >,
    Expect<
        Equal<
            Parameters<CSSConverters<CustomTheme>["steps"]>[0],
            readonly number[]
        >
    >,
    // Only custom types have converters
    Expect<
        Equal<
            keyof CSSConverters<CustomTheme>,
            "elevation" | "ratio" | "label" | "flag" | "steps" | "nested"
        >
    >,
    // toProperties
    Expect<
        Equal<
            CSSPropertiesLibrary<Tokens>["elevation"]["low"]["var"],
            `var(--${string})`
        >
    >,
    Expect<
        Equal<CSSPropertiesLibrary<Tokens>["elevation"]["$type"], "elevation">
    >,
];

function cssCases() {
    const standardOnly = Library.create<{ c: DesignToken.Color }>({
        c: { $type: C, $value: hex("#111111") },
    });
    // No custom types: options are optional and take no converters
    toCSS(standardOnly);
    toCSS(standardOnly, {});
    // ... but can take converters for the standard types, typed by the value of the type
    toCSS(standardOnly, { converters: { color: (value) => value.colorSpace } });
    toCSS(standardOnly, {
        converters: {
            color: (value, token) => `${token.name}${value.components[0]}`,
            typography: (value) => `${value.fontSize.unit}`,
            number: (value) => value.toFixed(),
        },
    });
    toCSS(standardOnly, {
        converters: {
            // @ts-expect-error the value of a color has no such property
            color: (value) => value.missing,
        },
    });
    toCSS(standardOnly, {
        // @ts-expect-error 'unknown' is not a standard type, and the library has no custom types
        converters: { unknown: () => "" },
    });
    toCSS(standardOnly, {
        converters: {
            // @ts-expect-error a converter returns a string
            color: () => 1,
        },
    });

    // Custom types: converters are required
    toCSS(library, { converters });
    // @ts-expect-error options are required
    toCSS(library);
    // @ts-expect-error converters are required
    toCSS(library, {});
    // A custom type may be left out of the CSS with `false`
    toCSS(library, { converters: { ...converters, nested: false } });
    toCSS(library, {
        converters: {
            elevation: false,
            ratio: false,
            label: false,
            flag: false,
            steps: false,
            nested: false,
        },
    });
    // @ts-expect-error `true` isn't a converter
    toCSS(library, { converters: { ...converters, nested: true } });
    // toProperties takes the same converters
    toProperties(library, { converters });
    toProperties(library, { converters: { ...converters, nested: false } });
    // A standard type can have a converter next to the custom types
    toCSS(library, {
        converters: { ...converters, color: (value) => value.colorSpace },
    });
    // Every custom type needs a converter
    const { nested, ...withoutNested } = converters;
    // @ts-expect-error a converter for 'nested' is missing
    toCSS(library, { converters: withoutNested });
    // Only custom types in the library are accepted
    toCSS(library, {
        converters: {
            ...converters,
            // @ts-expect-error 'unknown' is not a custom type in the library
            unknown: (value: unknown) => "",
        },
    });
    // converters receive the token
    toCSS(library, {
        converters: {
            ...converters,
            elevation: (value, token) => {
                type Value = Expect<
                    Equal<typeof value, DesignToken.DeepReadonly<Elevation>>
                >;
                type Type = Expect<Equal<typeof token.$type, "elevation">>;
                type TokenValue = Expect<
                    Equal<
                        typeof token.$value,
                        DesignToken.DeepReadonly<Elevation>
                    >
                >;
                return token.name;
            },
        },
    });
    // Extended libraries need converters for new custom types
    toCSS(extended, {
        converters: { ...converters, "z-index": (value) => `${value}` },
    });
    // @ts-expect-error a converter for 'z-index' is missing
    toCSS(extended, { converters });

    // toProperties
    const properties = toProperties(library);
    const top: `var(--${string})` = properties.elevation.raised.top.var;
    return top;
}

Types("type-level assertions compile", () => {
    Assert.ok([
        standardAliases,
        configValueNegatives,
        declarationNegatives,
        inheritanceNegatives,
        extendNegatives,
        cssCases,
        convertCases,
    ]);
});

Types.run();
