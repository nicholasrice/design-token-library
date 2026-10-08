import { suite } from "uvu";
import * as Assert from "uvu/assert";
import { spy } from "sinon";
import { Library } from "../lib/library.js";
import { DesignToken } from "../lib/design-token.js";
import {
    Recipe,
    RecipeRegistry,
    isRef,
    resolveProps,
    resolveRef,
} from "../lib/recipe.js";
import { toCSS, toProperties } from "../lib/css-reflector.js";
import {
    PaletteTheme,
    closestIndexOf,
    createPalette,
    createPaletteRegistry,
    paletteTheme,
} from "./my-design-system/palette.js";
import { hex } from "./values.js";

const Registry = suite("Recipe.registry");
const fakeToken = ($value: unknown) => ({ $value });

const Resolve = suite("Recipe.resolve");
const ValueRecipe = suite("Recipe.$value");
const GroupRecipe = suite("Recipe.group");
const Cascade = suite("Recipe.cascade");
const Declarative = suite("Recipe.declarative");
const Extend = suite("Recipe.extend");
const Node = suite("Recipe.node");

function nextUpdate(): Promise<void> {
    return new Promise((resolve) => {
        queueMicrotask(resolve);
    });
}

const NEUTRAL = hex("#787878");
const ACCENT = hex("#09AEF6");

function createTheme() {
    return Library.create<PaletteTheme>(paletteTheme, {
        recipes: createPaletteRegistry(),
    });
}

// --- Registry -------------------------------------------------------------

Registry("register / get / has", () => {
    const registry = new RecipeRegistry();

    Assert.is(registry.has("createPalette"), false);
    registry.register(createPalette);
    Assert.is(registry.has("createPalette"), true);
    Assert.is(registry.get("createPalette"), createPalette);
    Assert.is(registry.get("missing"), undefined);
});

Registry("register throws on duplicate name", () => {
    const registry = new RecipeRegistry();
    registry.register(createPalette);
    Assert.throws(() => registry.register(createPalette), /already registered/);
});

// --- Reference resolver ---------------------------------------------------

Resolve("isRef recognizes reference strings", () => {
    Assert.is(isRef("{color.seed}"), true);
    Assert.is(isRef("{a.b.c}"), true);
    Assert.equal(isRef(hex("#FFFFFF")), false);
    Assert.is(isRef("color.seed"), false);
    Assert.is(isRef(42), false);
    Assert.is(isRef({}), false);
});

Resolve("resolveRef walks nested paths and returns the token value", () => {
    const context: any = { color: { seed: fakeToken(hex("#abcdef")) } };
    Assert.equal(resolveRef("{color.seed}", context, "x"), hex("#abcdef"));
});

Resolve("resolveRef throws on a missing path", () => {
    const context: any = { color: {} };
    Assert.throws(
        () => resolveRef("{color.missing}", context, 'Recipe "palette"'),
        /Recipe "palette" could not resolve reference "\{color\.missing\}"/,
    );
});

Resolve("resolveProps replaces refs in nested objects and arrays", () => {
    const context: any = { a: { b: fakeToken("V") } };
    const resolved = resolveProps(
        {
            direct: "{a.b}",
            literal: 5,
            list: [1, "{a.b}", 3],
            nested: { deep: "{a.b}" },
        },
        context,
        "x",
    );

    Assert.equal(resolved, {
        direct: "V",
        literal: 5,
        list: [1, "V", 3],
        nested: { deep: "V" },
    });
});

// --- Value recipe: color.<name>.palette is a single custom-typed token ------

ValueRecipe("produces one token with the custom type and a list value", () => {
    const library = createTheme();
    const palette = library.tokens.color.neutral.palette;

    Assert.is(palette.$type, "palette");
    Assert.is(palette.name, "color.neutral.palette");
    Assert.equal(palette.$value, [
        hex("#000000"),
        hex("#3C3C3C"),
        NEUTRAL,
        hex("#BCBCBC"),
        hex("#FFFFFF"),
    ]);
});

ValueRecipe("has stepCount colors and includes the base color", () => {
    const library = createTheme();
    const { neutral, accent } = library.tokens.color;

    Assert.is(neutral.palette.$value.length, 5);
    Assert.is(accent.palette.$value.length, 5);
    Assert.equal(neutral.palette.$value[2], NEUTRAL);
    Assert.equal(accent.palette.$value[2], ACCENT);
});

