import { suite } from "uvu";
import * as Assert from "uvu/assert";
import { spy } from "sinon";
import { DesignToken } from "../lib/design-token.js";
import * as Package from "../lib/index.js";
import { Library } from "../lib/library.js";
import { COMPUTED, RECIPE, override, recipes } from "../lib/recipe.js";
import { ref, refs } from "../lib/ref.js";
import { Elevation } from "./custom-types.fixtures.js";
import { Equal, Expect, nextUpdate, recorder } from "./helpers.js";
import { hex, px } from "./values.js";

const Recipe = suite("recipes()");
const Override = suite("override()");
const C = DesignToken.Type.Color;

type Color = DesignToken.Values.Color;
type Dimension = DesignToken.Values.Dimension;
type ReadonlyColor = DesignToken.Values.Readonly.Color;
type ReadonlyDimension = DesignToken.Values.Readonly.Dimension;

/**
 * Pure functions of values, as a design system would have. They take
 * readonly values, because a recipe's arguments are frozen.
 */
const component = (value: number | "none") => (value === "none" ? 0 : value);
const scaleColor = (color: ReadonlyColor, factor: number): Color => ({
    colorSpace: color.colorSpace,
    components: [
        component(color.components[0]) * factor,
        component(color.components[1]) * factor,
        component(color.components[2]) * factor,
    ],
});
const scaleDimension = (
    dimension: ReadonlyDimension,
    factor: number,
): Dimension => ({
    value: dimension.value * factor,
    unit: dimension.unit,
});
const sum = (...values: number[]) => values.reduce((a, b) => a + b, 0);
// Returns a readonly value: the library copies and freezes a recipe's result.
const withAlpha = (color: ReadonlyColor, alpha?: number): ReadonlyColor => ({
    ...color,
    alpha: alpha ?? 0.5,
});
const describeBorder = (border: {
    readonly color: ReadonlyColor;
    readonly width: ReadonlyDimension;
}) => `${border.width.value}${border.width.unit} ${border.color.colorSpace}`;

const Recipes = recipes({
    darken: scaleColor,
    scale: scaleDimension,
    sum,
    withAlpha,
    describeBorder,
});
const { darken } = Recipes;

interface Theme {
    colors: {
        $type: DesignToken.Type.Color;
        base: DesignToken.Color;
        dark: DesignToken.Color;
        darker: DesignToken.Color;
    };
    size: DesignToken.Dimension;
    factor: DesignToken.Number;
    border: DesignToken.Border;
    elevation: DesignToken.Custom<"elevation", Elevation>;
}

const $ = refs<Theme>();

const themeConfig = (): Library.Config<Theme> => ({
    colors: {
        $type: C,
        base: { $value: hex("#808080") },
        dark: { $value: darken($.colors.base, $.factor) },
        // A computed value as the argument of a recipe
        darker: { $value: darken(darken($.colors.base, 0.5), 0.5) },
    },
    size: { $type: DesignToken.Type.Dimension, $value: px(2) },
    factor: { $type: DesignToken.Type.Number, $value: 0.5 },
    border: {
        $type: DesignToken.Type.Border,
        $value: {
            color: darken($.colors.base, 0.5),
            width: Recipes.scale($.size, 2),
            style: "solid",
        },
    },
    // A custom value with a computed value as the value of a property
    elevation: {
        $type: "elevation",
        $value: {
            level: 1,
            shadowColor: darken($.colors.base, 0),
            offsets: [px(0), $.size],
        },
    },
});

const theme = () => Library.create(themeConfig());

Recipe("recipes() and override() are exported by the package", () => {
    Assert.is(Reflect.get(Package, "recipes"), recipes);
    Assert.is(Reflect.get(Package, "override"), override);
});

Recipe("a recipe has its name and function", () => {
    Assert.equal(darken[RECIPE], { name: "darken", fn: scaleColor });
    Assert.ok(Object.isFrozen(darken));
    Assert.ok(Object.isFrozen(Recipes));
});

Recipe("a computed value is its recipe and its arguments, as data", () => {
    const computed = darken($.colors.base, 0.5);

    Assert.is(computed[COMPUTED].recipe, darken);
    Assert.equal(computed[COMPUTED].args, [$.colors.base, 0.5]);
    Assert.ok(Object.isFrozen(computed));
    Assert.ok(Object.isFrozen(computed[COMPUTED].args));
});

