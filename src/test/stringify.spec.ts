import { readFileSync } from "node:fs";
import { suite } from "uvu";
import * as Assert from "uvu/assert";
import { Library, configuredValueOf } from "../lib/library.js";
import { isRef } from "../lib/ref.js";
import { parse, type ParseOptions } from "../lib/parse.js";
import { recipes } from "../lib/recipe.js";
import { stringify, type StringifyStandardOptions } from "../lib/stringify.js";

const standard = (
    library: Library.Library<any, any>,
    options: Omit<StringifyStandardOptions, "format"> = {},
): Record<string, any> => JSON.parse(stringify(library, options));
const extended = (
    library: Library.Library<any, any>,
    options: { filter?: (token: Library.Token<any, any>) => boolean } = {},
): Record<string, any> =>
    JSON.parse(stringify(library, { ...options, format: "extended" }));
import { byIdentity } from "./helpers.js";

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

const create = (
    document: object,
    options: ParseOptions = {},
): Library.Library<any> =>
    Library.create<any>(parse(document, options), { types: options.types });

const srgb = (...components: number[]) => ({ colorSpace: "srgb", components });

const Standard = suite("stringify.standard");

const Recipes = recipes({
    darken: (color: any, amount: number) => ({
        ...color,
        components: color.components.map((c: number) => c * (1 - amount)),
    }),
});

/**
 * Everything observable about each token of a library, by name.
 */
const snapshot = (library: Library.Library<any, any>) => {
    const result: Record<string, unknown> = {};
    const visit = (group: any) => {
        for (const key of Object.keys(group)) {
            const child = group[key];

            if (typeof child?.name === "string") {
                result[child.name] = {
                    type: child.$type,
                    value: child.$value,
                    description: child.$description,
                    extensions: child.$extensions,
                    deprecated: child.$deprecated,
                };
            } else if (typeof child === "object" && child !== null) {
                visit(child);
            }
        }
    };

    visit(library.tokens);

    return result;
};

for (const name of ["format", "color", "extends"]) {
    Standard(`${name}.tokens.json survives a round trip`, () => {
        const library = create(fixture(name));
        const again = create(standard(library));

        Assert.equal(snapshot(again), snapshot(library));
    });
}

Standard(
    "the output is the text of the document, indented by four spaces",
    () => {
        const library = create(fixture("format"));
        const text = stringify(library);

        Assert.is(typeof text, "string");
        Assert.is(text, JSON.stringify(JSON.parse(text), null, 4));
        Assert.is(stringify(library, { format: "standard" }), text);
    },
);

Standard("the converters are an option of the standard form only", () => {
    const converters = { ratio: () => ({ $type: "number", $value: 1 }) };

    // @ts-expect-error The extended form has no converters.
    stringify(create({}), { format: "extended", converters });
    stringify(create({}), { format: "standard", converters });
});

Standard("the output is plain JSON", () => {
    const written = standard(create(fixture("format")));

    Assert.equal(JSON.parse(JSON.stringify(written)), written);
});

Standard("a token is written with $type and $value", () => {
    const written = standard(create(fixture("format")));

    Assert.equal(written.size.small, {
        $type: "dimension",
        $value: { value: 4, unit: "px" },
    });
    Assert.equal(written.font.mono, { $type: "fontFamily", $value: "Menlo" });
});

Standard("an alias is written as a reference, as the format has it", () => {
    const written = standard(create(fixture("format")));

    Assert.is(written.color.primary.$value, "{color.blue}");
    Assert.is(written.color.link.$value, "{color.primary}");
    // Including inside a composite value.
    Assert.is(written.border.thin.$value.color, "{color.blue}");
});

Standard("aliases survive a round trip as aliases", () => {
    const library = create(fixture("format"));
    const again = create(standard(library)) as any;

    Assert.ok(isRef(configuredValueOf(again.tokens.color.primary)));
    Assert.ok(
        isRef((configuredValueOf(again.tokens.border.thin) as any).color),
    );

    // Changing the target still changes the alias.
    again.tokens.color.blue.set(srgb(0, 1, 0));
    Assert.equal(again.tokens.color.primary.$value, srgb(0, 1, 0));
});

Standard("a ref to a token that is left out is written as its value", () => {
    const written = standard(create(fixture("format")), {
        filter: (token) => token.name !== "color.blue",
    });

    Assert.equal(written.color.primary.$value.components, [0, 0.4, 1]);
    Assert.is(written.color.blue, undefined);
});

