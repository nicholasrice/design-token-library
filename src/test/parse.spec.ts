import { readFileSync } from "node:fs";
import { suite } from "uvu";
import * as Assert from "uvu/assert";
import { DesignToken } from "../lib/design-token.js";
import { ParseError, parse, type ParseOptions } from "../lib/parse.js";
import { Library } from "../lib/library.js";
import { toCSS } from "../lib/css-reflector.js";
import { isRef, refs } from "../lib/ref.js";
import { override, recipes } from "../lib/recipe.js";
import { byIdentity } from "./helpers.js";
import { createBase } from "./parse.fixtures.js";
import { hex, px } from "./values.js";

// The fixtures live in src/, and the tests run from dist/.
const fixture = (name: string): any =>
    JSON.parse(
        readFileSync(
            new URL(
                `../../src/test/tokens/${name}.tokens.json`,
                import.meta.url,
            ),
            "utf8",
        ),
    );

// The tests don't declare the shapes of the documents, so their libraries
// have no typed tokens, and no custom types to give toCSS converters for.
const create = (
    document: object,
    options: ParseOptions = {},
): Library.Library<{}> =>
    Library.create<{}>(parse(document, options), { types: options.types });

const tokensOf = (document: object, options = {}): any =>
    create(document, options).tokens;

const load = (name: string, options = {}): any =>
    tokensOf(fixture(name), options);

const Format = suite("parse.format");
const Types = suite("parse.types");
const Aliases = suite("parse.aliases");
const Metadata = suite("parse.metadata");
const ColorModule = suite("parse.color");
const Extends = suite("parse.extends");
const Pointers = suite("parse.pointers");
const Custom = suite("parse.custom");
const Recipes = suite("parse.recipes");
const Compliant = suite("parse.compliant");
const Extending = suite("parse.extending");
const Invalid = suite("parse.invalid");

const srgb = (...components: number[]) => ({ colorSpace: "srgb", components });

// --- Types: every value in format.tokens.json is read as written -----------

Types("reads a token of every standard type", () => {
    const tokens = load("format");
    const seen = new Set<string>();
    const visit = (group: any) => {
        for (const key of Object.keys(group)) {
            if (group[key].name !== undefined) {
                seen.add(group[key].$type);
            } else {
                visit(group[key]);
            }
        }
    };

    visit(tokens);

    for (const type of Object.values(DesignToken.Type)) {
        Assert.ok(seen.has(type), `no ${type} token was read`);
    }
});

Types("a color keeps its color space, components, alpha and hex", () => {
    const { color } = load("format");

    Assert.equal(color.blue.$value, {
        colorSpace: "srgb",
        components: [0, 0.4, 1],
        hex: "#0066ff",
    });
    Assert.is(color.red.$value.alpha, 0.9);
});

Types("a dimension keeps its value and unit, including 0", () => {
    const { size } = load("format");

    Assert.equal(size.small.$value, { value: 4, unit: "px" });
    Assert.equal(size.base.$value, { value: 1, unit: "rem" });
    Assert.equal(size.zero.$value, { value: 0, unit: "px" });
    Assert.equal(size.nested.wide.$value, { value: 24.5, unit: "px" });
});

Types("a duration is in milliseconds or seconds", () => {
    const { time } = load("format");

    Assert.equal(time.fast.$value, { value: 100, unit: "ms" });
    Assert.equal(time.slow.$value, { value: 0.5, unit: "s" });
});

Types("a font family is a name or a list of names", () => {
    const { font } = load("format");

    Assert.equal(font.sans.$value, ["Helvetica Neue", "Arial", "sans-serif"]);
    Assert.is(font.mono.$value, "Menlo");
});

Types("a font weight is a number or a keyword", () => {
    const { font } = load("format");

    Assert.is(font.weight.numeric.$value, 700);
    Assert.is(font.weight.keyword.$value, "semi-bold");
});

Types("a number can be fractional or negative", () => {
    const { number } = load("format");

    Assert.is(number.ratio.$value, 1.618);
    Assert.is(number.negative.$value, -2);
});

Types("a cubic Bézier can have y coordinates outside 0 to 1", () => {
    const { motion } = load("format");

    Assert.equal(motion.ease.$value, [0.4, 0, 0.2, 1]);
    Assert.equal(motion.overshoot.$value, [0.5, -0.5, 0.5, 1.5]);
});

Types("a stroke style is a keyword or a dash array with a line cap", () => {
    const { stroke } = load("format");

    Assert.is(stroke.solid.$value, "solid");
    Assert.equal(stroke.dashed.$value, {
        dashArray: [
            { value: 4, unit: "px" },
            { value: 4, unit: "px" },
        ],
        lineCap: "round",
    });
});

Types("a shadow can be one layer, or layers that are inset", () => {
    const { shadow } = load("format");

    Assert.equal(shadow.card.$value, {
        color: { colorSpace: "srgb", components: [0, 0, 0], alpha: 0.2 },
        offsetX: { value: 0, unit: "px" },
        offsetY: { value: 2, unit: "px" },
        blur: { value: 4, unit: "px" },
        spread: { value: 0, unit: "px" },
    });
    Assert.is(shadow.layered.$value.length, 2);
    Assert.equal(shadow.layered.$value[0], shadow.card.$value);
    Assert.is(shadow.layered.$value[1].inset, true);
});

Types("a gradient is a list of stops from 0 to 1", () => {
    const { gradient } = load("format");

    Assert.equal(
        gradient.sky.$value.map((stop: any) => stop.position),
        [0, 0.5, 1],
    );
});

// --- Aliases ---------------------------------------------------------------

Aliases("an alias takes the value of the token it names", () => {
    const { color, size } = load("format");

    Assert.equal(color.primary.$value, color.blue.$value);
    Assert.equal(size.gap.$value, size.small.$value);
});

Aliases("a reference is read as a ref to the token it names", () => {
    const config = parse(fixture("format"));

    Assert.ok(isRef(config.color.primary.$value));
    Assert.ok(isRef(config.border.thin.$value.color));
});

Aliases("an alias can name another alias", () => {
    const { color } = load("format");

    Assert.equal(color.link.$value, color.blue.$value);
});

Aliases("an alias takes the type of the token it names", () => {
    const { font } = load("format");

    // font.weight has no $type, so it comes from the alias.
    Assert.is(font.weight.alias.$type, DesignToken.Type.FontWeight);
    Assert.is(font.weight.alias.$value, "semi-bold");
});