Recipe("a recipe's function is called with the values of its refs", () => {
    const library = theme();
    const half = scaleColor(hex("#808080"), 0.5);

    Assert.equal(library.tokens.colors.dark.$value, half);
    Assert.equal(library.tokens.colors.darker.$value, scaleColor(half, 0.5));
    Assert.equal(library.tokens.border.$value.color, half);
    Assert.equal(library.tokens.border.$value.width, px(4));
    Assert.equal(
        library.tokens.elevation.$value.shadowColor,
        scaleColor(hex("#808080"), 0),
    );
});

Recipe("a recipe's function is not called until its token is read", () => {
    const fn = spy(scaleColor);
    const library = Library.create<Theme>({
        ...themeConfig(),
        colors: {
            $type: C,
            base: { $value: hex("#808080") },
            dark: { $value: recipes({ fn }).fn($.colors.base, 0.5) },
            darker: { $value: hex("#000000") },
        },
    });

    Assert.is(fn.callCount, 0);
    library.tokens.colors.dark.$value;
    library.tokens.colors.dark.$value;
    Assert.is(fn.callCount, 1);
});

Recipe(
    "a recipe's function is called again when a token it reads changes",
    async () => {
        const library = theme();
        library.tokens.colors.dark.$value;
        library.tokens.colors.darker.$value;
        const subscriber = recorder();
        library.subscribe(subscriber);

        library.tokens.colors.base.set(hex("#ffffff"));
        library.tokens.factor.set(0.25);
        await nextUpdate();

        Assert.equal(
            library.tokens.colors.dark.$value,
            scaleColor(hex("#ffffff"), 0.25),
        );
        Assert.equal(
            library.tokens.colors.darker.$value,
            scaleColor(hex("#ffffff"), 0.25),
        );
        Assert.equal(subscriber.batches, [
            ["colors.base", "colors.dark", "colors.darker", "factor"],
        ]);
    },
);

Recipe("a recipe resolves in the library it's read in, after extend()", () => {
    const library = theme();
    const extended = library.extend({
        colors: { base: { $value: hex("#ffffff") } },
        factor: { $value: 1 },
    });

    Assert.equal(extended.tokens.colors.dark.$value, hex("#ffffff"));
    Assert.equal(
        library.tokens.colors.dark.$value,
        scaleColor(hex("#808080"), 0.5),
    );
});

Recipe("a computed value can be given to set() and to extend()", () => {
    const library = theme();
    library.tokens.colors.dark.set(darken($.colors.darker, 2));
    const extended = library.extend({
        size: { $value: Recipes.scale(px(3), $.factor) },
    });

    Assert.equal(
        library.tokens.colors.dark.$value,
        scaleColor(scaleColor(scaleColor(hex("#808080"), 0.5), 0.5), 2),
    );
    Assert.equal(extended.tokens.size.$value, px(1.5));
});

Recipe("a cycle through a recipe throws a CircularReferenceError", () => {
    const library = theme();
    library.tokens.colors.base.set(darken($.colors.darker, 2));

    Assert.throws(
        () => library.tokens.colors.darker.$value,
        (error: unknown) =>
            error instanceof Package.CircularReferenceError &&
            error.chain.join(" ") === "colors.darker colors.base colors.darker",
    );
});

Recipe("an argument can be a value with refs in it", () => {
    const library = Library.create<
        Theme & { label: DesignToken.Custom<"label", string> }
    >({
        ...themeConfig(),
        label: {
            $type: "label",
            $value: Recipes.describeBorder({
                color: $.colors.base,
                width: $.size,
            }),
        },
    });

    Assert.is(library.tokens.label.$value, "2px srgb");
});