Standard("a ref to a token a converter writes differently is a value", () => {
    const written = standard(
        create({
            size: {
                $type: "dimension",
                base: { $value: { value: 4, unit: "px" } },
                wide: { $value: "{size.base}" },
            },
        }),
        {
            converters: {
                dimension: (value: any) => ({
                    $type: "number",
                    $value: value.value,
                }),
            },
        },
    );

    Assert.equal(written.size.wide, { $type: "number", $value: 4 });
});

Standard("the current value is written, after a set()", () => {
    const library = create(fixture("format"));

    (library.tokens as any).color.blue.set(srgb(0, 1, 0) as any);

    Assert.equal(standard(library).color.blue.$value, srgb(0, 1, 0));
});

Standard("token and group metadata is kept", () => {
    const written = standard(create(fixture("format")));

    Assert.is(written.color.blue.$description, "The primary blue.");
    Assert.equal(written.color.blue.$extensions, {
        "com.example.figma": { id: "VariableID:1:2" },
    });
    Assert.is(written.color.legacy.$deprecated, "Use color.primary instead.");
    Assert.is(written.color.retired.$deprecated, true);
    Assert.is(written.color.$type, "color");
    Assert.match(written.color.$description, "Brand colors");
    Assert.equal(written.color.$extensions, {
        "com.example.group": { figmaCollection: "Brand" },
    });
});

Standard("nothing is written for a token with no metadata", () => {
    const written = standard(create(fixture("format")));

    Assert.equal(Object.keys(written.color.red).sort(), ["$type", "$value"]);
});

Standard("$root is written as a token", () => {
    const written = standard(create(fixture("format")));

    Assert.is(written.color.accent.$root.$value, "{color.blue}");
});

Standard("an extended library is written with its overrides", () => {
    const library = create(fixture("extends"));
    const written = standard(
        library.extend({ dark: { text: { $value: srgb(1, 0, 0) } } } as any),
    );

    Assert.equal(written.dark.text.$value, srgb(1, 0, 0));
    Assert.equal(written.base.text.$value, srgb(0, 0, 0));
});

Standard("the output is a copy", () => {
    const library = create(fixture("format"));
    const written = standard(library);

    written.color.blue.$value.components[0] = 1;

    Assert.is((library.tokens as any).color.blue.$value.components[0], 0);
});

Standard("a filter leaves tokens out, and the groups it empties", () => {
    const written = standard(create(fixture("format")), {
        filter: (token) =>
            token.$type !== "color" && token.name !== "size.small",
    });

    Assert.is(written.color, undefined);
    Assert.is(written.size.small, undefined);
    Assert.ok(written.size.base);
});

Standard("a filter runs before a token's value is read", () => {
    const library = create({
        a: { $type: "number", $value: 1 },
        b: { $type: "number", $value: "{a}" },
    });
    const read: string[] = [];

    standard(library, {
        filter: (token) => {
            read.push(token.name);

            return token.name === "a";
        },
    });

    Assert.equal(read, ["a", "b"]);
});

// --- Custom types and recipes ----------------------------------------------

const options = { types: byIdentity("ratio"), recipes: Recipes };
const document = () => fixture("compliant");

Standard("a custom type with no converter is an error that names it", () => {
    Assert.throws(
        () => standard(create(document(), options)),
        /Token "ratio" has the custom type "ratio", which has no standard form/,
    );
});

Standard("a custom type can be filtered out", () => {
    const written = standard(create(document(), options), {
        filter: (token) => token.$type !== "ratio",
    });

    Assert.is(written.ratio, undefined);
    Assert.is(written.steps, undefined);
    Assert.ok(written.color.blue);
});

Standard("a custom type can be converted to a standard type", () => {
    const written = standard(create(document(), options), {
        converters: {
            ratio: (value: number) => ({ $type: "number", $value: value }),
        },
    });

    Assert.equal(written.ratio, { $type: "number", $value: 1.5 });
    Assert.equal(written.steps.large, { $type: "number", $value: 1.5 });
    // A group's custom type is left out: each token has its own.
    Assert.is(written.steps.$type, undefined);
    // The converted document is read without the custom type.
    Assert.ok(parse(written));
});

Standard("a converter wins over the format for a standard type", () => {
    const written = standard(create(fixture("format")), {
        converters: {
            dimension: (value: any) => ({
                $type: "number",
                $value: value.value,
            }),
        },
    });

    Assert.equal(written.size.small, { $type: "number", $value: 4 });
});

Standard("a recipe's result is written as the value it computed", () => {
    const written = standard(
        create(
            {
                color: {
                    $type: "color",
                    blue: { $value: srgb(0, 0.4, 1) },
                    hover: { $value: "darken({color.blue}, 0.5)" },
                },
            },
            { recipes: Recipes },
        ),
    );

    Assert.equal(written.color.hover.$value, srgb(0, 0.2, 0.5));
    Assert.equal(written.color.blue.$value, srgb(0, 0.4, 1));
});

