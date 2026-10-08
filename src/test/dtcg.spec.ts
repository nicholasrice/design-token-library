import { readFileSync } from "node:fs";
import { suite } from "uvu";
import * as Assert from "uvu/assert";
import { DesignToken } from "../lib/design-token.js";
import { DTCGError, fromDTCG, parseDTCG } from "../lib/dtcg.js";
import { Library } from "../lib/library.js";
import { toCSS } from "../lib/css-reflector.js";
import { createPaletteRegistry } from "./my-design-system/palette.js";
import { hex } from "./values.js";

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

const load = (name: string, options = {}): any =>
    fromDTCG(fixture(name), options).tokens;

const Format = suite("DTCG.format");
const Types = suite("DTCG.types");
const Aliases = suite("DTCG.aliases");
const Metadata = suite("DTCG.metadata");
const ColorModule = suite("DTCG.color");
const Extends = suite("DTCG.extends");
const Pointers = suite("DTCG.pointers");
const Recipes = suite("DTCG.recipes");
const Invalid = suite("DTCG.invalid");

const srgb = (...components: number[]) => ({ colorSpace: "srgb", components });

// --- Types: every value in format.tokens.json is read as written -----------

Types("reads a token of every DTCG type", () => {
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
    const library = fromDTCG(fixture("format"));
    const { color } = library.tokens as any;
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
    const css = toCSS(fromDTCG(fixture("format")), {
        filter: (token) => token.name.startsWith("color.accent"),
        name: (token) => token.name.replace(/\.\$root$/, ""),
    });

    Assert.ok(css.includes("--color.accent:#0066ff;"), css);
    Assert.ok(css.includes("--color.accent.light:#99ccff;"), css);
});

Format("every token reflects to CSS", () => {
    const css = toCSS(fromDTCG(fixture("format")));

    Assert.not.match(css, "[object Object]");
    Assert.not.match(css, "undefined");
});

Format("a document can be given as an object, and is not changed", () => {
    const document = fixture("format");
    const before = JSON.stringify(document);

    fromDTCG(document).tokens;

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
    const { tokens } = fromDTCG(fixture("format")) as any;

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
    const library = fromDTCG(fixture("color"));
    const { color } = library.tokens as any;

    Assert.equal(color.channels.mixed.$value, {
        colorSpace: "srgb",
        components: [0.25, 0.5, 0.5],
        alpha: 0.75,
    });

    color.channels.red.set(1);
    Assert.is(color.channels.mixed.$value.components[0], 1);
});

