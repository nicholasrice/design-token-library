import { suite } from "uvu";
import * as Assert from "uvu/assert";
import {
    CSSConverter,
    CSSPropertyValues,
    convert,
    toCSS,
    toProperties,
} from "../lib/css-reflector.js";
import { DesignToken } from "../lib/design-token.js";
import { Library } from "../lib/library.js";
import { Equal, Expect } from "./helpers.js";
import { hex, px } from "./values.js";

const Records = suite("a converter that returns a record");

type Color = DesignToken.Values.Readonly.Color;

/**
 * A value for each state of a component, the first case of #64.
 */
interface States {
    rest: Color;
    hover: Color;
    active: Color;
}

interface Theme {
    fill: DesignToken.Custom<"states", States>;
    accent: {
        $root: DesignToken.Custom<"states", States>;
    };
    text: DesignToken.Typography;
    size: DesignToken.Dimension;
}

const library = () =>
    Library.create<Theme>({
        fill: {
            $type: "states",
            $value: {
                rest: hex("#111111"),
                hover: hex("#222222"),
                active: hex("#333333"),
            },
        },
        accent: {
            $root: {
                $type: "states",
                $value: {
                    rest: hex("#aa0000"),
                    hover: hex("#bb0000"),
                    active: hex("#cc0000"),
                },
            },
        },
        text: {
            $type: DesignToken.Type.Typography,
            $value: {
                fontFamily: "Inter",
                fontSize: px(14),
                fontWeight: 400,
                letterSpacing: px(0.5),
                lineHeight: 1.5,
            },
        },
        size: { $type: DesignToken.Type.Dimension, $value: px(4) },
    });

const converters = {
    states: (value: States) => ({
        "": convert("color", value.rest),
        hover: convert("color", value.hover),
        active: convert("color", value.active),
    }),
    // The second case of #64: a property for each field of a typography.
    typography: (value: DesignToken.Values.Readonly.Typography) => ({
        family: convert("fontFamily", value.fontFamily),
        size: convert("dimension", value.fontSize),
        "letter-spacing": convert("dimension", value.letterSpacing),
    }),
};

Records("toCSS writes a property for each key, named by the token's", () => {
    Assert.is(
        toCSS(library(), { converters }),
        "--fill:#111111;--fill-hover:#222222;--fill-active:#333333;" +
            "--accent:#aa0000;--accent-hover:#bb0000;--accent-active:#cc0000;" +
            "--text-family:Inter;--text-size:14px;--text-letter-spacing:0.5px;" +
            "--size:4px;",
    );
});

Records("a string is the record of the token's own property", () => {
    const strings = Library.create<{ size: DesignToken.Dimension }>({
        size: { $type: DesignToken.Type.Dimension, $value: px(4) },
    });

    Assert.is(
        toCSS(strings, { converters: { dimension: () => ({ "": "4px" }) } }),
        toCSS(strings, { converters: { dimension: () => "4px" } }),
    );
});

Records("an empty record writes no property", () => {
    Assert.is(
        toCSS(library(), {
            converters: { ...converters, states: () => ({}) },
        }),
        "--text-family:Inter;--text-size:14px;--text-letter-spacing:0.5px;--size:4px;",
    );
});

Records("the name option names the token, and the keys follow it", () => {
    Assert.match(
        toCSS(library(), {
            converters,
            name: (token) => `x-${token.name.replaceAll(".", "_")}`,
        }),
        "--x-fill:#111111;--x-fill-hover:#222222;",
    );
});

Records("toProperties has a property for each key", () => {
    const properties = toProperties(library(), { converters });

    Assert.equal(properties.fill.var, "var(--fill)");
    Assert.equal(properties.fill.property, "--fill");
    Assert.equal(properties.fill.hover, {
        var: "var(--fill-hover)",
        property: "--fill-hover",
    });
    Assert.is(properties.accent.$root.active.property, "--accent-active");
    Assert.is(
        properties.text["letter-spacing"].var,
        "var(--text-letter-spacing)",
    );
    Assert.equal(Object.keys(properties.fill), [
        "var",
        "property",
        "hover",
        "active",
    ]);
    Assert.ok(Object.isFrozen(properties.fill));
    Assert.ok(Object.isFrozen(properties.fill.hover));
});

Records("toProperties is typed by the keys a converter returns", () => {
    const properties = toProperties(library(), { converters });

    type Fill = typeof properties.fill;
    type Text = typeof properties.text;
    type _ = Expect<
        Equal<
            Fill,
            CSSPropertyValues & {
                readonly hover: CSSPropertyValues;
                readonly active: CSSPropertyValues;
            }
        >
    >;
    // No `""` key, so no property of its own.
    type __ = Expect<Equal<keyof Text, "family" | "size" | "letter-spacing">>;
    type ___ = Expect<Equal<typeof properties.size, CSSPropertyValues>>;

    // @ts-expect-error a typography written as its fields has no `var`
    properties.text.var;
});

Records(
    "a converter typed CSSConverter has its own property in the type",
    () => {
        const states: CSSConverter<States> = (value) => ({
            "": convert("color", value.rest),
            hover: convert("color", value.hover),
        });
        const properties = toProperties(library(), { converters: { states } });

        type _ = Expect<Equal<typeof properties.fill, CSSPropertyValues>>;
        // The others are there at runtime.
        Assert.is(
            Reflect.get(properties.fill, "hover").property,
            "--fill-hover",
        );
    },
);

Records("toProperties reads only the tokens whose type has a converter", () => {
    const read: string[] = [];
    toProperties(library(), {
        converters: {
            states: (value: States, token: Library.Token<any, any>) => {
                read.push(token.name);
                return convert("color", value.rest);
            },
        },
    });

    Assert.equal(read, ["fill", "accent.$root"]);
});

Records("a key can't be a field of the properties of a token", () => {
    Assert.throws(
        () =>
            toProperties(library(), {
                converters: { states: () => ({ var: "red" }) },
            }),
        /'var' for token 'fill'/,
    );
});

Records("a token whose type is false is still left out", () => {
    const properties = toProperties(library(), {
        converters: { ...converters, states: false },
    });

    Assert.not.ok("fill" in properties);
    Assert.ok("text" in properties);
});

Records.run();