ValueRecipe("recomputes when stepCount changes", () => {
    const library = createTheme();
    const { neutral, accent } = library.tokens.color;

    Assert.is(neutral.palette.$value.length, 5);
    library.tokens.color.palette.stepCount.set(7);

    Assert.is(neutral.palette.$value.length, 7);
    Assert.is(accent.palette.$value.length, 7);
    // An odd count keeps the base at the midpoint.
    Assert.equal(neutral.palette.$value[3], NEUTRAL);
    Assert.equal(accent.palette.$value[3], ACCENT);
    Assert.equal(neutral.palette.$value[0], hex("#000000"));
    Assert.equal(neutral.palette.$value[6], hex("#FFFFFF"));
});

ValueRecipe("recomputes only the affected palette when a base changes", () => {
    const library = createTheme();
    const { neutral, accent } = library.tokens.color;
    const accentBefore = [...accent.palette.$value];

    neutral.base.set(hex("#FF0000"));

    Assert.equal(neutral.palette.$value[2], hex("#FF0000"));
    Assert.equal(accent.palette.$value, accentBefore);
});

ValueRecipe("create runs once per recomputation", () => {
    const library = createTheme();
    const create = spy(createPalette, "create");

    try {
        const palette = library.tokens.color.neutral.palette;
        palette.$value;
        palette.$value;
        Assert.is(create.callCount, 1, "cached on repeat reads");

        library.tokens.color.palette.stepCount.set(7);
        palette.$value;
        palette.$value;
        Assert.is(create.callCount, 2, "recomputed once after the change");
    } finally {
        create.restore();
    }
});

ValueRecipe("a palette can be overridden with set()", () => {
    const library = createTheme();
    const palette = library.tokens.color.neutral.palette;

    palette.set([hex("#111111"), hex("#222222")]);
    Assert.equal(palette.$value, [hex("#111111"), hex("#222222")]);
});

ValueRecipe("helpers over the plain value work without methods", () => {
    const library = createTheme();
    const palette = library.tokens.color.accent.palette.$value;

    Assert.equal(closestIndexOf(palette, ACCENT), 2);
    Assert.equal(closestIndexOf(palette, hex("#000001")), 0);
    Assert.equal(closestIndexOf(palette, hex("#FEFEFE")), 4);
});

// --- Group recipe: color.accent.states expands into fixed tokens ------------

GroupRecipe("expands into a fixed set of generated tokens", () => {
    const library = createTheme();
    const { states } = library.tokens.color.accent;

    Assert.equal(Object.keys(states), ["rest", "hover", "active", "focus"]);
    Assert.is(states.rest.$type, DesignToken.Type.Color);
    Assert.is(states.rest.name, "color.accent.states.rest");
});

GroupRecipe("derives its values from the palette via a helper", () => {
    const library = createTheme();
    const { states, palette } = library.tokens.color.accent;
    const colors = palette.$value;

    Assert.equal(states.rest.$value, ACCENT);
    Assert.equal(states.hover.$value, colors[3]);
    Assert.equal(states.active.$value, colors[1]);
    Assert.equal(states.focus.$value, colors[4]);
});

GroupRecipe("create runs once for all generated tokens", () => {
    const registry = createPaletteRegistry();
    const create = spy(registry.get("createStates")!, "create");

    try {
        const library = Library.create<PaletteTheme>(paletteTheme, {
            recipes: registry,
        });
        const { states } = library.tokens.color.accent;

        states.rest.$value;
        states.hover.$value;
        states.active.$value;
        states.focus.$value;
        Assert.is(create.callCount, 1, "four tokens share one computation");

        library.tokens.color.palette.stepCount.set(7);
        states.rest.$value;
        states.hover.$value;
        Assert.is(create.callCount, 2, "recomputed once after the change");
    } finally {
        create.restore();
    }
});

GroupRecipe("generated tokens are read-only", () => {
    const library = createTheme();
    Assert.throws(
        () =>
            library.tokens.color.accent.states.rest.set(hex("#FFFFFF") as any),
        /read-only/,
    );
});

GroupRecipe("flow through toCSS and toProperties", () => {
    const library = createTheme();

    const css = toCSS(library);
    Assert.ok(css.includes("--color.accent.states.rest:#09aef6;"), css);
    Assert.ok(css.includes("--color.neutral.base:#787878;"), css);
    Assert.ok(css.includes("--color.palette.stepCount:5;"), css);

    const properties = toProperties(library) as any;
    Assert.is(
        properties.color.accent.states.rest.property,
        "--color-accent-states-rest",
    );
});