Standard.run();

// --- The extended form ---------------------------------------------------------

const Extended = suite("stringify.extended");

const ExtendedRecipes = recipes({
    ...Recipes,
    mix: ({ from, to }: { from: any; to: any }) => ({
        colorSpace: from.colorSpace,
        components: from.components.map(
            (c: number, i: number) => (c + to.components[i]) / 2,
        ),
    }),
    scale: (dimension: any, factor: number) => ({
        value: dimension.value * factor,
        unit: dimension.unit,
    }),
    createPalette: (base: any, count: number) =>
        Array.from({ length: count }, (_, i) => ({
            ...base,
            components: base.components.map((c: number) => c / (i + 1)),
        })),
});
const readOptions = {
    types: byIdentity("ratio", "steps", "palette"),
    recipes: ExtendedRecipes,
};

Extended("a recipe's call is written as the call, with its arguments", () => {
    const written = extended(
        create(fixture("recipes"), { recipes: ExtendedRecipes }),
    );

    Assert.is(written.color.hover.$value, "darken({color.blue}, 0.5)");
    Assert.is(
        written.color.pressed.$value,
        "darken(darken({color.blue}, {amount}), 0.5)",
    );
    Assert.is(
        written.color.mid.$value,
        'mix({"from": {color.blue}, "to": {color.white}})',
    );
    // A call inside a composite value.
    Assert.is(written.border.$value.color, "darken({color.blue}, {amount})");
    Assert.is(written.border.$value.width, "scale({size.base}, 0.25)");
    Assert.is(written.border.$value.style, "solid");
});

Extended("a ref is written as a reference, a value as it was given", () => {
    const written = extended(create(fixture("format")));

    Assert.is(written.color.primary.$value, "{color.blue}");
    Assert.is(written.border.thin.$value.color, "{color.blue}");
    Assert.equal(written.size.small, {
        $type: "dimension",
        $value: { value: 4, unit: "px" },
    });
});

Extended("a custom type is written with its own type and value", () => {
    const written = extended(create(fixture("custom-types"), readOptions));

    Assert.equal(written.ratio, { $type: "ratio", $value: 1.5 });
    Assert.is(written.scale.$type, "steps");
    Assert.equal(written.scale.base, {
        $type: "steps",
        $value: { from: 1, factor: "{ratio}", list: [1, "{ratio}"] },
    });
    Assert.is(written.scale.large.$value, "{scale.base}");
    Assert.is(
        written.color.palette.$value,
        "createPalette({color.blue}, {count})",
    );
    Assert.match(written.color.palette.$description, "A custom value");
});

for (const name of ["format", "color", "extends", "recipes", "custom-types"]) {
    Extended(
        `${name}.tokens.json is written the same after a round trip`,
        () => {
            const library = create(fixture(name), readOptions);
            const written = extended(library);

            Assert.equal(extended(create(written, readOptions)), written);
            Assert.equal(
                snapshot(create(written, readOptions)),
                snapshot(library),
            );
        },
    );
}

Extended("the library read back still computes and follows its refs", () => {
    const written = extended(create(fixture("custom-types"), readOptions));
    const again = create(written, readOptions) as any;

    Assert.is(again.tokens.color.palette.$value.length, 3);

    again.tokens.count.set(5);
    again.tokens.ratio.set(2);

    Assert.is(again.tokens.color.palette.$value.length, 5);
    Assert.equal(again.tokens.scale.large.$value.list, [1, 2]);
});

Extended("a filter leaves tokens out, and the groups it empties", () => {
    const written = extended(create(fixture("custom-types"), readOptions), {
        filter: (token) => token.$type === "ratio",
    });

    Assert.equal(
        Object.keys(written).filter((k) => !k.startsWith("$")),
        ["ratio"],
    );
});

Extended("a ref to a token that is left out is an error", () => {
    Assert.throws(
        () =>
            extended(create(fixture("custom-types"), readOptions), {
                filter: (token) => token.name !== "ratio",
            }),
        /Token "scale\.base" refers to "ratio", which the document doesn't have/,
    );
});

Extended(
    "a value that JSON can't hold is an error that names the token",
    () => {
        const library = Library.create<any>(
            { t: { $type: "when", $value: new Date(0) } },
            { types: byIdentity("when") },
        );

        Assert.throws(
            () => extended(library),
            /Token "t" has a value that a tokens document can't hold/,
        );
    },
);

Extended.run();