Aliases("an alias follows its target when the target changes", () => {
    const { color } = load("format");
    const green = srgb(0, 1, 0);

    color.blue.set(green);

    Assert.equal(color.primary.$value, green);
    Assert.equal(color.link.$value, green);
    Assert.equal(color["🎨 palette"].$value, color["Hot pink"].$value);
});

Aliases("aliases work inside a composite value", () => {
    const { font, motion, border, color } = load("format");

    Assert.equal(font.body.$value, {
        fontFamily: ["Helvetica Neue", "Arial", "sans-serif"],
        fontSize: { value: 1, unit: "rem" },
        fontWeight: 700,
        letterSpacing: { value: 0, unit: "px" },
        lineHeight: 1.5,
    });
    Assert.equal(motion.default.$value, {
        duration: { value: 100, unit: "ms" },
        delay: { value: 0, unit: "ms" },
        timingFunction: [0.4, 0, 0.2, 1],
    });
    Assert.equal(border.thin.$value.color, color.blue.$value);
    // A dash array, and a border style that is an alias of a stroke style.
    Assert.equal(border.dashed.$value.style, {
        dashArray: [
            { value: 4, unit: "px" },
            { value: 4, unit: "px" },
        ],
        lineCap: "round",
    });
    Assert.equal(border.dashed.$value.width, { value: 4, unit: "px" });
});

Aliases("a shadow can alias a shadow and its fields", () => {
    const { shadow, color, size } = load("format");
    const inset = shadow.layered.$value[1];

    Assert.equal(inset.color, color.blue.$value);
    Assert.equal(inset.blur, size.small.$value);
});

Aliases("a gradient stop can alias a color and a position", () => {
    const { gradient, color } = load("format");

    Assert.equal(gradient.sky.$value[0].color, color.blue.$value);
    Assert.is(gradient.sky.$value[1].position, 0.5);
});

// --- Type resolution -------------------------------------------------------

Format("a token inherits the $type of its group, however deep", () => {
    const { color, size } = load("format");

    Assert.is(color.blue.$type, "color");
    Assert.is(size.nested.wide.$type, "dimension");
});

Format("a token's own $type wins over its group's", () => {
    const { override } = load("format");

    Assert.is(override.inherited.$type, "number");
    Assert.is(override.explicit.$type, "dimension");
});

Format("a name is case sensitive and can hold spaces and emoji", () => {
    const { color } = load("format");

    Assert.is(color["Hot pink"].name, "color.Hot pink");
    Assert.is(color["hot pink"].name, "color.hot pink");
    Assert.not.equal(color["Hot pink"].$value, color["hot pink"].$value);
    Assert.equal(color["🎨 palette"].$value, color["Hot pink"].$value);
});

Format("a group's $root is a token named for the group", () => {
    const { color } = load("format");

    Assert.is(color.accent.$root.name, "color.accent.$root");
    Assert.equal(color.accent.$root.$value, color.blue.$value);
    Assert.is(color.accent.$root.$type, "color");
    Assert.equal(Object.keys(color.accent), ["$root", "light"]);
});

Format("a $root token is written to CSS under its group's name", () => {
    const css = toCSS(create(fixture("format")));

    Assert.ok(css.includes("--color-accent:#0066ff;"), css);
    Assert.ok(css.includes("--color-accent-light:#99ccff;"), css);
});

Format("every token reflects to CSS", () => {
    const css = toCSS(create(fixture("format")));

    Assert.not.match(css, "[object Object]");
    Assert.not.match(css, "undefined");
});

interface Shape {
    color: {
        $type: DesignToken.Type.Color;
        blue: DesignToken.Color;
        primary: DesignToken.Color;
    };
    size: {
        $type: DesignToken.Type.Dimension;
        small: DesignToken.Dimension;
        border: DesignToken.Border;
    };
}

Format("a document is the library its TypeScript config is", () => {
    const $ = refs<Shape>();
    const parsed = create({
        color: {
            $type: "color",
            blue: { $value: srgb(0, 0.4, 1) },
            primary: { $value: "{color.blue}" },
        },
        size: {
            $type: "dimension",
            small: { $value: { value: 4, unit: "px" } },
            border: {
                $type: "border",
                $value: {
                    color: "{color.primary}",
                    width: "{size.small}",
                    style: "solid",
                },
            },
        },
    });
    const written = Library.create<Shape>({
        color: {
            $type: DesignToken.Type.Color,
            blue: { $value: hex("#0066ff") },
            primary: { $value: $.color.blue },
        },
        size: {
            $type: DesignToken.Type.Dimension,
            small: { $value: px(4) },
            border: {
                $type: DesignToken.Type.Border,
                $value: {
                    color: $.color.primary,
                    width: $.size.small,
                    style: "solid",
                },
            },
        },
    });

    Assert.is(toCSS(parsed), toCSS(written));
});

Format("a document can be given as an object, and is not changed", () => {
    const document = fixture("format");
    const before = JSON.stringify(document);

    create(document).tokens;

    Assert.is(JSON.stringify(document), before);
});

// --- Metadata --------------------------------------------------------------

Metadata("a token has a description and extensions", () => {
    const { color } = load("format");

    Assert.is(color.blue.$description, "The primary blue.");
    Assert.equal(color.blue.$extensions, {
        "com.example.figma": { id: "VariableID:1:2" },
    });
    Assert.is(color.red.$description, "");
    Assert.equal(color.red.$extensions, {});
});

Metadata("a group has a description, extensions and type", () => {
    const { color } = load("format");

    Assert.is(
        color.$description,
        "Brand colors. Every token in this group is a color.",
    );
    Assert.equal(color.$extensions, {
        "com.example.group": { figmaCollection: "Brand" },
    });
    Assert.is(color.$type, "color");
    Assert.is(
        color.accent.$description,
        "A group with its own token, $root, and variants.",
    );
});

Metadata("the document root is a group with metadata", () => {
    const tokens = load("format");

    Assert.match(tokens.$description, "format module");
    Assert.equal(tokens.$extensions, {
        "com.example.file": { owner: "design-systems" },
    });
});

Metadata("metadata is not a child of a group", () => {
    const { color } = load("format");

    Assert.not.ok(Object.keys(color).includes("$description"));
    Assert.not.ok(Object.keys(color).includes("$type"));
});

Metadata("a token can be deprecated, with or without an explanation", () => {
    const { color } = load("format");

    Assert.is(color.legacy.$deprecated, "Use color.primary instead.");
    Assert.is(color.retired.$deprecated, true);
    Assert.is(color.current.$deprecated, false);
    Assert.is(color.blue.$deprecated, false);
});

// --- Color module ----------------------------------------------------------

