import { suite } from "uvu";
import * as Assert from "uvu/assert";
import { DesignToken } from "../lib/design-token.js";
import * as Package from "../lib/index.js";
import { Library, dependenciesOf, dependentsOf } from "../lib/library.js";
import { recipes } from "../lib/recipe.js";
import { refs } from "../lib/ref.js";
import { hex } from "./values.js";

const Dependents = suite("dependentsOf()");
const C = DesignToken.Type.Color;

type ReadonlyColor = DesignToken.Values.Readonly.Color;

let evaluated = 0;

const Recipes = recipes({
    darken: (color: ReadonlyColor, amount: number): ReadonlyColor => {
        evaluated++;
        return {
            ...color,
            components: [
                Number(color.components[0]) * (1 - amount),
                Number(color.components[1]) * (1 - amount),
                Number(color.components[2]) * (1 - amount),
            ],
        };
    },
});

interface Theme {
    colors: {
        $type: DesignToken.Type.Color;
        primary: DesignToken.Color;
        alias: DesignToken.Color;
        hover: DesignToken.Color;
        pressed: DesignToken.Color;
        other: DesignToken.Color;
    };
}

const $ = refs<Theme>();

const theme = () =>
    Library.create<Theme>({
        colors: {
            $type: C,
            primary: { $value: hex("#336699") },
            alias: { $value: $.colors.primary },
            hover: { $value: Recipes.darken($.colors.primary, 0.2) },
            pressed: { $value: Recipes.darken($.colors.hover, 0.1) },
            other: { $value: hex("#ffffff") },
        },
    });

const names = (tokens: ReadonlyArray<{ name: string }>) =>
    tokens.map((token) => token.name);

Dependents("is exported by the package", () => {
    Assert.is(Reflect.get(Package, "dependentsOf"), dependentsOf);
});

Dependents(
    "are the tokens that refer to a token, in the library's order",
    () => {
        const { tokens } = theme();

        Assert.equal(dependentsOf(tokens.colors.primary), [
            tokens.colors.alias,
            tokens.colors.hover,
        ]);
        Assert.ok(Object.isFrozen(dependentsOf(tokens.colors.primary)));
    },
);

Dependents("are direct: not the dependents of the dependents", () => {
    const { tokens } = theme();

    Assert.equal(dependentsOf(tokens.colors.hover), [tokens.colors.pressed]);
    Assert.equal(dependentsOf(tokens.colors.pressed), []);
    Assert.equal(dependentsOf(tokens.colors.other), []);
});

Dependents("are the reverse of dependenciesOf()", () => {
    const { tokens } = theme();

    for (const token of Object.values(tokens.colors)) {
        if (typeof token !== "object" || !("$value" in token)) {
            continue;
        }
        for (const dependency of dependenciesOf(token)) {
            Assert.ok(dependentsOf(dependency).includes(token as any));
        }
    }
});

Dependents("are found without reading a value", () => {
    evaluated = 0;
    const library = theme();

    dependentsOf(library.tokens.colors.primary);
    dependentsOf(library.extend({}).tokens.colors.primary);

    Assert.is(evaluated, 0);
});

Dependents("are the tokens of the token's own library", () => {
    const source = theme();
    const extended = source.extend({});

    Assert.equal(dependentsOf(extended.tokens.colors.primary), [
        extended.tokens.colors.alias,
        extended.tokens.colors.hover,
    ]);
    Assert.equal(dependentsOf(source.tokens.colors.primary), [
        source.tokens.colors.alias,
        source.tokens.colors.hover,
    ]);
});

Dependents("follow a token set to a value with other refs", () => {
    const { tokens } = theme();

    Assert.equal(names(dependentsOf(tokens.colors.other)), []);

    tokens.colors.other.set($.colors.primary);
    Assert.equal(names(dependentsOf(tokens.colors.primary)), [
        "colors.alias",
        "colors.hover",
        "colors.other",
    ]);

    tokens.colors.alias.set(hex("#000000"));
    Assert.equal(names(dependentsOf(tokens.colors.primary)), [
        "colors.hover",
        "colors.other",
    ]);
});

Dependents("are of one library: a set in another doesn't change them", () => {
    const first = theme();
    const second = theme();

    Assert.equal(names(dependentsOf(first.tokens.colors.primary)), [
        "colors.alias",
        "colors.hover",
    ]);

    second.tokens.colors.other.set($.colors.primary);

    Assert.equal(names(dependentsOf(first.tokens.colors.primary)), [
        "colors.alias",
        "colors.hover",
    ]);
    Assert.equal(names(dependentsOf(second.tokens.colors.primary)), [
        "colors.alias",
        "colors.hover",
        "colors.other",
    ]);
});

Dependents("follow what an extension overrides", () => {
    const extended = theme().extend({
        colors: { hover: { $value: hex("#111111") } },
    });

    Assert.equal(dependentsOf(extended.tokens.colors.primary), [
        extended.tokens.colors.alias,
    ]);
    Assert.equal(dependentsOf(extended.tokens.colors.hover), [
        extended.tokens.colors.pressed,
    ]);
});

Dependents("of an extension follow a set of its source's token", () => {
    const source = theme();
    const extended = source.extend({});

    Assert.equal(dependentsOf(extended.tokens.colors.other), []);

    // `other` is the source's value, and follows the source
    source.tokens.colors.other.set($.colors.primary);

    Assert.equal(names(dependentsOf(extended.tokens.colors.primary)), [
        "colors.alias",
        "colors.hover",
        "colors.other",
    ]);
});

Dependents("are every token that may change, by following them", () => {
    const extended = theme().extend({});
    const affected = new Set<string>();
    const visit = (token: Library.Token<any, any>) => {
        for (const dependent of dependentsOf(token)) {
            if (!affected.has(dependent.name)) {
                affected.add(dependent.name);
                visit(dependent);
            }
        }
    };

    visit(extended.tokens.colors.primary);

    Assert.equal([...affected].sort(), [
        "colors.alias",
        "colors.hover",
        "colors.pressed",
    ]);
});

Dependents("throws for a token that isn't a token of a library", () => {
    Assert.throws(() => dependentsOf({ name: "a" } as any), /not a token/);
});

Dependents.run();