ColorModule("reflects each color space to CSS", () => {
    const css = toCSS(fromDTCG(fixture("color")), {
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
        const library = fromDTCG(fixture("extends"));
        const { base, dark } = library.tokens as any;

        base.accent.light.set(srgb(0, 0, 0));

        // dark inherited its own copy at load time, not a live view.
        Assert.not.equal(dark.accent.light.$value, base.accent.light.$value);
    },
);

// --- $ref ------------------------------------------------------------------

Pointers("a pointer to a $value is an alias, so it stays live", () => {
    const library = fromDTCG(fixture("extends"));
    const { pointers, base } = library.tokens as any;

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

// --- Recipes (an extension to DTCG) ----------------------------------------

const recipeOptions = () => ({ recipes: createPaletteRegistry() });

Recipes("a value recipe is a token called from $value", () => {
    const { color } = load("recipes", recipeOptions());

    Assert.is(color.neutral.palette.$type, "palette");
    Assert.is(color.neutral.palette.$value.length, 5);
    Assert.is(color.neutral.palette.name, "color.neutral.palette");
});

Recipes("a value recipe's token has its own description and extensions", () => {
    const { color } = load("recipes", recipeOptions());

    Assert.is(
        color.neutral.palette.$description,
        "A value recipe: a token whose value is computed.",
    );
    Assert.equal(color.neutral.palette.$extensions, {
        "com.example": { generated: true },
    });
});

Recipes("a value recipe follows the tokens it references", () => {
    const library = fromDTCG(fixture("recipes"), recipeOptions());
    const { color } = library.tokens as any;

    color.palette.stepCount.set(7);

    Assert.is(color.neutral.palette.$value.length, 7);
    Assert.is(color.accent.palette.$value.length, 7);
});

Recipes("a group recipe generates a group of tokens", () => {
    const { color } = load("recipes", recipeOptions());

    Assert.equal(Object.keys(color.accent.states), [
        "rest",
        "hover",
        "active",
        "focus",
    ]);
    Assert.is(color.accent.states.rest.$type, "color");
    Assert.is(color.accent.states.rest.name, "color.accent.states.rest");
});

Recipes("a group recipe carries the group's properties", () => {
    const { color } = load("recipes", recipeOptions());

    Assert.match(color.accent.states.$description, "A group recipe");
    Assert.equal(color.accent.states.$extensions, {
        "com.example": { generated: true },
    });
    Assert.is(
        color.accent.states.rest.$deprecated,
        "Use color.accent.palette directly.",
    );
});

Recipes("an alias of a generated token takes the recipe's type", () => {
    const { color } = load("recipes", recipeOptions());

    Assert.is(color.accent.focusRing.$type, "color");
    Assert.equal(
        color.accent.focusRing.$value,
        color.accent.states.focus.$value,
    );
});

Recipes("recipes feed one another, as in TypeScript config", () => {
    const { color } = load("recipes", recipeOptions());

    // states.rest is the palette color nearest the accent base.
    Assert.equal(
        color.accent.states.rest.$value,
        color.accent.palette.$value[2],
    );
});

// --- Invalid documents -----------------------------------------------------

const issues = (document: unknown, options = {}): string[] => {
    try {
        parseDTCG(document as object, options);
    } catch (error) {
        Assert.instance(error, DTCGError);

        return (error as DTCGError).issues.map(
            (issue) => `${issue.path}: ${issue.message}`,
        );
    }

    throw new Error("The document was accepted.");
};

const rejects = (document: unknown, expected: RegExp, options = {}) => {
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
    Assert.throws(() => parseDTCG("{ nope"), /not valid JSON/);
});

Invalid("a document that is not an object", () => {
    Assert.throws(() => parseDTCG("[]"), /must be a JSON object/);
    Assert.throws(() => parseDTCG("3"), /must be a JSON object/);
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
        parseDTCG(token("palette", [1]), { types: ["palette"] }).t.$value[0],
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

Invalid("a recipe that is not registered, or used in the wrong place", () => {
    const registry = createPaletteRegistry();

    rejects(
        { t: { $type: "palette", $value: { $recipe: "nope" } } },
        /"nope" is not a registered recipe/,
        { recipes: registry },
    );
    rejects({ g: { $recipe: "nope" } }, /"nope" is not a registered recipe/, {
        recipes: registry,
    });
    rejects(
        { g: { $recipe: "createPalette" } },
        /is a value recipe: call it from the \$value of a token/,
        { recipes: registry },
    );
    rejects(
        { t: { $type: "color", $value: { $recipe: "createStates" } } },
        /is a group recipe: call it from a group/,
        { recipes: registry },
    );
});

Invalid("a recipe call with a bad key, type or params", () => {
    const registry = createPaletteRegistry();
    const call = { $recipe: "createPalette", $with: {} };

    rejects(
        { t: { $type: "palette", $value: { ...call, extra: 1 } } },
        /unsupported property "extra"/,
        { recipes: registry },
    );
    rejects(
        { t: { $type: "color", $value: call } },
        /produces "palette", but the token's type is "color"/,
        { recipes: registry },
    );
    rejects(
        { t: { $type: "palette", $value: { ...call, $with: [] } } },
        /\$with must be an object/,
        { recipes: registry },
    );
    rejects(
        {
            t: {
                $type: "palette",
                $value: { ...call, $with: { base: "{nope}" } },
            },
        },
        /references "\{nope\}", which does not exist/,
        { recipes: registry },
    );
});

Invalid("a group recipe that also has children", () => {
    rejects(
        {
            g: {
                $recipe: "createStates",
                $with: {},
                child: { $type: "number", $value: 1 },
            },
        },
        /cannot also have a child "child"/,
        { recipes: createPaletteRegistry() },
    );
});

Invalid("a DTCGError lists the path and message of each issue", () => {
    try {
        parseDTCG({ t: { $value: 1 } });
    } catch (error) {
        Assert.match(
            (error as Error).message,
            "Invalid design tokens document (1 issue)",
        );
        Assert.match((error as Error).message, "  t: has no $type");

        return;
    }

    throw new Error("The document was accepted.");
});

Types.run();
Aliases.run();
Format.run();
Metadata.run();
ColorModule.run();
Extends.run();
Pointers.run();
Recipes.run();
Invalid.run();