ColorModule("reads every color space as written", () => {
    const source = fixture("color").color;
    const { color } = load("color");

    for (const name of Object.keys(source)) {
        if (name === "channels" || name.startsWith("$")) {
            continue;
        }

        Assert.equal(color[name].$value, source[name].$value, name);
        Assert.is(color[name].$type, "color", name);
    }
});

ColorModule("covers all fourteen color spaces", () => {
    const { color } = load("color");
    const spaces = new Set(
        Object.values<any>(color)
            .filter((token) => token.$value?.colorSpace)
            .map((token) => token.$value.colorSpace),
    );

    Assert.is(spaces.size, 14);
});

ColorModule("a component can be none, which is not 0", () => {
    const { color } = load("color");

    Assert.equal(color["hsl-none"].$value.components, ["none", 0, 100]);
});

ColorModule("alpha defaults to opaque and hex is a fallback", () => {
    const { color } = load("color");

    Assert.is(color.srgb.$value.alpha, 1);
    Assert.is(color.translucent.$value.alpha, 0.5);
    Assert.is(color.hsl.$value.alpha, undefined);
    Assert.is(color.srgb.$value.hex, "#ff00ff");
});

ColorModule("components and alpha can reference number tokens", () => {
    const { color } = load("color");

    Assert.equal(color.channels.mixed.$value, {
        colorSpace: "srgb",
        components: [0.25, 0.5, 0.5],
        alpha: 0.75,
    });

    color.channels.red.set(1);
    Assert.is(color.channels.mixed.$value.components[0], 1);
});

ColorModule("reflects each color space to CSS", () => {
    const css = toCSS(create(fixture("color")), {
        name: (token) => token.name.replace(/\./g, "-"),
    });

    for (const expected of [
        "--color-srgb:#ff00ff;",
        "--color-translucent:#00000080;",
        "--color-hsl:hsl(210 50% 40%);",
        "--color-hsl-none:hsl(none 0% 100%);",
        "--color-hwb:hwb(120 10% 20%);",
        "--color-lab:lab(50 -40 60);",
        "--color-lch:lch(50 80 359.9);",
        "--color-oklab:oklab(0.6 -0.1 0.1);",
        "--color-oklch:oklch(0.7 0.15 200);",
        "--color-display-p3:color(display-p3 0 1 0);",
        "--color-srgb-linear:color(srgb-linear 0.2 0.4 0.6);",
        "--color-xyz-d50:color(xyz-d50 0.3 0.4 0.5);",
    ]) {
        Assert.ok(css.includes(expected), `${expected}\n${css}`);
    }
});

// --- $extends --------------------------------------------------------------

Extends("a group takes the tokens of the group it extends", () => {
    const { dark, base } = load("extends");

    Assert.equal(dark.accent.light.$value, base.accent.light.$value);
    Assert.is(dark.accent.light.name, "dark.accent.light");
});

Extends("a token in the extending group replaces the inherited one", () => {
    const { dark, base } = load("extends");

    Assert.equal(dark.background.$value, srgb(0, 0, 0));
    Assert.equal(dark.text.$value, srgb(1, 1, 1));
    Assert.equal(base.background.$value, srgb(1, 1, 1));
    Assert.equal(base.text.$value, srgb(0, 0, 0));
});

Extends("groups at the same path are merged", () => {
    const { dark, base } = load("extends");

    Assert.equal(Object.keys(dark.accent).sort(), ["dark", "light", "mid"]);
    Assert.equal(dark.accent.dark.$value, srgb(0, 0.1, 0.3));
    Assert.equal(dark.accent.mid.$value, srgb(0.2, 0.4, 0.8));
    // The extended group is untouched.
    Assert.equal(Object.keys(base.accent).sort(), ["dark", "light"]);
});

Extends("an extending group can extend a group that extends", () => {
    const { dim, dark } = load("extends");

    Assert.equal(dim.text.$value, srgb(0.8, 0.8, 0.8));
    Assert.equal(dim.background.$value, dark.background.$value);
    Assert.equal(dim.accent.mid.$value, dark.accent.mid.$value);
    Assert.equal(dim.accent.light.$value, dark.accent.light.$value);
});

Extends("both reference forms of $extends work", () => {
    // "{base}" is dark's, { "$ref": "#/dark" } is dim's.
    const { dark, dim } = load("extends");

    Assert.ok(dark.background);
    Assert.ok(dim.background);
});

Extends(
    "the extending group keeps its own metadata and inherits the rest",
    () => {
        const { dark, dim, base } = load("extends");

        Assert.match(dark.$description, "Dark mode");
        Assert.match(dim.$description, "Extends a group that itself extends");
        Assert.is(base.$description, "The group everything else extends.");
        // $type comes from the extended group, so tokens are colors.
        Assert.is(dark.text.$type, "color");
        Assert.is(dim.accent.mid.$type, "color");
    },
);

Extends(
    "an alias inherited through $extends still names the original token",
    () => {
        const { aliases, base } = load("extends");

        Assert.equal(aliases.echo.$value, base.text.$value);
    },
);

Extends(
    "the extending group's tokens are not the extended group's tokens",
    () => {
        const { base, dark } = load("extends");

        base.accent.light.set(srgb(0, 0, 0));

        // dark inherited its own copy at load time, not a live view.
        Assert.not.equal(dark.accent.light.$value, base.accent.light.$value);
    },
);

// --- $ref ------------------------------------------------------------------

Pointers("a pointer to a $value is an alias, so it stays live", () => {
    const { pointers, base } = load("extends");

    Assert.equal(pointers.link.$value, base.text.$value);

    base.text.set(srgb(0.5, 0.5, 0.5));
    Assert.equal(pointers.link.$value, srgb(0.5, 0.5, 0.5));
});

Pointers(
    "a pointer into a value is replaced by a copy of what it points at",
    () => {
        const { pointers } = load("extends");

        Assert.is(pointers.channel.$value, 0.8);
        Assert.equal(pointers.stretched.$value, { value: 8, unit: "rem" });
    },
);

Pointers("a pointer can escape / and ~", () => {
    const { pointers } = load("extends");

    Assert.is(pointers.escaped.$value, 42);
});

Pointers("a $ref inside $extensions is left alone", () => {
    const { pointers } = load("extends");

    Assert.equal(pointers.vendor.$extensions, {
        "com.example": { $ref: "kept as the vendor wrote it" },
    });
});

// --- Custom types ----------------------------------------------------------

