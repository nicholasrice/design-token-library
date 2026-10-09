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
    toCSS,
    toProperties,
} from "../lib/css-reflector.js";
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

const Types = suite("Custom token types: type-level API");

const C = DesignToken.Type.Color;
const library = Library.create(customConfig());
type Tokens = typeof library.tokens;

/* Value and type resolution */
type Resolution = [
    // Object values
    Expect<Equal<Tokens["elevation"]["low"]["value"], Elevation>>,
    // Primitive values
    Expect<Equal<Tokens["ratio"]["value"], number>>,
    Expect<Equal<Tokens["label"]["value"], string>>,
    Expect<Equal<Tokens["flag"]["value"], boolean>>,
    // Array, nested object and tuple values
    Expect<Equal<Tokens["steps"]["value"], number[]>>,
    Expect<Equal<Tokens["nested"]["value"], Nested>>,
    Expect<
        Equal<
            Tokens["elevation"]["low"]["value"]["offsets"],
            [DesignToken.Values.Dimension, DesignToken.Values.Dimension]
        >
    >,
    // Literal type names, including inherited ones
    Expect<Equal<Tokens["elevation"]["low"]["type"], "elevation">>,
    Expect<Equal<Tokens["elevation"]["raised"]["top"]["type"], "elevation">>,
    Expect<Equal<Tokens["elevation"]["scale"]["step"]["type"], "ratio">>,
    Expect<Equal<Tokens["elevation"]["type"], "elevation">>,
    // Standard tokens are unchanged
    Expect<
        Equal<Tokens["colors"]["accent"]["value"], DesignToken.Values.Color>
    >,
    Expect<Equal<Tokens["colors"]["accent"]["type"], DesignToken.Type.Color>>,
    Expect<Equal<Tokens["unit"]["value"], DesignToken.Values.Dimension>>,
    // Nothing public is `any` or `unknown`
    Expect<IsKnown<Tokens["elevation"]["low"]["value"]>>,
    Expect<IsKnown<Tokens["elevation"]["low"]["type"]>>,
    Expect<IsKnown<Library.Context<CustomTheme>["elevation"]["low"]["value"]>>,
    Expect<IsKnown<Library.TokenRecord<CustomTheme>["value"]>>,
    Expect<IsKnown<Library.TokenRecord<CustomTheme>["type"]>>,
    Expect<IsKnown<Parameters<CSSConverters<CustomTheme>["elevation"]>[0]>>,
];

// Subscriber records are a union discriminated by `type`
library.subscribe({
    onChange(records) {
        for (const record of records) {
            if (record.type === "elevation") {
                const value = record.value;
                type Narrowed = Expect<Equal<typeof value, Elevation>>;
            } else if (record.type === "ratio") {
                const value = record.value;
                type Narrowed = Expect<Equal<typeof value, number>>;
            } else if (record.type === DesignToken.Type.Color) {
                const value = record.value;
                type Narrowed = Expect<
                    Equal<typeof value, DesignToken.Values.Color>
                >;
            }
        }
    },
});
type RecordTypes = Expect<
    Equal<
        Library.TokenRecord<CustomTheme>["type"],
        | DesignToken.Type.Color
        | DesignToken.Type.Dimension
        | "elevation"
        | "ratio"
        | "label"
        | "flag"
        | "steps"
        | "nested"
    >
>;

/* Config values. Static values, aliases and deep aliases are covered by `customConfig`. */
interface Standard {
    a: DesignToken.Color;
    n: DesignToken.Number;
    gradient: DesignToken.Gradient;
    curve: DesignToken.CubicBezier;
}
// Gradient stop aliases (#28) and CubicBezier number aliases (#29)
const standardAliases: Library.Config<Standard> = {
    a: { type: C, value: "#111111" },
    n: { type: DesignToken.Type.Number, value: 0.5 },
    gradient: {
        type: DesignToken.Type.Gradient,
        value: [
            { color: (context) => context.a, position: 0 },
            { color: "#222222", position: (context) => context.n },
        ],
    },
    curve: {
        type: DesignToken.Type.CubicBezier,
        value: [(context) => context.n, 0, 1, 1],
    },
};

