/**
 * Type-level tests. These are enforced by `tsc -b`: a `@ts-expect-error`
 * that no longer errors, or a valid assignment that errors, fails the build.
 */
import { suite } from "uvu";
import * as Assert from "uvu/assert";
import { DesignToken } from "../lib/design-token.js";
import { Library } from "../lib/library.js";
import { Equal, Expect } from "./helpers.js";
import { hex, px } from "./values.js";

const Types = suite("Type-level API");

interface Theme {
    a: DesignToken.Color;
    b: DesignToken.Color;
    border: DesignToken.Border;
}

const config: Library.Config<Theme> = {
    a: { $type: DesignToken.Type.Color, $value: hex("#111111") },
    // Alias values are accepted
    b: { $type: DesignToken.Type.Color, $value: (context) => context.a },
    border: {
        $type: DesignToken.Type.Border,
        // Deep alias values are accepted
        $value: {
            color: (context) => context.a,
            width: px(1),
            style: "solid",
        },
    },
};

const invalidConfig: Library.Config<Theme> = {
    // @ts-expect-error a Color token rejects a number value
    a: { $type: DesignToken.Type.Color, $value: 12 },
    b: { $type: DesignToken.Type.Color, $value: hex("#111111") },
    border: config.border,
};

const library = Library.create(config);

// Token values are typed by token type
const color: DesignToken.Values.Readonly.Color = library.tokens.a.$value;
// @ts-expect-error a Color value is not a number
const notNumber: number = library.tokens.a.$value;

// extend<K> exposes both source and new keys
interface Extension {
    c: DesignToken.Color;
}
const extended = library.extend<Extension>({
    c: { $type: DesignToken.Type.Color, $value: hex("#333333") },
});
const sourceKey: DesignToken.Values.Readonly.Color = extended.tokens.a.$value;
const newKey: DesignToken.Values.Readonly.Color = extended.tokens.c.$value;

// @ts-expect-error set() rejects a mismatched value type
library.tokens.a.set(12);

// Overriding a source token with a static value keeps the source token type
const overridden = library.extend({
    a: { $value: hex("#000000") },
    b: {
        $value: (context) => {
            type Check = Expect<
                Equal<typeof context.a.$value, DesignToken.Values.Color>
            >;
            return context.a;
        },
    },
});
overridden.tokens.a.set(hex("#123456"));
// The extended library's context type is `Theme & {}`, so the token types are
// compared by assignability, and their `$value` and `$type` exactly.
const overriddenToSource: typeof library.tokens = overridden.tokens;
const sourceToOverridden: typeof overridden.tokens = library.tokens;
type OverrideTypes = [
    Expect<
        Equal<typeof overridden.tokens.a.$value, typeof library.tokens.a.$value>
    >,
    Expect<
        Equal<typeof overridden.tokens.a.$type, typeof library.tokens.a.$type>
    >,
];

// New tokens are inferred, including inside existing groups
interface GroupedTheme {
    g: { $type: DesignToken.Type.Color; a: DesignToken.Color };
}
const grouped = Library.create<GroupedTheme>({
    g: { $type: DesignToken.Type.Color, a: { $value: hex("#111111") } },
});
const groupedExtended = grouped.extend({
    g: { a: { $value: hex("#000000") }, b: { $value: hex("#222222") } },
    c: { $type: DesignToken.Type.Color, $value: hex("#333333") },
});
groupedExtended.tokens.g.a.set(hex("#123456"));
type GroupedTypes = [
    Expect<
        Equal<typeof groupedExtended.tokens.g.b.$type, DesignToken.Type.Color>
    >,
];
const newToken: DesignToken.Values.Readonly.Color =
    groupedExtended.tokens.c.$value;

