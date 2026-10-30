import { suite } from "uvu";
import * as Assert from "uvu/assert";
import { convert, toCSS } from "../lib/css-reflector.js";
import { DesignToken } from "../lib/design-token.js";
import * as Package from "../lib/index.js";
import { Library, configuredValueOf } from "../lib/library.js";
import { isComputed, recipes } from "../lib/recipe.js";
import { isRef, pathOf, ref, refs } from "../lib/ref.js";
import { Equal, Expect } from "./helpers.js";
import { hex, px } from "./values.js";

const Computed = suite("isComputed()");
const Configured = suite("configuredValueOf()");
const C = DesignToken.Type.Color;

type ReadonlyColor = DesignToken.Values.Readonly.Color;

const Recipes = recipes({
    darken: (color: ReadonlyColor, amount: number): ReadonlyColor => ({
        ...color,
        components: [
            Number(color.components[0]) * (1 - amount),
            Number(color.components[1]) * (1 - amount),
            Number(color.components[2]) * (1 - amount),
        ],
    }),
    mix: (colors: readonly ReadonlyColor[]): ReadonlyColor => colors[0],
    gray: (level: number) => hex(level > 0.5 ? "#cccccc" : "#333333"),
});

/**
 * The fills of a control, as Adaptive UI's treatments: each refers to a
 * color token, which a renderer writes as a `var()`.
 */
interface Treatment {
    background: DesignToken.Values.Color;
    foreground: DesignToken.Values.Color;
}

interface Theme {
    colors: {
        $type: DesignToken.Type.Color;
        primary: DesignToken.Color;
        alias: DesignToken.Color;
        hover: DesignToken.Color;
        mixed: DesignToken.Color;
        gray: DesignToken.Color;
    };
    border: DesignToken.Border;
    control: DesignToken.Custom<"treatment", Treatment>;
}

const $ = refs<Theme>();

const theme = () =>
    Library.create<Theme>({
        colors: {
            $type: C,
            primary: { $value: hex("#336699") },
            alias: { $value: $.colors.primary },
            hover: { $value: Recipes.darken($.colors.primary, 0.2) },
            mixed: {
                $value: Recipes.mix([
                    $.colors.alias,
                    Recipes.darken($.colors.hover, 0.1),
                    $.colors.alias,
                ]),
            },
            gray: { $value: Recipes.gray(0.8) },
        },
        border: {
            $type: DesignToken.Type.Border,
            $value: { color: $.colors.primary, width: px(1), style: "solid" },
        },
        control: {
            $type: "treatment",
            $value: { background: $.colors.hover, foreground: hex("#ffffff") },
        },
    });

/**
 * The rule of Adaptive UI's designer: a token is given when its configured
 * value has no ref and no computed value at any depth, and derived otherwise.
 */
const isGiven = (value: unknown): boolean =>
    !isRef(value) &&
    !isComputed(value) &&
    (typeof value !== "object" ||
        value === null ||
        Object.values(value).every(isGiven));

Computed("isComputed() is exported by the package", () => {
    Assert.is(Reflect.get(Package, "isComputed"), isComputed);
});

Computed("a recipe's result is a computed value", () => {
    Assert.ok(isComputed(Recipes.darken($.colors.primary, 0.2)));
    Assert.ok(isComputed(Recipes.gray(0.8)));
});

Computed("a computed value made by another copy of the package is one", () => {
    const foreign = {
        [Symbol.for("design-token-library.computed")]: { recipe: {}, args: [] },
    };

    Assert.ok(isComputed(foreign));
});

Computed("a value that isn't a computed value isn't one", () => {
    const library = theme();

    for (const value of [
        null,
        undefined,
        0,
        {},
        hex("#111111"),
        $.colors.primary,
        Recipes.darken,
        // A value with a computed value in it, and the value it resolves to
        [Recipes.gray(0.8)],
        library.tokens.colors.hover.$value,
    ]) {
        Assert.not.ok(isComputed(value));
    }
});

Configured("configuredValueOf() is exported by the package", () => {
    Assert.is(Reflect.get(Package, "configuredValueOf"), configuredValueOf);
});

Configured("has the refs and computed values of the config", () => {
    const library = theme();

    Assert.ok(isRef(configuredValueOf(library.tokens.colors.alias)));
    Assert.is(configuredValueOf(library.tokens.colors.alias), $.colors.primary);
    Assert.ok(isComputed(configuredValueOf(library.tokens.colors.hover)));

    const border = configuredValueOf(library.tokens.border);
    Assert.ok(!isRef(border) && !isComputed(border) && isRef(border.color));
});