Custom("a custom type is read as it's written", () => {
    const { t } = tokensOf(
        { t: { $type: "steps", $value: { scale: [1, 2], name: "x" } } },
        { types: byIdentity("steps") },
    );

    Assert.is(t.$type, "steps");
    Assert.equal(t.$value, { scale: [1, 2], name: "x" });
});

Custom("a reference anywhere in a custom value is a ref", () => {
    const tokens = tokensOf(
        {
            n: { $type: "number", $value: 2 },
            t: {
                $type: "steps",
                $value: { scale: [1, "{n}"], nested: { of: "{n}" } },
            },
        },
        { types: byIdentity("steps") },
    );

    Assert.equal(tokens.t.$value, { scale: [1, 2], nested: { of: 2 } });

    tokens.n.set(3);
    Assert.equal(tokens.t.$value, { scale: [1, 3], nested: { of: 3 } });
});

Custom("a group can give its tokens a custom type", () => {
    const { steps } = tokensOf(
        { steps: { $type: "steps", small: { $value: [1] } } },
        { types: byIdentity("steps") },
    );

    Assert.is(steps.small.$type, "steps");
    Assert.is(steps.$type, "steps");
});

Custom("a whole custom value can refer to a token of its type", () => {
    const { b } = tokensOf(
        {
            a: { $type: "steps", $value: [1] },
            b: { $type: "steps", $value: "{a}" },
        },
        { types: byIdentity("steps") },
    );

    Assert.equal(b.$value, [1]);
});

// --- Recipe calls (an extension) -------------------------------------------

type Color = DesignToken.Values.Readonly.Color;

const darkenComponent = (
    component: DesignToken.Values.ColorComponent,
    amount: number,
) => (component === "none" ? component : component * (1 - amount));

const TestRecipes = recipes({
    darken: (color: Color, amount: number): DesignToken.Values.Color => {
        const [a, b, c] = color.components;

        return {
            colorSpace: color.colorSpace,
            components: [
                darkenComponent(a, amount),
                darkenComponent(b, amount),
                darkenComponent(c, amount),
            ],
        };
    },
    mix: ({
        from,
        to,
    }: {
        from: Color;
        to: Color;
    }): DesignToken.Values.Color => {
        const half = (index: 0 | 1 | 2) => {
            const a = from.components[index];
            const b = to.components[index];

            return a === "none" || b === "none" ? a : (a + b) / 2;
        };

        return {
            colorSpace: from.colorSpace,
            components: [half(0), half(1), half(2)],
        };
    },
    scale: (
        dimension: DesignToken.Values.Readonly.Dimension,
        factor: number,
    ): DesignToken.Values.Dimension => ({
        value: dimension.value * factor,
        unit: dimension.unit,
    }),
    text: (value: string) => value,
});

const withRecipes = { recipes: TestRecipes };

Recipes("a call is the value of its recipe", () => {
    const { color, size } = load("recipes", withRecipes);

    Assert.equal(color.hover.$value, srgb(0, 0.2, 0.5));
    Assert.equal(size.large.$value, { value: 8, unit: "px" });
    Assert.is(color.hover.$type, "color");
});

Recipes("a call is a computed value", () => {
    const config = parse(fixture("recipes"), withRecipes);

    Assert.not.ok(isRef(config.color.hover.$value));
    Assert.is(typeof config.color.hover.$value, "object");
});

Recipes("a call follows the tokens of its arguments", () => {
    const { color, amount, border } = load("recipes", withRecipes);

    color.blue.set(srgb(1, 1, 1));
    Assert.equal(color.hover.$value, srgb(0.5, 0.5, 0.5));

    amount.set(0);
    Assert.equal(border.$value.color, srgb(1, 1, 1));
});

Recipes("a call can be an argument of a call", () => {
    const { color } = load("recipes", withRecipes);

    Assert.equal(color.pressed.$value, srgb(0, 0.1, 0.25));
});

Recipes("a call can take an object, with refs in it", () => {
    const { color } = load("recipes", withRecipes);

    Assert.equal(color.mid.$value.components, [0.5, 0.7, 1]);
});

Recipes("a call can be inside a composite value", () => {
    const { border } = load("recipes", withRecipes);

    Assert.equal(border.$value, {
        color: srgb(0, 0.2, 0.5),
        width: { value: 1, unit: "px" },
        style: "solid",
    });
});

Recipes("a call can be anywhere in a custom value", () => {
    const { t } = tokensOf(
        { t: { $type: "steps", $value: { label: ['text("a")'] } } },
        { ...withRecipes, types: byIdentity("steps") },
    );

    Assert.equal(t.$value, { label: ["a"] });
});

Recipes("a string in a call is a string, not a reference", () => {
    const { t } = tokensOf(
        { t: { $type: "label", $value: 'text("{not.a.ref}")' } },
        { ...withRecipes, types: byIdentity("label") },
    );

    Assert.is(t.$value, "{not.a.ref}");
});

Recipes("a string that calls something else stays a string", () => {
    const { css, font } = tokensOf(
        {
            css: { $type: "css", $value: "calc(100% - 4px)" },
            font: { $type: "fontFamily", $value: "darken(Sans)" },
        },
        { types: byIdentity("css") },
    );

    Assert.is(css.$value, "calc(100% - 4px)");
    Assert.is(font.$value, "darken(Sans)");
});

Recipes("a recipe is called by its name, not its key", () => {
    const { t } = tokensOf(
        { t: { $type: "label", $value: 'text("a")' } },
        { recipes: { renamed: TestRecipes.text }, types: byIdentity("label") },
    );

    Assert.is(t.$value, "a");
});

Recipes("a recipe can be given under two keys", () => {
    Assert.ok(
        parse(
            { t: { $type: "label", $value: 'text("a")' } },
            {
                recipes: { ...TestRecipes, other: TestRecipes.text },
                types: byIdentity("label"),
            },
        ),
    );
});

Recipes("an override in extend() applies to a parsed call", () => {
    const library = create(fixture("recipes"), withRecipes);
    const extended = library.extend(
        {},
        { recipes: [override(TestRecipes.darken, (color) => color)] },
    );
    const { color }: any = extended.tokens;

    Assert.equal(color.hover.$value, color.blue.$value);
});

// --- The DTCG form, with this library's extension --------------------------

const compliant = (options = {}) =>
    load("compliant", {
        ...withRecipes,
        types: byIdentity("ratio"),
        ...options,
    });

Compliant("a token's own $value is read from the extension", () => {
    const { color } = compliant();

    Assert.equal(color.hover.$value, srgb(0, 0.2, 0.5));

    // It's the call, not the resolved value of the DTCG form.
    color.blue.set(srgb(1, 1, 1));
    Assert.equal(color.hover.$value, srgb(0.5, 0.5, 0.5));
});

