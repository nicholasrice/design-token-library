import { suite } from "uvu";
import * as Assert from "uvu/assert";
import { DesignToken } from "../lib/design-token.js";
import { Library } from "../lib/library.js";
import { A, AB } from "./helpers.js";

const Create = suite("Library.create");
const C = DesignToken.Type.Color;

Create("name is the full path for deeply nested tokens", () => {
    interface Theme {
        a: { b: { c: { d: DesignToken.Color } } };
    }
    const library = Library.create<Theme>({
        a: { b: { c: { d: { type: C, value: "#111111" } } } },
    });

    Assert.is(library.tokens.a.b.c.d.name, "a.b.c.d");
});

Create("type is inherited through multiple group levels", () => {
    interface Theme {
        g: { type: DesignToken.Type.Color; h: { i: { t: DesignToken.Color } } };
    }
    const library = Library.create<Theme>({
        g: { type: C, h: { i: { t: { value: "#111111" } } } },
    });

    Assert.is(library.tokens.g.h.i.t.type, C);
});

Create(
    "a nested group type overrides the outer group type for its descendants only",
    () => {
        interface Theme {
            g: {
                type: DesignToken.Type.Dimension;
                inner: { type: DesignToken.Type.Color; t: DesignToken.Color };
                sibling: DesignToken.Dimension;
            };
        }
        const library = Library.create<Theme>({
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
    "throws for a nested token with no type in any ancestor, naming the token",
    () => {
        interface Theme {
            g: { h: { t: DesignToken.Color } };
        }
        Assert.throws(
            () =>
                Library.create<Theme>({
                    g: { h: { t: { value: "#111111" } } },
                }),
            /'t'/,
        );
    },
);

Create("description defaults to an empty string", () => {
    const library = Library.create<A>({ a: { type: C, value: "#111111" } });

    Assert.is(library.tokens.a.description, "");
});

Create("extensions defaults to an empty object unique to each token", () => {
    const library = Library.create<AB>({
        a: { type: C, value: "#111111" },
        b: { type: C, value: "#222222" },
    });

    Assert.equal(library.tokens.a.extensions, {});
    Assert.is.not(library.tokens.a.extensions, library.tokens.b.extensions);
});

Create("a group's 'type' key is not an enumerable group member", () => {
    interface Theme {
        g: { type: DesignToken.Type.Color; a: DesignToken.Color };
    }
    const library = Library.create<Theme>({
        g: { type: C, a: { value: "#111111" } },
    });

    Assert.not.ok(Object.keys(library.tokens.g).includes("type"));
});

Create(
    "group keys are exactly its tokens and subgroups in declaration order",
    () => {
        interface Theme {
            g: {
                type: DesignToken.Type.Color;
                b: DesignToken.Color;
                a: DesignToken.Color;
                sub: { c: DesignToken.Color };
            };
        }
        const library = Library.create<Theme>({
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

const tokensOfEveryType: DesignToken.Any[] = [
    {
        type: DesignToken.Type.Border,
        value: { color: "#111111", width: "1px", style: "solid" },
    },
    { type: DesignToken.Type.Color, value: "#111111" },
    { type: DesignToken.Type.CubicBezier, value: [0, 0.5, 0.9, 1] },
    { type: DesignToken.Type.Dimension, value: "2px" },
    { type: DesignToken.Type.Duration, value: "100ms" },
    { type: DesignToken.Type.FontFamily, value: ["Comic Sans", "serif"] },
    { type: DesignToken.Type.FontWeight, value: "bold" },
    {
        type: DesignToken.Type.Gradient,
        value: [
            { color: "#111111", position: 0 },
            { color: "#222222", position: 1 },
        ],
    },
    { type: DesignToken.Type.Number, value: 12 },
    {
        type: DesignToken.Type.Shadow,
        value: {
            color: "#111111",
            offsetX: "0px",
            offsetY: "1px",
            blur: "2px",
            spread: "3px",
        },
    },
    {
        type: DesignToken.Type.StrokeStyle,
        value: { dashArray: ["1px", "2px"], lineCap: "round" },
    },
    {
        type: DesignToken.Type.Transition,
        value: {
            duration: "100ms",
            delay: "0ms",
            timingFunction: [0, 0, 1, 1],
        },
    },
    {
        type: DesignToken.Type.Typography,
        value: {
            fontFamily: "Arial",
            fontSize: "12px",
            fontWeight: 400,
            letterSpacing: "0px",
            lineHeight: 1.2,
        },
    },
];

for (const token of tokensOfEveryType) {
    Create(`${token.type} round-trips type and value`, () => {
        const library = Library.create<{ token: DesignToken.Any }>({ token });

        Assert.is(library.tokens.token.type, token.type);
        Assert.equal(library.tokens.token.value, token.value);
    });
}

Create.skip("the root token library is frozen (fails: #23)", () => {
    const library = Library.create<A>({ a: { type: C, value: "#111111" } });

    Assert.ok(Object.isFrozen(library.tokens));
    Assert.throws(
        // @ts-expect-error the root has no 'z' key
        () => (library.tokens.z = 1),
        "adding a key throws",
    );
    Assert.throws(
        // @ts-expect-error tokens are readonly
        () => delete library.tokens.a,
        "deleting a key throws",
    );
});

Create("a null config entry is ignored, not thrown", () => {
    const library = Library.create({
        // @ts-expect-error the config types reject null entries
        a: null,
        b: { type: C, value: "#111111" },
    });

    Assert.equal(Object.keys(library.tokens), ["b"]);
});

Create("an undefined config entry is ignored, not thrown", () => {
    const library = Library.create({
        // @ts-expect-error the config types reject undefined entries
        a: undefined,
        b: { type: C, value: "#111111" },
    });

    Assert.equal(Object.keys(library.tokens), ["b"]);
});

Create("a number config entry is ignored, not thrown", () => {
    const library = Library.create({
        a: 12,
        b: { type: C, value: "#111111" },
    });

    Assert.equal(Object.keys(library.tokens), ["b"]);
});

Create("a string config entry is ignored, not thrown", () => {
    const library = Library.create({
        a: "x",
        b: { type: C, value: "#111111" },
    });

    Assert.equal(Object.keys(library.tokens), ["b"]);
});

Create("a boolean config entry is ignored, not thrown", () => {
    const library = Library.create({
        a: true,
        b: { type: C, value: "#111111" },
    });

    Assert.equal(Object.keys(library.tokens), ["b"]);
});

Create("a function config entry is ignored, not thrown", () => {
    const library = Library.create({
        a: () => "#111111",
        b: { type: C, value: "#111111" },
    });

    Assert.equal(Object.keys(library.tokens), ["b"]);
});

Create("non-token entries inside a group are ignored", () => {
    const library = Library.create({
        // @ts-expect-error the config types reject null entries
        g: { type: C, x: 1, y: null, t: { value: "#111111" } },
    });

    Assert.equal(Object.keys(library.tokens.g), ["t"]);
});

Create("non-token entries in an extend config are ignored", () => {
    const source = Library.create<A>({ a: { type: C, value: "#111111" } });
    const extended = source.extend({
        n: 12,
        // @ts-expect-error the config types reject null entries
        x: null,
    });

    Assert.equal(Object.keys(extended.tokens), ["a"]);
});

Create.skip(
    "an array config entry is ignored, not treated as a group (fails: #20)",
    () => {
        const library = Library.create({
            a: [1, 2],
            b: { type: C, value: "#111111" },
        });

        Assert.equal(Object.keys(library.tokens), ["b"]);
    },
);

Create("an empty group is kept", () => {
    const library = Library.create({
        g: {},
        b: { type: C, value: "#111111" },
    });

    Assert.equal(Object.keys(library.tokens), ["g", "b"]);
    Assert.equal(Object.keys(library.tokens.g), []);
});

Create("a group of only non-token entries is kept, without them", () => {
    const library = Library.create({
        // @ts-expect-error the config types reject null entries
        g: { x: 1, y: null },
        b: { type: C, value: "#111111" },
    });

    Assert.equal(Object.keys(library.tokens), ["g", "b"]);
    Assert.equal(Object.keys(library.tokens.g), []);
});

Create("a group with only a type is kept", () => {
    interface Theme {
        g: { type: DesignToken.Type.Color };
        b: DesignToken.Color;
    }
    const library = Library.create<Theme>({
        g: { type: C },
        b: { type: C, value: "#111111" },
    });

    Assert.equal(Object.keys(library.tokens), ["g", "b"]);
    Assert.equal(Object.keys(library.tokens.g), []);
});

Create("a group of only empty subgroups is kept", () => {
    const library = Library.create({
        g: { h: {}, i: { j: {} } },
        b: { type: C, value: "#111111" },
    });

    Assert.equal(Object.keys(library.tokens), ["g", "b"]);
    Assert.equal(Object.keys(library.tokens.g), ["h", "i"]);
});

Create("a group keeps both its tokens and its empty subgroups", () => {
    interface Theme {
        g: { type: DesignToken.Type.Color; empty: {}; t: DesignToken.Color };
    }
    const library = Library.create<Theme>({
        g: { type: C, empty: {}, t: { value: "#111111" } },
    });

    Assert.equal(Object.keys(library.tokens.g), ["empty", "t"]);
});

Create("libraries created from the same config are independent", () => {
    const config: Library.Config<A> = { a: { type: C, value: "#111111" } };
    const first = Library.create(config);
    const second = Library.create(config);

    first.tokens.a.set("#222222");

    Assert.is(first.tokens.a.value, "#222222");
    Assert.is(second.tokens.a.value, "#111111");
});

Create.skip(
    "toString() returns a JSON representation of the token (fails: #17)",
    () => {
        interface Theme {
            g: { type: DesignToken.Type.Color; a: DesignToken.Color };
        }
        const library = Library.create<Theme>({
            g: {
                type: C,
                a: {
                    value: "#111111",
                    description: "primary",
                    extensions: { k: 1 },
                },
            },
        });

        Assert.equal(JSON.parse(String(library.tokens.g.a)), {
            name: "g.a",
            type: C,
            value: "#111111",
            description: "primary",
            extensions: { k: 1 },
        });
    },
);

Create.skip(
    "toString() serializes the resolved value of an alias token (fails: #17)",
    () => {
        interface Theme {
            a: DesignToken.Color;
            b: DesignToken.Color;
            border: DesignToken.Border;
        }
        const library = Library.create<Theme>({
            a: { type: C, value: "#111111" },
            b: { type: C, value: (context) => context.a },
            border: {
                type: DesignToken.Type.Border,
                value: {
                    color: (context) => context.a,
                    width: "1px",
                    style: "solid",
                },
            },
        });

        Assert.is(JSON.parse(String(library.tokens.b)).value, "#111111");
        Assert.equal(JSON.parse(String(library.tokens.border)).value, {
            color: "#111111",
            width: "1px",
            style: "solid",
        });
    },
);

Create.skip(
    "toString() reflects the current value after set() (fails: #17)",
    () => {
        const library = Library.create<A>({ a: { type: C, value: "#111111" } });

        library.tokens.a.set("#222222");

        Assert.is(JSON.parse(String(library.tokens.a)).value, "#222222");
    },
);

Create.run();
