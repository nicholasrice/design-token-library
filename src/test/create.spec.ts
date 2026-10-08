import { suite } from "uvu";
import * as Assert from "uvu/assert";
import { DesignToken } from "../lib/design-token.js";
import { createUntyped } from "./helpers.js";

const Create = suite("Library.create");
const C = DesignToken.Type.Color;

Create("[C1] name is the full path for deeply nested tokens", () => {
    const library = createUntyped({
        a: { b: { c: { d: { type: C, value: "#111111" } } } },
    });

    Assert.is(library.tokens.a.b.c.d.name, "a.b.c.d");
});

Create("[C2] type is inherited through multiple group levels", () => {
    const library = createUntyped({
        g: { type: C, h: { i: { t: { value: "#111111" } } } },
    });

    Assert.is(library.tokens.g.h.i.t.type, C);
});

Create(
    "[C3] a nested group type overrides the outer group type for its descendants only",
    () => {
        const library = createUntyped({
            g: {
                type: DesignToken.Type.Dimension,
                inner: { type: C, t: { value: "#111111" } },
                sibling: { value: "1px" },
            },
        });

        Assert.is(library.tokens.g.inner.t.type, C);
        Assert.is(library.tokens.g.sibling.type, DesignToken.Type.Dimension);
    },
);

Create(
    "[C4] throws for a nested token with no type in any ancestor, naming the token",
    () => {
        Assert.throws(
            () => createUntyped({ g: { h: { t: { value: "#111111" } } } }),
            /'t'/,
        );
    },
);

Create("[C5] description defaults to an empty string", () => {
    const library = createUntyped({ a: { type: C, value: "#111111" } });

    Assert.is(library.tokens.a.description, "");
});

Create(
    "[C6] extensions defaults to an empty object unique to each token",
    () => {
        const library = createUntyped({
            a: { type: C, value: "#111111" },
            b: { type: C, value: "#222222" },
        });

        Assert.equal(library.tokens.a.extensions, {});
        Assert.is.not(library.tokens.a.extensions, library.tokens.b.extensions);
    },
);

Create("[C7] a group's 'type' key is not an enumerable group member", () => {
    const library = createUntyped({
        g: { type: C, a: { value: "#111111" } },
    });

    Assert.not.ok(Object.keys(library.tokens.g).includes("type"));
});

Create(
    "[C8] group keys are exactly its tokens and subgroups in declaration order",
    () => {
        const library = createUntyped({
            g: {
                type: C,
                b: { value: "#222222" },
                a: { value: "#111111" },
                sub: { c: { value: "#333333" } },
            },
        });

        Assert.equal(Object.keys(library.tokens.g), ["b", "a", "sub"]);
    },
);

const valuesByType: Array<[DesignToken.Type, DesignToken.Values.Any]> = [
    [
        DesignToken.Type.Border,
        { color: "#111111", width: "1px", style: "solid" },
    ],
    [DesignToken.Type.Color, "#111111"],
    [DesignToken.Type.CubicBezier, [0, 0.5, 0.9, 1]],
    [DesignToken.Type.Dimension, "2px"],
    [DesignToken.Type.Duration, "100ms"],
    [DesignToken.Type.FontFamily, ["Comic Sans", "serif"]],
    [DesignToken.Type.FontWeight, "bold"],
    [
        DesignToken.Type.Gradient,
        [
            { color: "#111111", position: 0 },
            { color: "#222222", position: 1 },
        ],
    ],
    [DesignToken.Type.Number, 12],
    [
        DesignToken.Type.Shadow,
        {
            color: "#111111",
            offsetX: "0px",
            offsetY: "1px",
            blur: "2px",
            spread: "3px",
        },
    ],
    [
        DesignToken.Type.StrokeStyle,
        { dashArray: ["1px", "2px"], lineCap: "round" },
    ],
    [
        DesignToken.Type.Transition,
        { duration: "100ms", delay: "0ms", timingFunction: [0, 0, 1, 1] },
    ],
    [
        DesignToken.Type.Typography,
        {
            fontFamily: "Arial",
            fontSize: "12px",
            fontWeight: 400,
            letterSpacing: "0px",
            lineHeight: 1.2,
        },
    ],
];

for (const [type, value] of valuesByType) {
    Create(`[C9] ${type} round-trips type and value`, () => {
        const library = createUntyped({ token: { type, value } });

        Assert.is(library.tokens.token.type, type);
        Assert.equal(library.tokens.token.value, value);
    });
}

Create.skip("[C10] the root token library is frozen (fails: U3)", () => {
    const library = createUntyped({ a: { type: C, value: "#111111" } });

    Assert.ok(Object.isFrozen(library.tokens));
    Assert.throws(() => (library.tokens.z = 1), "adding a key throws");
    Assert.throws(() => delete library.tokens.a, "deleting a key throws");
});

const nonTokenValues: Array<[string, unknown]> = [
    ["null", null],
    ["undefined", undefined],
    ["number", 12],
    ["string", "x"],
    ["boolean", true],
    ["function", () => "#111111"],
];

for (const [label, value] of nonTokenValues) {
    Create(`[C11a] a ${label} config entry is ignored, not thrown`, () => {
        const library = createUntyped({
            a: value,
            b: { type: C, value: "#111111" },
        });

        Assert.equal(Object.keys(library.tokens), ["b"]);
        Assert.not.ok("a" in library.tokens);
    });
}

Create("[C11b] non-token entries inside a group are ignored", () => {
    const library = createUntyped({
        g: { type: C, x: 1, y: null, t: { value: "#111111" } },
    });

    Assert.equal(Object.keys(library.tokens.g), ["t"]);
});

Create("[C11c] non-token entries in an extend config are ignored", () => {
    const extended = createUntyped({
        b: { type: C, value: "#111111" },
    }).extend({ a: null, n: 12 });

    Assert.equal(Object.keys(extended.tokens), ["b"]);
});

Create.skip(
    "[C11d] an array config entry is ignored, not treated as a group (fails: D15)",
    () => {
        const library = createUntyped({
            a: [1, 2],
            b: { type: C, value: "#111111" },
        });

        Assert.equal(Object.keys(library.tokens), ["b"]);
    },
);

Create("[C13] libraries created from the same config are independent", () => {
    const config = { a: { type: C, value: "#111111" } };
    const first = createUntyped(config);
    const second = createUntyped(config);

    first.tokens.a.set("#222222");

    Assert.is(first.tokens.a.value, "#222222");
    Assert.is(second.tokens.a.value, "#111111");
});

Create.skip(
    "[C14][DECIDE: D11] toString() returns a meaningful string (fails: D11)",
    () => {
        const library = createUntyped({ a: { type: C, value: "#111111" } });
        const result = String(library.tokens.a);

        Assert.type(result, "string");
        Assert.is.not(result, "[object Object]");
    },
);

Create.run();