GroupRecipe("a missing operator throws at create", () => {
    Assert.throws(
        () =>
            Library.create<PaletteTheme>(paletteTheme, {
                recipes: new RecipeRegistry(),
            }),
        /No recipe named "createPalette" is registered/,
    );
});

GroupRecipe("a group recipe that produces no keys throws", () => {
    const registry = new RecipeRegistry();
    const empty: Recipe<{ count: any }, {}> = {
        name: "empty",
        type: DesignToken.Type.Color,
        keys: (props) => Array.from({ length: props.count }, (_, i) => `${i}`),
        create: () => ({}),
    };
    registry.register(empty);

    // `count` is a reference, so it cannot be resolved when keys are derived.
    Assert.throws(
        () =>
            Library.create(
                {
                    group: {
                        $recipe: "empty",
                        $with: { count: "{somewhere.count}" },
                    },
                },
                { recipes: registry },
            ),
        /produced no keys/,
    );
});

// --- Cascading: stepCount -> palette -> (states -> focusRing, dark) ---------

Cascade("a base change cascades through every dependent level", () => {
    const library = createTheme();
    const { accent } = library.tokens.color;

    // At 7 steps `focus` is palette[5], which depends on the base. (At 5 steps
    // it is always the final white step, so it could not change.)
    library.tokens.color.palette.stepCount.set(7);

    const darkBefore = accent.dark.$value;
    const hoverBefore = accent.states.hover.$value;
    const focusRingBefore = accent.focusRing.$value;

    accent.base.set(hex("#FF8800"));

    Assert.equal(
        accent.palette.$value[3],
        hex("#FF8800"),
        "base is the midpoint",
    );
    Assert.equal(accent.states.rest.$value, hex("#FF8800"));
    Assert.equal(accent.palette.$value[0], hex("#000000"));
    Assert.is.not(accent.dark.$value, darkBefore, "computed token updated");
    Assert.is.not(accent.states.hover.$value, hoverBefore, "states updated");
    Assert.is.not(accent.focusRing.$value, focusRingBefore, "alias updated");
});

Cascade("a stepCount change reaches a computed token reading a palette", () => {
    const library = createTheme();
    const { accent } = library.tokens.color;
    const before = accent.dark.$value;

    library.tokens.color.palette.stepCount.set(7);

    Assert.is.not(accent.dark.$value, before);
    Assert.equal(accent.dark.$value, accent.palette.$value[1]);
});

Cascade("a stepCount change reaches a group recipe consuming a palette", () => {
    const library = createTheme();
    const { states, palette } = library.tokens.color.accent;

    Assert.equal(states.hover.$value, palette.$value[3]);
    library.tokens.color.palette.stepCount.set(7);

    const colors = palette.$value;
    Assert.is(colors.length, 7);
    Assert.equal(states.rest.$value, ACCENT);
    Assert.equal(states.hover.$value, colors[4]);
    Assert.equal(states.active.$value, colors[2]);
    Assert.equal(states.focus.$value, colors[5]);
});

Cascade(
    "a stepCount change reaches a token aliasing a recipe-of-a-recipe",
    () => {
        const library = createTheme();
        const { accent } = library.tokens.color;

        Assert.equal(accent.focusRing.$value, hex("#FFFFFF"));
        library.tokens.color.palette.stepCount.set(7);

        Assert.equal(accent.focusRing.$value, accent.palette.$value[5]);
        Assert.is.not(accent.focusRing.$value, hex("#FFFFFF"));
    },
);

Cascade(
    "notifies once per microtask with only the accessed tokens",
    async () => {
        const library = createTheme();
        const { neutral, accent } = library.tokens.color;
        const changed: string[] = [];
        let calls = 0;
        library.subscribe({
            onChange(tokens) {
                calls++;
                tokens.forEach((t) => changed.push(t.name));
            },
        });

        // Access some, but not all, of the dependents.
        neutral.palette.$value;
        accent.palette.$value;
        accent.states.rest.$value;
        accent.focusRing.$value;

        library.tokens.color.palette.stepCount.set(7);
        await nextUpdate();

        Assert.is(calls, 1);
        for (const name of [
            "color.palette.stepCount",
            "color.neutral.palette",
            "color.accent.palette",
            "color.accent.states.rest",
            "color.accent.focusRing",
        ]) {
            Assert.ok(changed.includes(name), `${name} should notify`);
        }
        Assert.not.ok(
            changed.includes("color.accent.states.hover"),
            "unaccessed generated token must not notify",
        );
    },
);