Compliant("a token's and a group's own $type are read from it", () => {
    const { ratio, steps } = compliant();

    Assert.is(ratio.$type, "ratio");
    Assert.is(ratio.$value, 1.5);
    Assert.is(steps.$type, "ratio");
    Assert.is(steps.small.$type, "ratio");
});

Compliant("a reference sees a token's own type", () => {
    const { steps } = compliant();

    Assert.is(steps.large.$type, "ratio");
    Assert.is(steps.large.$value, 1.5);
});

Compliant("the extension is removed, and other extensions are kept", () => {
    const { color, ratio, steps } = compliant();

    Assert.equal(color.hover.$extensions, { "com.example": { id: 7 } });
    Assert.equal(ratio.$extensions, {});
    Assert.is(steps.$extensions, undefined);
    Assert.match(color.hover.$description, "resolved value");
});

Compliant("an alias in the DTCG form takes the DTCG type of its target", () => {
    const own = (value: string) => ({
        "design-token-library": { $type: "color", $value: value },
    });
    const { alias, again } = tokensOf(
        {
            blue: { $type: "color", $value: srgb(0, 0.4, 1) },
            alias: {
                $value: "{blue}",
                $extensions: own("darken({blue}, 0.5)"),
            },
            again: { $value: "{alias}", $extensions: own("{alias}") },
        },
        withRecipes,
    );

    Assert.equal(alias.$value, srgb(0, 0.2, 0.5));
    Assert.equal(again.$value, srgb(0, 0.2, 0.5));
});

Compliant("a document without the extension needs no options", () => {
    const { color } = load("format");

    Assert.is(color.blue.$type, "color");
});

// --- A document that extends a library ------------------------------------

const black = srgb(0, 0, 0);

Extending("a token it restates takes the library token's type", () => {
    const base = createBase();
    const extended = base.extend(
        parse({ colors: { primary: { $value: black } } }, { extends: base }),
    );

    Assert.equal(extended.tokens.colors.primary.$value, black);
    Assert.is(extended.tokens.colors.primary.$type, "color");
    Assert.equal(base.tokens.colors.primary.$value.components, [0, 0, 1]);
});

Extending("a reference can name the library's tokens", () => {
    const base = createBase();
    const extended = base.extend(
        parse(
            { colors: { primary: { $value: "{colors.secondary}" } } },
            { extends: base },
        ),
    );

    Assert.equal(
        extended.tokens.colors.primary.$value,
        base.tokens.colors.secondary.$value,
    );
});

Extending("a new token takes the type of the library's group", () => {
    const base = createBase();
    const extended: any = base.extend(
        parse({ colors: { tertiary: { $value: black } } }, { extends: base }),
    );

    Assert.is(extended.tokens.colors.tertiary.$type, "color");
    Assert.equal(extended.tokens.colors.tertiary.$value, black);
});

Extending("the library's custom types are known", () => {
    const base = createBase();
    const config: any = parse(
        { ratio: { $value: 2 }, more: { $type: "ratio", $value: 3 } },
        { extends: base },
    );

    Assert.is(config.ratio.$type, "ratio");
    Assert.is(config.more.$type, "ratio");
});

Extending("a group may restate the library's $type", () => {
    const config: any = parse(
        { colors: { $type: "color", primary: { $value: black } } },
        { extends: createBase() },
    );

    Assert.is(config.colors.$type, undefined);
    Assert.is(config.colors.primary.$type, "color");
});

// --- Invalid documents -----------------------------------------------------

const caught = (document: object, options = {}): ParseError => {
    try {
        parse(document, options);
    } catch (error) {
        if (error instanceof ParseError) {
            return error;
        }

        throw error;
    }

    throw new Error("The document was accepted.");
};

const issues = (document: object, options = {}): string[] =>
    caught(document, options).issues.map(
        (issue) => `${issue.path}: ${issue.message}`,
    );

const rejects = (document: object, expected: RegExp, options = {}) => {
    const found = issues(document, options);

    Assert.ok(
        found.some((issue) => expected.test(issue)),
        `Expected an issue matching ${expected}, but found:\n${found.join("\n")}`,
    );
};

const token = (type: string, value: unknown) => ({
    t: { $type: type, $value: value },
});

Invalid("text that is not JSON", () => {
    Assert.throws(() => parse("{ nope"), /not valid JSON/);
});

Invalid("a document that is not an object", () => {
    Assert.throws(() => parse("[]"), /must be a JSON object/);
    Assert.throws(() => parse("3"), /must be a JSON object/);
});

Invalid("reports every problem, not only the first", () => {
    const found = issues({
        a: { $type: "color", $value: "#ff00ff" },
        b: { $type: "dimension", $value: "16px" },
        c: { $value: 1 },
    });

    Assert.is(found.length, 3);
});

Invalid("a token with no $type, own, aliased or inherited", () => {
    rejects({ t: { $value: 1 } }, /^t: has no \$type/);
});

Invalid("a $type that is not a type", () => {
    rejects(token("Color", {}), /t\.\$type: "Color" is not a type/);
    rejects(token("colour", {}), /"colour" is not a type/);
});

Invalid("a custom type the document does not declare", () => {
    rejects(token("palette", [1]), /"palette" is not a type/);
    Assert.is(
        parse(token("palette", [1]), { types: byIdentity("palette") }).t
            .$value[0],
        1,
    );
});

Invalid("a name with a dot, a brace, or nothing", () => {
    rejects({ "a.b": token("number", 1).t }, /^a\.b: is not a valid name/);
    rejects({ "a{b": token("number", 1).t }, /not a valid name/);
    rejects({ "a}b": token("number", 1).t }, /not a valid name/);
    rejects({ "": token("number", 1).t }, /empty name/);
});

Invalid("a property the format does not define", () => {
    rejects(
        { t: { $type: "number", $value: 1, $nope: 1 } },
        /unsupported property "\$nope"/,
    );
    rejects({ g: { $nope: 1 } }, /unsupported property "\$nope"/);
});

Invalid("a token with children", () => {
    rejects(
        { t: { $type: "number", $value: 1, child: { $value: 2 } } },
        /cannot have a child "child"/,
    );
});

Invalid("a $root that is a group", () => {
    rejects({ g: { $root: { child: {} } } }, /\$root must be a token/);
});

Invalid("a $root at the top level", () => {
    rejects(
        { $root: { $type: "number", $value: 1 } },
        /cannot be at the top level/,
    );
});