Configured("is the value the token holds, not a copy", () => {
    const primary = hex("#336699");
    const library = Library.create<Pick<Theme, "border">>({
        border: {
            $type: DesignToken.Type.Border,
            $value: { color: primary, width: px(1), style: "solid" },
        },
    });
    const border = configuredValueOf(library.tokens.border);

    Assert.ok(!isRef(border) && !isComputed(border));
    Assert.is(border.color, primary);
    Assert.not.ok(Object.isFrozen(border));
});

Configured("is the value last given to set()", () => {
    const library = theme();
    const hover = Recipes.darken($.colors.alias, 0.5);

    library.tokens.colors.alias.set(hex("#000000"));
    library.tokens.colors.hover.set(hover);

    Assert.equal(
        configuredValueOf(library.tokens.colors.alias),
        hex("#000000"),
    );
    Assert.is(configuredValueOf(library.tokens.colors.hover), hover);
});

Configured(
    "an extension's token has its source's value until it has its own",
    () => {
        const source = theme();
        const extended = source.extend({
            colors: { hover: { $value: hex("#000000") } },
        });

        Assert.is(
            configuredValueOf(extended.tokens.colors.alias),
            configuredValueOf(source.tokens.colors.alias),
        );
        Assert.equal(
            configuredValueOf(extended.tokens.colors.hover),
            hex("#000000"),
        );

        // It follows the source's set(), as its value does.
        source.tokens.colors.alias.set($.colors.hover);
        Assert.is(
            configuredValueOf(extended.tokens.colors.alias),
            $.colors.hover,
        );

        extended.tokens.colors.alias.set(hex("#111111"));
        Assert.equal(
            configuredValueOf(extended.tokens.colors.alias),
            hex("#111111"),
        );
        Assert.is(
            configuredValueOf(source.tokens.colors.alias),
            $.colors.hover,
        );
    },
);

Configured("tells a given token from a derived one", () => {
    const library = theme();
    const given = ({ tokens }: Library.Library<Theme>) => [
        isGiven(configuredValueOf(tokens.colors.primary)),
        isGiven(configuredValueOf(tokens.colors.alias)),
        isGiven(configuredValueOf(tokens.colors.hover)),
        // A recipe with only literal arguments is derived.
        isGiven(configuredValueOf(tokens.colors.gray)),
        // A ref deep in a value makes it derived.
        isGiven(configuredValueOf(tokens.border)),
    ];

    Assert.equal(given(library), [true, false, false, false, false]);

    // A literal in place of a recipe makes the token given.
    const extended = library.extend({
        colors: { gray: { $value: hex("#999999") } },
    });
    Assert.equal(given(extended), [true, false, false, true, false]);
});

Configured("a converter writes a ref in a value as a var()", () => {
    const library = theme().extend({
        colors: { hover: { $value: hex("#000000") } },
    });
    const name = (path: readonly string[]) => `--${path.join("-")}`;

    const css = toCSS(library, {
        converters: {
            treatment: (value, token) => {
                const configured = configuredValueOf(token);
                if (isRef(configured) || isComputed(configured)) {
                    return "";
                }

                return (["background", "foreground"] as const)
                    .map((key) => {
                        const fill = configured[key];
                        return `${key}: ${
                            isRef(fill)
                                ? `var(${name(pathOf(fill))})`
                                : convert("color", value[key])
                        }`;
                    })
                    .join("; ");
            },
        },
    });

    Assert.ok(
        css.includes(
            "--control:background: var(--colors-hover); foreground: #ffffff;",
        ),
        css,
    );
});

// The configured value has the types of the values set() takes, so it can be
// given back to set().
const typed = theme();
type ConfiguredTypes = [
    Expect<
        Equal<
            ReturnType<
                typeof configuredValueOf<
                    DesignToken.Color,
                    Theme,
                    DesignToken.Type.Color
                >
            >,
            | Library.ConfigTokenValue<DesignToken.Color, Theme>
            | DesignToken.Values.Readonly.Color
        >
    >,
    Expect<
        Equal<
            Parameters<typeof typed.tokens.colors.alias.set>[0],
            ReturnType<
                typeof configuredValueOf<
                    DesignToken.Color,
                    Theme,
                    DesignToken.Type.Color
                >
            >
        >
    >,
];
typed.tokens.colors.alias.set(configuredValueOf(typed.tokens.colors.hover));

Configured("type-level assertions compile", () => {
    Assert.ok(true);
});

Computed.run();
Configured.run();