// --- Declarative: the whole library, recipes included, is JSON ---------------

Declarative("a library with recipes can be created from JSON", () => {
    const json = JSON.stringify({
        color: {
            palette: { stepCount: { $type: "number", $value: 3 } },
            neutral: {
                base: { $type: "color", $value: hex("#787878") },
                palette: {
                    $type: "palette",
                    $value: {
                        $recipe: "createPalette",
                        $with: {
                            base: "{color.neutral.base}",
                            steps: "{color.palette.stepCount}",
                        },
                    },
                },
            },
            accent: {
                base: { $type: "color", $value: hex("#09AEF6") },
                palette: {
                    $type: "palette",
                    $value: {
                        $recipe: "createPalette",
                        $with: {
                            base: "{color.accent.base}",
                            steps: "{color.palette.stepCount}",
                        },
                    },
                },
                states: {
                    $recipe: "createStates",
                    $with: {
                        base: "{color.accent.base}",
                        palette: "{color.accent.palette}",
                    },
                },
            },
        },
    });

    const library = Library.create(JSON.parse(json), {
        recipes: createPaletteRegistry(),
    }) as unknown as Library.Library<PaletteTheme>;
    const { neutral, accent } = library.tokens.color;

    Assert.equal(neutral.palette.$value, [
        hex("#000000"),
        hex("#787878"),
        hex("#FFFFFF"),
    ]);
    Assert.equal(accent.states.rest.$value, ACCENT);

    library.tokens.color.palette.stepCount.set(5);
    Assert.is(neutral.palette.$value.length, 5);
});

// --- Extend -----------------------------------------------------------------

Extend(
    "overriding stepCount recomputes a value recipe in the extension",
    () => {
        const library = createTheme();
        const extended = library.extend({
            color: { palette: { stepCount: { $value: 3 } } },
        } as any) as unknown as Library.Library<PaletteTheme>;

        Assert.is(extended.tokens.color.neutral.palette.$value.length, 3);
        Assert.is(library.tokens.color.neutral.palette.$value.length, 5);
    },
);

Extend("overriding a recipe's params keeps the shape", () => {
    const library = createTheme();
    const extended = library.extend({
        color: {
            accent: {
                palette: {
                    $value: {
                        $recipe: "createPalette",
                        $with: { base: hex("#FF0000") },
                    },
                },
            },
        },
    } as any) as unknown as Library.Library<PaletteTheme>;

    const palette = extended.tokens.color.accent.palette.$value;
    Assert.is(palette.length, 5, "steps still come from the source reference");
    Assert.equal(palette[2], hex("#FF0000"));
    Assert.equal(library.tokens.color.accent.palette.$value[2], ACCENT);
});

Extend("a group recipe follows inputs overridden in the extension", () => {
    const library = createTheme();
    const extended = library.extend({
        color: { palette: { stepCount: { $value: 7 } } },
    } as any) as unknown as Library.Library<PaletteTheme>;

    const { states, palette } = extended.tokens.color.accent;
    const colors = palette.$value;

    Assert.is(colors.length, 7);
    Assert.equal(states.hover.$value, colors[4], "uses the extended palette");
    Assert.equal(states.focus.$value, colors[5]);
    Assert.equal(
        extended.tokens.color.accent.focusRing.$value,
        colors[5],
        "aliases of generated tokens follow too",
    );

    // The source library is untouched.
    const source = library.tokens.color.accent;
    Assert.is(source.palette.$value.length, 5);
    Assert.equal(source.states.hover.$value, source.palette.$value[3]);
});

// --- Node schema and generated keys ----------------------------------------

const createNode = (node: object, recipes = createPaletteRegistry()) =>
    Library.create({ node } as any, { recipes }) as any;

const paletteNode = {
    $recipe: "createPalette",
    $with: { base: hex("#787878"), steps: 3 },
};

Node("rejects the unprefixed `with`, and says what to use", () => {
    Assert.throws(
        () => createNode({ $recipe: "createPalette", with: {} }),
        /unsupported key "with".*Did you mean "\$with"\?/,
    );
});