Invalid("a reference in a custom value to a token that does not exist", () => {
    rejects(
        { t: { $type: "steps", $value: { of: ["{nope}"] } } },
        /t\.\$value\.of\[0\]: references "\{nope\}", which does not exist/,
        { types: byIdentity("steps") },
    );
});

Invalid("a whole custom value that refers to a token of another type", () => {
    rejects(
        {
            n: { $type: "number", $value: 1 },
            t: { $type: "steps", $value: "{n}" },
        },
        /a number token, where a steps is needed/,
        { types: byIdentity("steps") },
    );
});

Invalid("a child that is not an object", () => {
    rejects(
        { g: { $type: "number", x: 3 } },
        /g\.x: must be a token or a group/,
    );
});

Invalid("$description, $extensions and $deprecated of the wrong kind", () => {
    rejects(
        { t: { $type: "number", $value: 1, $description: 3 } },
        /\$description: must be a string/,
    );
    rejects(
        { t: { $type: "number", $value: 1, $extensions: [] } },
        /\$extensions: must be an object/,
    );
    rejects(
        { t: { $type: "number", $value: 1, $deprecated: 1 } },
        /\$deprecated: must be true, false or a string/,
    );
    rejects({ g: { $description: {} } }, /\$description: must be a string/);
});

Invalid("a reference to a token that does not exist", () => {
    rejects(
        { t: { $type: "number", $value: "{nope}" } },
        /references "\{nope\}", which does not exist/,
    );
});

Invalid("a reference to a group", () => {
    rejects(
        {
            g: { n: { $type: "number", $value: 1 } },
            t: { $type: "number", $value: "{g}" },
        },
        /which is a group/,
    );
});

Invalid("a reference to a token of another type", () => {
    rejects(
        {
            n: { $type: "number", $value: 1 },
            t: { $type: "dimension", $value: "{n}" },
        },
        /a number token, where a dimension is needed/,
    );
});

Invalid("an alias whose type conflicts with its group's", () => {
    rejects(
        {
            n: { $type: "number", $value: 1 },
            g: { $type: "dimension", t: { $value: "{n}" } },
        },
        /but the token's group gives the \$type "dimension"/,
    );
});

Invalid("a reference of the wrong type inside a composite value", () => {
    rejects(
        {
            n: { $type: "number", $value: 1 },
            b: {
                $type: "border",
                $value: {
                    color: "{n}",
                    width: { value: 1, unit: "px" },
                    style: "solid",
                },
            },
        },
        /b\.\$value\.color: references "\{n\}", a number token, where a color is needed/,
    );
});

Invalid("a circular alias reports each token in the loop", () => {
    const found = issues({
        a: { $value: "{b}" },
        b: { $value: "{c}" },
        c: { $value: "{a}" },
    });

    Assert.ok(
        found.some((issue) =>
            /Circular reference: [abc] → [abc] → [abc] → [abc]/.test(issue),
        ),
        found.join("\n"),
    );
});

Invalid("a token that aliases itself", () => {
    rejects(
        { a: { $type: "number", $value: "{a}" } },
        /Circular reference: a → a/,
    );
});

Invalid("$extends of a group that does not exist, or a token", () => {
    rejects(
        { g: { $extends: "{nope}" } },
        /g: \$extends names "nope", which does not exist/,
    );
    rejects(
        { t: { $type: "number", $value: 1 }, g: { $extends: "{t}" } },
        /which is a token\. It must name a group/,
    );
});

Invalid("$extends that is not a reference", () => {
    rejects({ g: { $extends: 3 } }, /\$extends must be a reference to a group/);
    rejects(
        { g: { $extends: "g" } },
        /\$extends must be a reference to a group/,
    );
});

Invalid("$extends that is circular", () => {
    rejects(
        { a: { $extends: "{b}" }, b: { $extends: "{a}" } },
        /\$extends forms a cycle/,
    );
    rejects({ a: { $extends: "{a}" } }, /\$extends forms a cycle/);
});

Invalid("a $ref that is not a pointer into the document", () => {
    rejects(
        token("number", { $ref: "other.json#/a" }),
        /not a JSON Pointer into this document/,
    );
    rejects(token("number", { $ref: "#nope" }), /not a JSON Pointer/);
});

Invalid("a $ref to nothing", () => {
    rejects(token("number", { $ref: "#/nope/$value" }), /does not exist/);
});

Invalid("a $ref with other properties, or circular", () => {
    rejects(token("number", { $ref: "#/a", extra: 1 }), /only property/);
    rejects(
        {
            a: { $type: "number", $value: { $ref: "#/b/$value" } },
            b: { $type: "number", $value: { $ref: "#/a/$value" } },
        },
        /circular|Circular/,
    );
});

Invalid("a color with a bad color space, count or range", () => {
    rejects(
        token("color", { colorSpace: "cmyk", components: [0, 0, 0, 0] }),
        /"cmyk", which is not a color space/,
    );
    rejects(
        token("color", { colorSpace: "srgb", components: [0, 0] }),
        /must have 3 components for srgb, but has 2/,
    );
    rejects(
        token("color", { colorSpace: "srgb", components: [0, 0, 2] }),
        /components\[2\]: is 2, outside the range/,
    );
    rejects(
        token("color", { colorSpace: "hsl", components: [360, 0, 0] }),
        /components\[0\]: is 360, outside the range.*exclusive/,
    );
    rejects(
        token("color", { colorSpace: "hsl", components: [0, 0, 101] }),
        /outside the range/,
    );
    rejects(
        token("color", { colorSpace: "oklch", components: [0.5, -1, 0] }),
        /outside the range/,
    );
    rejects(
        token("color", { colorSpace: "oklab", components: [1.5, 0, 0] }),
        /outside the range/,
    );
    rejects(
        token("color", { colorSpace: "lab", components: [101, 0, 0] }),
        /outside the range/,
    );
});

Invalid("a color with bad components, alpha or hex", () => {
    rejects(
        token("color", { colorSpace: "srgb", components: ["auto", 0, 0] }),
        /must be a number or "none"/,
    );
    rejects(
        token("color", { colorSpace: "srgb", components: "none" }),
        /components: must be an array/,
    );
    rejects(
        token("color", {
            colorSpace: "srgb",
            components: [0, 0, 0],
            alpha: 1.5,
        }),
        /alpha: must be a number from 0 to 1/,
    );
    rejects(
        token("color", {
            colorSpace: "srgb",
            components: [0, 0, 0],
            hex: "#ff00ff80",
        }),
        /six digit hex/,
    );
    rejects(
        token("color", {
            colorSpace: "srgb",
            components: [0, 0, 0],
            hex: "ff00ff",
        }),
        /six digit hex/,
    );
    rejects(
        token("color", {
            colorSpace: "srgb",
            components: [0, 0, 0],
            colourSpace: 1,
        }),
        /unsupported property "colourSpace"/,
    );
});