Recipe("optional and rest parameters take refs", () => {
    interface Numbers {
        a: DesignToken.Number;
        total: DesignToken.Number;
        color: DesignToken.Color;
        faded: DesignToken.Color;
        half: DesignToken.Color;
    }
    const n = refs<Numbers>();
    const library = Library.create<Numbers>({
        a: { $type: DesignToken.Type.Number, $value: 2 },
        total: {
            $type: DesignToken.Type.Number,
            $value: Recipes.sum(n.a, 3, n.a),
        },
        color: { $type: C, $value: hex("#ffffff") },
        faded: { $type: C, $value: Recipes.withAlpha(n.color) },
        half: { $type: C, $value: Recipes.withAlpha(n.color, n.a) },
    });

    Assert.is(library.tokens.total.$value, 7);
    Assert.is(library.tokens.faded.$value.alpha, 0.5);
    Assert.is(library.tokens.half.$value.alpha, 2);
});

Recipe("recipes are extended by spreading them", () => {
    const More = { ...Recipes, ...recipes({ tint: withAlpha }) };
    const library = Library.create<Theme>({
        ...themeConfig(),
        colors: {
            $type: C,
            base: { $value: hex("#808080") },
            dark: { $value: More.darken($.colors.base, 0.5) },
            darker: { $value: More.tint($.colors.base, 0.1) },
        },
    });

    Assert.equal(Object.keys(More), [
        "darken",
        "scale",
        "sum",
        "withAlpha",
        "describeBorder",
        "tint",
    ]);
    Assert.equal(
        library.tokens.colors.dark.$value,
        scaleColor(hex("#808080"), 0.5),
    );
    Assert.is(library.tokens.colors.darker.$value.alpha, 0.1);
});

Recipe("a recipe's arguments can be made by ref()", () => {
    const library = Library.create<Theme>({
        ...themeConfig(),
        colors: {
            $type: C,
            base: { $value: hex("#808080") },
            dark: { $value: darken(ref("colors.base"), ref("factor")) },
            darker: { $value: darken(darken(ref("colors.base"), 0.5), 0.5) },
        },
    });

    Assert.equal(
        library.tokens.colors.dark.$value,
        scaleColor(hex("#808080"), 0.5),
    );
});

Recipe("a computed value depends on each of its arguments", async () => {
    interface Pick {
        flag: DesignToken.Number;
        a: DesignToken.Color;
        b: DesignToken.Color;
        c: DesignToken.Color;
    }
    const { pick } = recipes({
        pick: (flag: number, a: Color, b: Color) => (flag ? a : b),
    });
    const library = Library.create<Pick>({
        flag: { $type: DesignToken.Type.Number, $value: 1 },
        a: { $type: C, $value: hex("#111111") },
        b: { $type: C, $value: hex("#222222") },
        c: { $type: C, $value: pick(ref("flag"), ref("a"), ref("b")) },
    });

    Assert.equal(library.tokens.c.$value, hex("#111111"));
    const subscriber = recorder();
    library.subscribe(subscriber);

    // The function doesn't use `b`, but a recipe's arguments are resolved first
    library.tokens.b.set(hex("#333333"));
    await nextUpdate();

    Assert.equal(subscriber.batches, [["b", "c"]]);
    Assert.equal(library.tokens.c.$value, hex("#111111"));
});

Recipe(
    "a throwing recipe does not track tokens read after it fails",
    async () => {
        interface Pair {
            a: DesignToken.Color;
            b: DesignToken.Color;
        }
        const { fail } = recipes({
            fail: (): Color => {
                throw new Error("recipe failed");
            },
        });
        const library = Library.create<Pair>({
            a: { $type: C, $value: fail() },
            b: { $type: C, $value: hex("#111111") },
        });
        Assert.throws(() => library.tokens.a.$value, /recipe failed/);

        library.tokens.b.$value;
        const subscriber = recorder();
        library.subscribe(subscriber);
        library.tokens.b.set(hex("#222222"));
        await nextUpdate();

        Assert.equal(subscriber.batches, [["b"]], "only b changed");
    },
);