Node("rejects any other unsupported key instead of ignoring it", () => {
    Assert.throws(
        () => createNode({ ...paletteNode, extra: { $value: "x" } }),
        /unsupported key "extra"/,
    );
});

Node("$with is optional and must be an object", () => {
    const registry = new RecipeRegistry();
    registry.register({
        name: "constant",
        type: "palette",
        create: () => [hex("#000000")],
    });

    Assert.equal(
        createNode({ $value: { $recipe: "constant" } }, registry).tokens.node
            .$value,
        [hex("#000000")],
    );
    Assert.throws(
        () =>
            createNode(
                { $value: { $recipe: "constant", $with: "nope" } },
                registry,
            ),
        /must give \$with as an object/,
    );
});

Node(
    "a value recipe is called from $value, a group recipe from a group",
    () => {
        Assert.throws(
            () => createNode({ $recipe: "createPalette", $with: {} }),
            /value recipe.*must be a token that calls it from its \$value/,
        );
        Assert.throws(
            () => createNode({ $value: { $recipe: "createStates" } }),
            /group recipe.*must be a group that calls it, not a token/,
        );
    },
);

Node("rejects an unsupported key in a value recipe's call", () => {
    Assert.throws(
        () => createNode({ $value: { ...paletteNode, extra: 1 } }),
        /\$value of "node" has an unsupported key "extra"/,
    );
});

Node("passes the token's own properties to a value recipe's token", () => {
    const token = createNode({
        $value: paletteNode,
        $description: "A neutral ramp",
        $extensions: { note: 1 },
        $deprecated: "use another",
    }).tokens.node;

    Assert.is(token.$description, "A neutral ramp");
    Assert.equal(token.$extensions, { note: 1 });
    Assert.is(token.$deprecated, "use another");
    Assert.is(token.$value.length, 3);
});

Node("a group recipe carries the group's properties", () => {
    const group = createNode({
        $recipe: "createStates",
        $with: {
            base: hex("#09AEF6"),
            palette: [hex("#000000"), hex("#09AEF6"), hex("#FFFFFF")],
        },
        $description: "States",
        $extensions: { note: 1 },
        $deprecated: true,
    }).tokens.node;

    Assert.is(group.$description, "States");
    Assert.equal(group.$extensions, { note: 1 });
    Assert.is(group.$type, "color");
    Assert.is(group.rest.$deprecated, true);
    Assert.equal(Object.keys(group), ["rest", "hover", "active", "focus"]);
});

Node(
    "accepts a $type that matches the recipe and rejects one that does not",
    () => {
        Assert.is(
            createNode({ $value: paletteNode, $type: "palette" }).tokens.node
                .$type,
            "palette",
        );
        Assert.throws(
            () => createNode({ $value: paletteNode, $type: "color" }),
            /produces type "palette", but "node" declares \$type "color"/,
        );
    },
);

Node("a group recipe may generate keys named like node properties", () => {
    const registry = new RecipeRegistry();
    registry.register({
        name: "named",
        type: DesignToken.Type.Color,
        keys: () => ["with", "recipe", "type"],
        create: () => ({
            with: hex("#111111"),
            recipe: hex("#222222"),
            type: hex("#333333"),
        }),
    });
    const node = createNode({ $recipe: "named" }, registry).tokens.node;

    Assert.equal(Object.keys(node), ["with", "recipe", "type"]);
    Assert.equal(node.with.$value, hex("#111111"));
    Assert.equal(node.type.$value, hex("#333333"));
});

for (const [label, keys, expected] of [
    ["begins with $", ["$x"], /"\$x"/],
    ["contains a dot", ["a.b"], /"a\.b"/],
    ["contains a brace", ["{x}"], /"\{x\}"/],
    ["is empty", [""], /""/],
    ["is repeated", ["a", "a"], /"a" more than once/],
] as const) {
    Node(`a generated key that ${label} is rejected`, () => {
        const registry = new RecipeRegistry();
        registry.register({
            name: "bad",
            type: DesignToken.Type.Color,
            keys: () => [...keys],
            create: () => ({}),
        });

        Assert.throws(() => createNode({ $recipe: "bad" }, registry), expected);
    });
}

Registry.run();
Resolve.run();
ValueRecipe.run();
GroupRecipe.run();
Cascade.run();
Declarative.run();
Extend.run();
Node.run();