Invalid("a color in the form before 2025.10", () => {
    rejects(token("color", "#ff00ff"), /is not a color\. A color is an object/);
});

Invalid("a dimension that is a string, has no unit or a wrong unit", () => {
    rejects(token("dimension", "16px"), /is not a dimension/);
    rejects(token("dimension", { value: 16 }), /unit: must be "px" or "rem"/);
    rejects(
        token("dimension", { value: 16, unit: "em" }),
        /unit: must be "px" or "rem"/,
    );
    rejects(
        token("dimension", { value: "16", unit: "px" }),
        /value: must be a number/,
    );
});

Invalid("a duration with a wrong unit, or in the form before 2025.10", () => {
    rejects(
        token("duration", { value: 1, unit: "m" }),
        /unit: must be "ms" or "s"/,
    );
    rejects(token("duration", "100ms"), /is not a duration/);
});

Invalid("a font family or weight that is not valid", () => {
    rejects(token("fontFamily", 3), /must be a string or an array of strings/);
    rejects(token("fontFamily", []), /must be a string or an array of strings/);
    rejects(
        token("fontFamily", ["a", 1]),
        /must be a string or an array of strings/,
    );
    rejects(token("fontWeight", 0), /number from 1 to 1000/);
    rejects(token("fontWeight", 1001), /number from 1 to 1000/);
    rejects(token("fontWeight", "smi-bold"), /font weight keyword/);
    rejects(token("fontWeight", "Bold"), /font weight keyword/);
});

Invalid(
    "a cubic Bézier that is not four numbers, or has x outside 0 to 1",
    () => {
        rejects(token("cubicBezier", [0, 0, 1]), /array of four numbers/);
        rejects(token("cubicBezier", [0, 0, 1, "1"]), /array of four numbers/);
        rejects(
            token("cubicBezier", [1.5, 0, 1, 1]),
            /\[0\]: is 1\.5.*x coordinates/,
        );
        rejects(
            token("cubicBezier", [0, 0, -1, 1]),
            /\[2\]: is -1.*x coordinates/,
        );
    },
);

Invalid("a number that is not a number", () => {
    rejects(token("number", "1"), /must be a number/);
    rejects(token("number", null), /must be a number/);
});

Invalid("a stroke style that is not valid", () => {
    rejects(
        token("strokeStyle", "wavy"),
        /"wavy", which is not a stroke style/,
    );
    rejects(
        token("strokeStyle", { dashArray: [], lineCap: "round" }),
        /dashArray: must be an array of dimensions/,
    );
    rejects(
        token("strokeStyle", {
            dashArray: [{ value: 1, unit: "px" }],
            lineCap: "flat",
        }),
        /lineCap: must be "round", "butt" or "square"/,
    );
    rejects(
        token("strokeStyle", { dashArray: ["1px"], lineCap: "round" }),
        /dashArray\[0\]: is not a dimension/,
    );
});

Invalid("a border, transition or typography missing a property", () => {
    rejects(
        token("border", { color: srgb(0, 0, 0), style: "solid" }),
        /width: is required/,
    );
    rejects(
        token("transition", { duration: { value: 1, unit: "s" } }),
        /delay: is required/,
    );
    rejects(token("typography", { fontFamily: "a" }), /fontSize: is required/);
    rejects(
        token("typography", {
            fontFamily: "a",
            fontSize: { value: 1, unit: "px" },
            fontWeight: 400,
            letterSpacing: { value: 0, unit: "px" },
            lineHeight: { value: 1, unit: "px" },
        }),
        /lineHeight: must be a number/,
    );
    rejects(
        token("border", {
            color: srgb(0, 0, 0),
            width: { value: 1, unit: "px" },
            style: "solid",
            extra: 1,
        }),
        /unsupported property "extra"/,
    );
});

Invalid("a shadow missing a property or with a bad inset", () => {
    const layer = {
        color: srgb(0, 0, 0),
        offsetX: { value: 0, unit: "px" },
        offsetY: { value: 0, unit: "px" },
        spread: { value: 0, unit: "px" },
    };

    rejects(token("shadow", layer), /blur: is required/);
    rejects(
        token("shadow", {
            ...layer,
            blur: { value: 1, unit: "px" },
            inset: "yes",
        }),
        /inset: must be true or false/,
    );
    rejects(token("shadow", []), /at least one shadow/);
    rejects(token("shadow", [[layer]]), /\[0\]: is not a shadow/);
});

Invalid("a gradient that is empty or has a bad stop", () => {
    rejects(token("gradient", []), /must be an array of gradient stops/);
    rejects(
        token("gradient", [{ color: srgb(0, 0, 0) }]),
        /position: is required/,
    );
    rejects(token("gradient", [{ position: 0 }]), /color: is required/);
    rejects(
        token("gradient", [{ color: srgb(0, 0, 0), position: "0" }]),
        /position: must be a number from 0 to 1/,
    );
    rejects(token("gradient", ["{nope}"]), /does not exist/);
});

// A chain of groups that each take the one before twice, which doubles at
// each step. `copy` makes each of the two a `$extends` or a `$ref`.
const doubling = (steps: number, copy: (from: string) => object): object => {
    const document: Record<string, object> = {
        g0: { $type: "number", leaf: { $value: 1 } },
    };

    for (let step = 1; step <= steps; step++) {
        document[`g${step}`] = {
            left: copy(`g${step - 1}`),
            right: copy(`g${step - 1}`),
        };
    }

    return document;
};

const TOO_LARGE =
    /more than 1000000 nodes once \$extends and \$ref are resolved/;

Invalid("$extends that expands without bound", () => {
    const start = Date.now();

    rejects(
        doubling(40, (from) => ({ $extends: `{${from}}` })),
        TOO_LARGE,
    );
    Assert.ok(Date.now() - start < 10_000, "It stops in a bounded time.");
});

Invalid("$ref that expands without bound", () => {
    const start = Date.now();

    rejects(
        doubling(40, (from) => ({ $ref: `#/${from}` })),
        TOO_LARGE,
    );
    Assert.ok(Date.now() - start < 10_000, "It stops in a bounded time.");
});

