/**
 * Type-level tests. These are enforced by `tsc -b`: a `@ts-expect-error`
 * that no longer errors, or a valid assignment that errors, fails the build.
 */
import { suite } from "uvu";
import * as Assert from "uvu/assert";
import { DesignToken } from "../lib/design-token.js";
import { Library } from "../lib/library.js";
import { Equal, Expect } from "./helpers.js";
import { hex, px, rem } from "./values.js";

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
const color: DesignToken.Values.Color = library.tokens.a.$value;
// @ts-expect-error a Color value is not a number
const notNumber: number = library.tokens.a.$value;

// extend<K> exposes both source and new keys
interface Extension {
    c: DesignToken.Color;
}
const extended = library.extend<Extension>({
    c: { $type: DesignToken.Type.Color, $value: hex("#333333") },
});
const sourceKey: DesignToken.Values.Color = extended.tokens.a.$value;
const newKey: DesignToken.Values.Color = extended.tokens.c.$value;

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
type OverrideTypes = [
    Expect<Equal<typeof overridden.tokens, typeof library.tokens>>,
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
// Inferred token values are typed by their literal, not their declared type.
// Tighten to `DesignToken.Values.Color` once inferred values are validated (#37).
const newToken: DesignToken.Values.Color = groupedExtended.tokens.c.$value;

// Enable once Dimension accepts "rem" and rejects "rm" (#26).
// This can't be skipped at runtime because it is a compile-time check.
// const rem: DesignToken.Values.Dimension = rem(1);
// // @ts-expect-error
// const rm: DesignToken.Values.Dimension = rem(1);

// Enable once token values are deeply readonly at compile time (#24).
// // @ts-expect-error top-level property is readonly
// library.tokens.border.$value.width = px(2);
// // @ts-expect-error nested properties are readonly
// library.tokens.border.$value.style = "dashed";
// const gradient = Library.create({
//     g: { $type: DesignToken.Type.Gradient, $value: [{ color: hex("#111111"), position: 0 }] },
// });
// // @ts-expect-error arrays are readonly
// gradient.tokens.g.$value.push({ color: hex("#222222"), position: 1 });
// // @ts-expect-error array items are readonly
// gradient.tokens.g.$value[0].position = 1;

Types("type-level assertions compile", () => {
    Assert.ok([invalidConfig, color, notNumber, sourceKey, newKey, newToken]);
});

Types.run();