function configValueNegatives() {
    interface Theme {
        c: DesignToken.Color;
        e: ElevationToken;
        r: RatioToken;
    }
    const valid: Library.Config<Theme> = {
        c: { type: C, value: "#111111" },
        e: {
            type: "elevation",
            value: {
                level: 1,
                shadowColor: "#111111",
                offsets: ["0px", "0px"],
            },
        },
        r: { type: "ratio", value: 1 },
    };

    // wrong static field type
    const wrongField: Library.Config<Theme> = {
        ...valid,
        e: {
            type: "elevation",
            value: {
                // @ts-expect-error level is a number
                level: "1",
                shadowColor: "#111111",
                offsets: ["0px", "0px"],
            },
        },
    };
    // wrong static value
    const wrongValue: Library.Config<Theme> = {
        ...valid,
        // @ts-expect-error a ratio is a number
        r: { type: "ratio", value: "1" },
    };
    // alias resolving to an incompatible token
    const wrongAlias: Library.Config<Theme> = {
        ...valid,
        // @ts-expect-error a Color token is not a number
        r: { type: "ratio", value: (context) => context.c },
    };
    // deep alias resolving to an incompatible token
    const wrongDeepAlias: Library.Config<Theme> = {
        ...valid,
        e: {
            type: "elevation",
            value: {
                // @ts-expect-error a Color token is not a number
                level: (context) => context.c,
                shadowColor: "#111111",
                offsets: ["0px", "0px"],
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
    lib.tokens.r.set((context) => context.c);

    return [wrongField, wrongValue, wrongAlias, wrongDeepAlias];
}

/* Declaration constraints */
function declarationNegatives() {
    // reserved names
    const reserved: Library.Config<{
        c: DesignToken.Custom<"color", string>;
        b: DesignToken.Custom<"border", string>;
    }> = {
        // @ts-expect-error 'color' is a reserved DTWG type name
        c: { type: "color", value: "red" },
        // @ts-expect-error 'border' is a reserved DTWG type name
        b: { type: "border", value: "1px" },
    };
    type ReservedMessage = Expect<
        Equal<
            DesignToken.Custom<"color", string>["type"],
            "Error: 'color' is a reserved DTWG type name"
        >
    >;

    // function values, top-level and nested
    const functions: Library.Config<{
        f: DesignToken.Custom<"fn", () => void>;
        n: DesignToken.Custom<"nestedFn", { a: { b: () => void } }>;
    }> = {
        // @ts-expect-error custom values cannot contain functions
        f: { type: "fn", value: () => {} },
        // @ts-expect-error custom values cannot contain functions
        n: { type: "nestedFn", value: { a: { b: () => {} } } },
    };

    // the config type must match the declared name
    const mismatched: Library.Config<{ r: RatioToken }> = {
        // @ts-expect-error 'label' is not 'ratio'
        r: { type: "label", value: 1 },
    };

    return [reserved, functions, mismatched];
}

/* Group type inheritance. Inheriting, nested inheritance and overriding are covered by `customConfig`. */
function inheritanceNegatives() {
    // a group of a different type
    const differentGroup: Library.Config<{
        g: { type: "elevation"; r: RatioToken };
    }> = {
        // @ts-expect-error 'ratio' isn't inherited from an 'elevation' group
        g: { type: "elevation", r: { value: 1 } },
    };

    // no ancestor group type
    const noGroup: Library.Config<{ r: RatioToken }> = {
        // @ts-expect-error no type to inherit
        r: { value: 1 },
    };

    // wide, union and optional group types pass on nothing
    interface Groups {
        wide: { type: string; r: RatioToken };
        union: { type: "ratio" | "label"; r: RatioToken };
        optional: { type?: "ratio"; r: RatioToken };
        standardWide: { type: DesignToken.Type; d: DesignToken.Dimension };
    }
    const groups: Library.Config<Groups> = {
        // @ts-expect-error a string group type passes on nothing
        wide: { type: "ratio", r: { value: 1 } },
        // @ts-expect-error a union group type passes on nothing
        union: { type: "ratio", r: { value: 1 } },
        // @ts-expect-error an optional group type passes on nothing
        optional: { type: "ratio", r: { value: 1 } },
        standardWide: {
            type: DesignToken.Type.Dimension,
            // @ts-expect-error DesignToken.Type passes on nothing
            d: { value: "1px" },
        },
    };
    const groupsWithTypes: Library.Config<Groups> = {
        wide: { type: "ratio", r: { type: "ratio", value: 1 } },
        union: { type: "ratio", r: { type: "ratio", value: 1 } },
        optional: { r: { type: "ratio", value: 1 } },
        standardWide: {
            type: DesignToken.Type.Dimension,
            d: { type: DesignToken.Type.Dimension, value: "1px" },
        },
    };

    // the group type must match the interface
    const wrongGroupType: Library.Config<{
        g: { type: "ratio"; r: RatioToken };
    }> = {
        // @ts-expect-error 'label' is not 'ratio'
        g: { type: "label", r: { value: 1 } },
    };

    // standard tokens follow the same rules
    const standard: Library.Config<{
        borders: { type: DesignToken.Type.Border; c: DesignToken.Color };
        colors: { type: DesignToken.Type.Color; c: DesignToken.Color };
    }> = {
        // @ts-expect-error a Color isn't inherited from a Border group
        borders: { type: DesignToken.Type.Border, c: { value: "#111111" } },
        colors: { type: C, c: { value: "#111111" } },
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
    spacing: { type: "ratio"; tight: RatioToken };
    z: DesignToken.Custom<"z-index", number>;
}
const extended = library.extend<Extension>({
    elevation: {
        // static, alias and deep alias overrides
        low: {
            value: {
                level: 0,
                shadowColor: "#000000",
                offsets: ["0px", "0px"],
            },
        },
        high: { value: (context) => context.elevation.low },
        raised: {
            top: {
                value: {
                    level: (context) => context.ratio,
                    shadowColor: "#000000",
                    offsets: ["0px", "0px"],
                },
            },
        },
        // inherits the source group's type
        floating: {
            value: {
                level: 3,
                shadowColor: (context) => context.colors.muted,
                offsets: ["0px", "1px"],
            },
        },
    },
    // New groups and tokens
    spacing: { type: "ratio", tight: { value: 0.5 } },
    z: { type: "z-index", value: 10 },
});
type ExtendedTokens = typeof extended.tokens;
type Extended = [
    Expect<Equal<ExtendedTokens["elevation"]["floating"]["value"], Elevation>>,
    Expect<Equal<ExtendedTokens["elevation"]["floating"]["type"], "elevation">>,
    Expect<Equal<ExtendedTokens["spacing"]["tight"]["type"], "ratio">>,
    Expect<Equal<ExtendedTokens["z"]["value"], number>>,
    Expect<Equal<ExtendedTokens["z"]["type"], "z-index">>,
    Expect<Equal<ExtendedTokens["elevation"]["low"]["value"], Elevation>>,
    Expect<
        Equal<
            Library.TokenRecord<CustomTheme & Extension>["type"],
            Library.TokenRecord<CustomTheme>["type"] | "z-index"
        >
    >,
];

function extendNegatives() {
    // incompatible override
    library.extend({
        // @ts-expect-error a ratio is a number
        ratio: { value: "1" },
    });
    // a source group of a different type
    library.extend<{ elevation: { r: LabelToken } }>({
        // @ts-expect-error 'label' isn't inherited from an 'elevation' group
        elevation: { r: { value: "x" } },
    });
}

/* CSS */
const converters: CSSConverters<CustomTheme> = {
    elevation: (value) => `${value.level}`,
    ratio: (value) => `${value}`,
    label: (value) => value,
    flag: (value) => (value ? "1" : "0"),
    steps: (value) => value.join(" "),
    nested: (value) => value.outer.inner.size,
};
type CSSTypes = [
    // Converter arguments
    Expect<
        Equal<Parameters<CSSConverters<CustomTheme>["elevation"]>[0], Elevation>
    >,
    Expect<Equal<Parameters<CSSConverters<CustomTheme>["steps"]>[0], number[]>>,
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
        Equal<CSSPropertiesLibrary<Tokens>["elevation"]["type"], "elevation">
    >,
];

function cssCases() {
    const standardOnly = Library.create<{ c: DesignToken.Color }>({
        c: { type: C, value: "#111111" },
    });
    // No custom types: options are optional and take no converters
    toCSS(standardOnly);
    toCSS(standardOnly, {});
    toCSS(standardOnly, {
        // @ts-expect-error a library without custom types takes no converters
        converters: { color: () => "" },
    });

    // Custom types: converters are required
    toCSS(library, { converters });
    // @ts-expect-error options are required
    toCSS(library);
    // @ts-expect-error converters are required
    toCSS(library, {});
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
                type Value = Expect<Equal<typeof value, Elevation>>;
                type Type = Expect<Equal<typeof token.type, "elevation">>;
                type TokenValue = Expect<Equal<typeof token.value, Elevation>>;
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
    ]);
});

Types.run();