Invalid("a document that repeats a group a reasonable number of times", () => {
    const tokens = tokensOf(doubling(8, (from) => ({ $ref: `#/${from}` })));
    let group = tokens.g8;

    for (let step = 0; step < 8; step++) {
        group = group.left;
    }

    Assert.is(group.leaf.$value, 1);
});

Invalid("a token named __proto__ is reported, not lost", () => {
    rejects(
        JSON.parse(
            '{ "__proto__": { "$type": "number", "$value": 1 }, "a": { "$type": "number", "$value": 1 } }',
        ),
        /^__proto__: is not a valid name/,
    );
});

Format("a document can start with a byte order mark", () => {
    const config = parse(`\uFEFF{ "a": { "$type": "number", "$value": 1 } }`);

    Assert.is(tokensOf(config).a.$value, 1);
});

Invalid("two different recipes with one name", () => {
    const other = recipes({ text: (value: string) => value });

    Assert.throws(
        () => parse({}, { recipes: { ...TestRecipes, otherText: other.text } }),
        /Two different recipes are named "text"/,
    );
});

Invalid("a value that calls a name that isn't a recipe", () => {
    rejects(
        { t: { $type: "color", $value: "darkn({t}, 0.2)" } },
        /^t\.\$value: is not a color\..* It looks like a recipe call, but "darkn" is not one of the recipes\./,
        withRecipes,
    );
});

Invalid("a call of a name that isn't a recipe, in a call", () => {
    rejects(
        {
            c: { $type: "color", $value: srgb(0, 0, 0) },
            t: { $type: "color", $value: "darken(lighten({c}), 0.2)" },
        },
        /calls "lighten", which is not one of the recipes/,
        withRecipes,
    );
});

Invalid("a call that isn't valid", () => {
    rejects(
        { t: { $type: "color", $value: "darken({c}, 0.2" } },
        /is not a valid recipe call: expected "," or "\)" at position 16/,
        withRecipes,
    );
    rejects(
        { t: { $type: "color", $value: "darken({c}) more" } },
        /expected the end of the call/,
        withRecipes,
    );
    rejects(
        { t: { $type: "color", $value: 'darken({ "a" 1 })' } },
        /expected ":" after "a"/,
        withRecipes,
    );
});

Invalid("a call with a reference to a token that does not exist", () => {
    rejects(
        { t: { $type: "color", $value: "darken({nope}, 0.2)" } },
        /t\.\$value: references "\{nope\}", which does not exist/,
        withRecipes,
    );
});

Invalid("a call doesn't give its token a type", () => {
    rejects(
        {
            c: { $type: "color", $value: srgb(0, 0, 0) },
            t: { $value: "darken({c}, 0.2)" },
        },
        /^t: has no \$type.*not the type of a recipe's result/,
        withRecipes,
    );
});

const own = (value: unknown) => ({ "design-token-library": value });

Invalid("the DTCG form of a token with the extension is still checked", () => {
    rejects(
        {
            t: {
                $type: "color",
                $value: "#ffffff",
                $extensions: own({ $type: "ratio", $value: 1 }),
            },
        },
        /^t\.\$value: is not a color/,
        { types: byIdentity("ratio") },
    );
    rejects(
        {
            t: {
                $type: "ratio",
                $value: 1,
                $extensions: own({ $value: 2 }),
            },
        },
        /^t\.\$type: "ratio" is not a standard type, so the token's DTCG form isn't DTCG/,
        { types: byIdentity("ratio") },
    );
    rejects(
        { t: { $value: 1, $extensions: own({ $type: "ratio" }) } },
        /^t: has no \$type in its DTCG form/,
        { types: byIdentity("ratio") },
    );
    rejects(
        {
            t: {
                $type: "number",
                $value: "{nope}",
                $extensions: own({ $type: "ratio", $value: 1 }),
            },
        },
        /references "\{nope\}", which does not exist/,
        { types: byIdentity("ratio") },
    );
});

Invalid("an extension that isn't an object, or has other properties", () => {
    rejects(
        { t: { $type: "number", $value: 1, $extensions: own(1) } },
        /^t\.\$extensions\.design-token-library: must be an object/,
    );
    rejects(
        {
            t: {
                $type: "number",
                $value: 1,
                $extensions: own({ $description: "x" }),
            },
        },
        /has an unsupported property "\$description"\. It accepts \$type, \$value/,
    );
    rejects(
        { g: { $extensions: own({ $value: 1 }) } },
        /^g\.\$extensions\.design-token-library: has an unsupported property "\$value"\. It accepts \$type\./,
    );
});

Invalid("an alias in the DTCG form with no DTCG type to take", () => {
    const own = { "design-token-library": { $type: "color", $value: "{a}" } };

    // The target has no type, so its alias has none either.
    rejects(
        {
            a: { $value: srgb(0, 0, 1), $extensions: own },
            b: { $value: "{a}", $extensions: own },
        },
        /^b: has no \$type in its DTCG form/,
    );
});

Invalid("a token it restates, checked as the library's", () => {
    const options = { extends: createBase() };

    rejects(
        { colors: { primary: { $value: "#000000" } } },
        /^colors\.primary\.\$value: is not a color/,
        options,
    );
    rejects(
        { colors: { primary: { $value: "{size.small}" } } },
        /a dimension token, where a color is needed/,
        options,
    );
    rejects(
        {
            colors: {
                primary: {
                    $type: "dimension",
                    $value: { value: 1, unit: "px" },
                },
            },
        },
        /^colors\.primary\.\$type: is "dimension", but the token is a color in the library it extends/,
        options,
    );
});

Invalid("a group in place of a library's token, or a token for a group", () => {
    const options = { extends: createBase() };

    rejects(
        { colors: { primary: { nested: { $value: 1 } } } },
        /^colors\.primary: is a token in the library it extends, so it can't be a group/,
        options,
    );
    rejects(
        { colors: { $type: "color", $value: black } },
        /^colors: is a group in the library it extends, so it can't be a token/,
        options,
    );
});

Invalid("a group that changes the library's $type", () => {
    rejects(
        { colors: { $type: "dimension" } },
        /^colors\.\$type: is "dimension", but the group is of color in the library/,
        { extends: createBase() },
    );
});

Invalid("a ParseError lists the path and message of each issue", () => {
    const { message, name } = caught({ t: { $value: 1 } });

    Assert.is(name, "ParseError");
    Assert.match(message, "Invalid design tokens document (1 issue)");
    Assert.match(message, "  t: has no $type");
});

Types.run();
Aliases.run();
Format.run();
Metadata.run();
ColorModule.run();
Extends.run();
Pointers.run();
Custom.run();
Recipes.run();
Compliant.run();
Extending.run();
Invalid.run();
