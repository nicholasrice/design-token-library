import { suite } from "uvu";
import * as Assert from "uvu/assert";
import { spy } from "sinon";
import { DesignToken } from "../lib/design-token.js";
import * as Package from "../lib/index.js";
import { Library } from "../lib/library.js";
import { COMPUTED, RECIPE, recipes } from "../lib/recipe.js";
import { refs } from "../lib/ref.js";
import { Elevation } from "./custom-types.fixtures.js";
import { Equal, Expect, nextUpdate, recorder } from "./helpers.js";
import { hex, px } from "./values.js";

const Recipe = suite("recipes()");
const C = DesignToken.Type.Color;

type Color = DesignToken.Values.Color;
type Dimension = DesignToken.Values.Dimension;

/**
 * Pure functions of values, as a design system would have.
 */
const component = (value: number | "none") => (value === "none" ? 0 : value);
const scaleColor = (color: Color, factor: number): Color => ({
    colorSpace: color.colorSpace,
    components: [
        component(color.components[0]) * factor,
        component(color.components[1]) * factor,
        component(color.components[2]) * factor,
    ],
});
const scaleDimension = (dimension: Dimension, factor: number): Dimension => ({
    value: dimension.value * factor,
    unit: dimension.unit,
});
const sum = (...values: number[]) => values.reduce((a, b) => a + b, 0);
const withAlpha = (color: Color, alpha?: number): Color => ({
    ...color,
    alpha: alpha ?? 0.5,
});
const describeBorder = (border: { color: Color; width: Dimension }) =>
    `${border.width.value}${border.width.unit} ${border.color.colorSpace}`;

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

Recipe("recipes() is exported by the package", () => {
    Assert.is(Reflect.get(Package, "recipes"), recipes);
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

// Type-level: a recipe takes its function's arguments as refs, and returns
// a computed value of its result for the library the refs are of.
const darkened = darken($.colors.base, 0.5);
const unbound = darken(hex("#000000"), 0.5);
type RecipeTypes = [
    Expect<
        Equal<
            typeof darken,
            Library.Recipe<[color: Color, factor: number], Color>
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
};

Recipe("type-level assertions compile", () => {
    Assert.ok([recipeChecks, darkened, unbound]);
});

Recipe.run();