Recipe(
    "a recipe builds a class value from the resolved values of its fields",
    () => {
        class Shade {
            constructor(
                readonly level: number,
                readonly blur: Dimension,
            ) {}
            get css() {
                return `0 ${this.level}px ${this.blur.value}${this.blur.unit}`;
            }
        }
        interface Shades {
            step: DesignToken.Number;
            raised: DesignToken.Custom<"shade", Shade>;
        }
        // The function is the class's build: it gets resolved fields, by name.
        const { shade } = recipes({
            shade: (fields: { level: number; blur: Dimension }) =>
                new Shade(fields.level, fields.blur),
        });
        const library = Library.create<Shades>({
            step: { $type: DesignToken.Type.Number, $value: 2 },
            raised: {
                $type: "shade",
                $value: shade({ level: ref("step"), blur: px(4) }),
            },
        });

        Assert.instance(library.tokens.raised.$value, Shade);
        Assert.is(library.tokens.raised.$value.css, "0 2px 4px");

        library.tokens.step.set(3);
        Assert.is(library.tokens.raised.$value.level, 3);
    },
);

Recipe("a class instance a recipe returns is returned as it is", () => {
    const instance = new Map([[1, 2]]);
    const library = Library.create<{
        m: DesignToken.Custom<"map", Map<number, number>>;
    }>({
        m: {
            $type: "map",
            $value: recipes({ map: () => instance }).map(),
        },
    });

    Assert.is(library.tokens.m.$value, instance);
});

Recipe("a recipe's function gets frozen arguments", () => {
    const seen: unknown[] = [];
    const { inspect } = recipes({
        inspect: (
            color: ReadonlyColor,
            border: { readonly width: ReadonlyDimension },
        ): Color => {
            seen.push(color, border, border.width);
            return hex("#000000");
        },
    });
    const library = Library.create<Theme>({
        ...themeConfig(),
        colors: {
            $type: C,
            base: { $value: hex("#808080") },
            dark: { $value: inspect($.colors.base, { width: $.size }) },
            darker: { $value: hex("#000000") },
        },
    });
    library.tokens.colors.dark.$value;

    Assert.ok(
        seen.length === 3 && seen.every((value) => Object.isFrozen(value)),
    );
});

Recipe("mutating a recipe's argument throws", () => {
    const { mutate } = recipes({
        // Typed mutable on purpose: the parameter isn't readonly.
        mutate: (dimension: Dimension): Dimension => {
            dimension.value = 0;
            return dimension;
        },
    });
    const library = Library.create<Theme>({
        ...themeConfig(),
        size: {
            $type: DesignToken.Type.Dimension,
            $value: mutate(px(2)),
        },
    });

    Assert.throws(() => library.tokens.size.$value, TypeError);
});

Recipe("a class instance argument is passed as it is, not frozen", () => {
    class Counter {
        count = 0;
    }
    const counter = new Counter();
    const { touch } = recipes({
        touch: (target: Counter): number => ++target.count,
    });
    const library = Library.create<{ n: DesignToken.Number }>({
        n: { $type: DesignToken.Type.Number, $value: touch(counter) },
    });

    Assert.is(library.tokens.n.$value, 1);
    Assert.not.ok(Object.isFrozen(counter));
});

Recipe(
    "a recipe can return a readonly value, which is copied and frozen",
    () => {
        const library = theme();
        const extended = library.extend({
            colors: {
                dark: { $value: Recipes.withAlpha($.colors.base, 0.25) },
            },
        });
        const value = extended.tokens.colors.dark.$value;

        Assert.is(value.alpha, 0.25);
        Assert.ok(Object.isFrozen(value));
    },
);

const red = (): Color => hex("#ff0000");
const invert = (color: ReadonlyColor, factor: number): Color =>
    scaleColor(color, 1 / factor);

Override(
    "an override replaces a recipe's function for every token that uses it",
    () => {
        const library = theme();
        const extended = library.extend(
            {},
            { recipes: [override(darken, invert)] },
        );
        const half = scaleColor(hex("#808080"), 0.5);

        // Tokens the extension doesn't restate
        Assert.equal(
            extended.tokens.colors.dark.$value,
            scaleColor(hex("#808080"), 2),
        );
        Assert.equal(
            extended.tokens.colors.darker.$value,
            scaleColor(scaleColor(hex("#808080"), 2), 2),
        );
        Assert.equal(
            extended.tokens.border.$value.color,
            scaleColor(hex("#808080"), 2),
        );
        // The source library is unchanged
        Assert.equal(library.tokens.colors.dark.$value, half);
    },
);

