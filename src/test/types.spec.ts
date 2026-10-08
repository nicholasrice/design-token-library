/**
 * Type-level tests. These are enforced by `tsc -b`: a `@ts-expect-error`
 * that no longer errors, or a valid assignment that errors, fails the build.
 */
import { suite } from "uvu";
import * as Assert from "uvu/assert";
import { DesignToken } from "../lib/design-token.js";
import { Library } from "../lib/library.js";

const Types = suite("Type-level API");

interface Theme {
    a: DesignToken.Color;
    b: DesignToken.Color;
    border: DesignToken.Border;
}

const config: Library.Config<Theme> = {
    a: { type: DesignToken.Type.Color, value: "#111111" },
    // [Y2] Alias values are accepted
    b: { type: DesignToken.Type.Color, value: (context) => context.a },
    border: {
        type: DesignToken.Type.Border,
        // [Y2] Deep alias values are accepted
        value: {
            color: (context) => context.a,
            width: "1px",
            style: "solid",
        },
    },
};

const invalidConfig: Library.Config<Theme> = {
    // @ts-expect-error [Y1] a Color token rejects a number value
    a: { type: DesignToken.Type.Color, value: 12 },
    b: { type: DesignToken.Type.Color, value: "#111111" },
    border: config.border,
};

const library = Library.create(config);

// [Y3] Token values are typed by token type
const color: DesignToken.Values.Color = library.tokens.a.value;
// @ts-expect-error [Y3] a Color value is not a number
const notNumber: number = library.tokens.a.value;

// [Y4] extend<K> exposes both source and new keys
interface Extension {
    c: DesignToken.Color;
}
const extended = library.extend<Extension>({
    c: { type: DesignToken.Type.Color, value: "#333333" },
});
const sourceKey: DesignToken.Values.Color = extended.tokens.a.value;
const newKey: DesignToken.Values.Color = extended.tokens.c.value;

// @ts-expect-error [Y5] set() rejects a mismatched value type
library.tokens.a.set(12);

// [Y6] (fails: U8) Enable once Dimension accepts "rem" and rejects "rm".
// This can't be skipped at runtime because it is a compile-time check.
// const rem: DesignToken.Values.Dimension = "1rem";
// // @ts-expect-error
// const rm: DesignToken.Values.Dimension = "1rm";

// [Y7] (fails: U4) Enable once token values are deeply readonly at compile time.
// // @ts-expect-error top-level property is readonly
// library.tokens.border.value.width = "2px";
// // @ts-expect-error nested properties are readonly
// library.tokens.border.value.style = "dashed";
// const gradient = Library.create({
//     g: { type: DesignToken.Type.Gradient, value: [{ color: "#111111", position: 0 }] },
// });
// // @ts-expect-error arrays are readonly
// gradient.tokens.g.value.push({ color: "#222222", position: 1 });
// // @ts-expect-error array items are readonly
// gradient.tokens.g.value[0].position = 1;

Types("type-level assertions compile", () => {
    Assert.ok([invalidConfig, color, notNumber, sourceKey, newKey]);
});

Types.run();