// Inferred token values are checked against their declared type (#37).
// @ts-expect-error a Color token rejects a number value
Library.create({ a: { $type: DesignToken.Type.Color, $value: 12 } });
Library.create({
    // @ts-expect-error a Dimension's unit is "px" or "rem"
    a: { $type: DesignToken.Type.Dimension, $value: { value: 1, unit: "rm" } },
});
Library.create({
    g: {
        $type: DesignToken.Type.Color,
        // @ts-expect-error a token in a group is checked against its own type
        d: { $type: DesignToken.Type.Dimension, $value: hex("#111111") },
    },
});
Library.create({
    a: { $type: DesignToken.Type.Color, $value: hex("#111111") },
}).extend({
    // @ts-expect-error a new Color token in an extend config rejects a number
    c: { $type: DesignToken.Type.Color, $value: 12 },
});
// Never called: `create` throws at runtime for a token with a child.
const tokenChildChecks = () => {
    Library.create({
        // @ts-expect-error a token can't have a child
        a: { $type: DesignToken.Type.Color, $value: hex("#111111"), x: 1 },
    });
    Library.create({
        // @ts-expect-error a child doesn't stop the value from being checked
        a: { $type: DesignToken.Type.Color, $value: 12, x: 1 },
    });
    Library.create({
        a: { $type: DesignToken.Type.Color, $value: hex("#111111") },
    }).extend({
        // @ts-expect-error a new token in an extend config can't have a child
        c: { $type: DesignToken.Type.Color, $value: hex("#222222"), x: 1 },
    });
};

// Inferred tokens have their type's value, not the widened literal (#37).
const inferred = Library.create({
    space: {
        $type: DesignToken.Type.Dimension,
        $value: { value: 4, unit: "px" },
    },
    line: { $type: DesignToken.Type.StrokeStyle, $value: "solid" },
    custom: { $type: "elevation", $value: { level: 1 } },
});
type InferredTypes = [
    Expect<
        Equal<
            typeof inferred.tokens.space.$value,
            DesignToken.Values.Readonly.Dimension
        >
    >,
    Expect<
        Equal<
            typeof inferred.tokens.line.$value,
            DesignToken.Values.Readonly.StrokeStyle
        >
    >,
    // Custom types keep the value they declare.
    Expect<
        Equal<typeof inferred.tokens.custom.$value, { readonly level: number }>
    >,
    // Inferred `$type` literals are kept, for built-in and custom types.
    Expect<
        Equal<typeof inferred.tokens.space.$type, DesignToken.Type.Dimension>
    >,
    Expect<Equal<typeof inferred.tokens.custom.$type, "elevation">>,
];
// @ts-expect-error set() checks an inferred token against its type
inferred.tokens.space.set({ value: 1, unit: "rm" });
// @ts-expect-error set() checks an inferred token against its type
inferred.tokens.line.set("wavy");

// A dimension's unit is "px" or "rem" (#26).
const remDimension: DesignToken.Values.Dimension = { value: 1, unit: "rem" };
// @ts-expect-error "rm" is not a dimension unit
const rmDimension: DesignToken.Values.Dimension = { value: 1, unit: "rm" };

// Token values are deeply readonly at compile time (#24). Never called,
// since the values are also frozen at runtime.
function readonlyValues() {
    // @ts-expect-error top-level property is readonly
    library.tokens.border.$value.width = px(2);
    // @ts-expect-error top-level property is readonly
    library.tokens.border.$value.style = "dashed";
    // @ts-expect-error nested properties are readonly
    library.tokens.border.$value.width.value = 2;
    // @ts-expect-error nested arrays are readonly
    library.tokens.border.$value.color.components.push(0);
    const gradient = Library.create({
        g: {
            $type: DesignToken.Type.Gradient,
            $value: [{ color: hex("#111111"), position: 0 }],
        },
    });
    // @ts-expect-error arrays are readonly
    gradient.tokens.g.$value.push({ color: hex("#222222"), position: 1 });
    // @ts-expect-error array items are readonly
    gradient.tokens.g.$value[0].position = 1;
}

Types("type-level assertions compile", () => {
    Assert.ok([
        invalidConfig,
        tokenChildChecks,
        overriddenToSource,
        sourceToOverridden,
        color,
        notNumber,
        sourceKey,
        newKey,
        newToken,
        remDimension,
        rmDimension,
    ]);
});

Types.run();