Override("an override applies to restated and new tokens", () => {
    const extended = theme().extend(
        {
            colors: { dark: { $value: darken($.colors.base, 4) } },
            accent: { $type: C, $value: darken($.colors.base, 4) },
        },
        { recipes: [override(darken, invert)] },
    );

    Assert.equal(
        extended.tokens.colors.dark.$value,
        scaleColor(hex("#808080"), 0.25),
    );
    Assert.equal(
        extended.tokens.accent.$value,
        scaleColor(hex("#808080"), 0.25),
    );
});

Override("only the overridden recipe is replaced", () => {
    const extended = theme().extend(
        {},
        { recipes: [override(Recipes.scale, () => px(10))] },
    );

    Assert.equal(extended.tokens.border.$value.width, px(10));
    Assert.equal(
        extended.tokens.colors.dark.$value,
        scaleColor(hex("#808080"), 0.5),
    );
});

Override("an override is kept by a library that extends the extension", () => {
    const extended = theme()
        .extend({}, { recipes: [override(darken, red)] })
        .extend({ factor: { $value: 1 } });

    Assert.equal(extended.tokens.colors.dark.$value, red());
});

Override("a later extension overrides the recipe again", () => {
    const extended = theme()
        .extend({}, { recipes: [override(darken, red)] })
        .extend({}, { recipes: [override(darken, invert)] });

    Assert.equal(
        extended.tokens.colors.dark.$value,
        scaleColor(hex("#808080"), 2),
    );
});

Override("an override is called with the values of the refs", () => {
    const fn = spy(invert);
    const extended = theme().extend({}, { recipes: [override(darken, fn)] });

    extended.tokens.colors.dark.$value;

    Assert.equal(fn.firstCall.args, [hex("#808080"), 0.5]);
});

// Type-level: a recipe takes its function's arguments as refs, and returns
// a computed value of its result for the library the refs are of.
const darkened = darken($.colors.base, 0.5);
const unbound = darken(hex("#000000"), 0.5);
type RecipeTypes = [
    Expect<
        Equal<
            typeof darken,
            Library.Recipe<[color: ReadonlyColor, factor: number], Color>
        >
    >,
    Expect<
        Equal<
            typeof darkened,
            Library.Computed<Color, Library.TokenValues<Theme>>
        >
    >,
    Expect<Equal<typeof unbound, Library.Computed<Color, {}>>>,
    Expect<
        Equal<
            ReturnType<typeof recipes<{ darken: typeof scaleColor }>>,
            { readonly darken: typeof darken }
        >
    >,
];

// Never called: these are type errors.
const recipeChecks = () => {
    // @ts-expect-error a Dimension is not a Color
    darken($.size, 0.5);
    // @ts-expect-error a Color is not a number
    darken($.colors.base, $.colors.dark);
    // @ts-expect-error a recipe takes its function's number of arguments
    darken($.colors.base);
    // @ts-expect-error a rest parameter's elements are checked
    Recipes.sum(1, $.size);

    Library.create<Theme>({
        ...themeConfig(),
        size: {
            $type: DesignToken.Type.Dimension,
            // @ts-expect-error a recipe's result is a value of its token's type
            $value: darken($.colors.base, 1),
        },
    });
    // @ts-expect-error a recipe's result is a value of its token's type
    theme().tokens.factor.set(darken($.colors.base, 1));

    // A recipe given refs of another library's shape is a type error
    const other = refs<{ c: DesignToken.Color }>();
    Library.create<{ a: DesignToken.Color }>({
        // @ts-expect-error the library has no `c`
        a: { $type: C, $value: darken(other.c, 1) },
    });

    // An override takes the recipe's arguments and returns its result's type
    // @ts-expect-error a Dimension parameter can't take a Color argument
    override(darken, (dimension: Dimension) => hex("#000000"));
    // @ts-expect-error the result is a Color
    override(darken, (color: Color) => 1);
    // A function that takes fewer arguments, or wider ones, is an override
    override(darken, red);
    override(darken, (color: ReadonlyColor | Dimension, factor?: number) =>
        hex("#000000"),
    );
};

Recipe("type-level assertions compile", () => {
    Assert.ok([recipeChecks, darkened, unbound]);
});

Recipe.run();
Override.run();
