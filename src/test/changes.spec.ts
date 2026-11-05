import { suite } from "uvu";
import * as Assert from "uvu/assert";
import { DesignToken } from "../lib/design-token.js";
import * as Package from "../lib/index.js";
import { Library, changesOf } from "../lib/library.js";
import { override, recipes } from "../lib/recipe.js";
import { refs } from "../lib/ref.js";
import { hex } from "./values.js";

const Changes = suite("changesOf()");
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

Changes("is exported by the package", () => {
    Assert.is(Reflect.get(Package, "changesOf"), changesOf);
});

Changes("an extension that sets nothing changes nothing", () => {
    Assert.equal(changesOf(theme().extend({})), []);
});

Changes("a token set in an extension, and what depends on it", () => {
    const extension = theme().extend({});
    extension.tokens.colors.primary.set(hex("#000000"));

    Assert.equal(names(changesOf(extension)), [
        "colors.primary",
        "colors.alias",
        "colors.hover",
        "colors.pressed",
    ]);
    Assert.ok(Object.isFrozen(changesOf(extension)));
});

Changes("a token the extension's config gives a value", () => {
    const extension = theme().extend({
        colors: { other: { $value: hex("#eeeeee") } },
    });

    Assert.equal(names(changesOf(extension)), ["colors.other"]);
});

Changes("a token set to the value it has isn't changed", () => {
    const extension = theme().extend({});
    extension.tokens.colors.other.set(hex("#ffffff"));

    Assert.equal(names(changesOf(extension)), ["colors.other"]);
});

Changes("a token a source sets follows it, so it isn't the extension's", () => {
    const source = theme();
    const extension = source.extend({});
    source.tokens.colors.primary.set(hex("#000000"));

    Assert.equal(changesOf(extension), []);
});

Changes("a token that is new in the extension", () => {
    const extension = theme().extend<{
        extra: DesignToken.Color;
    }>({
        extra: { $type: C, $value: hex("#123456") },
    });

    Assert.equal(names(changesOf(extension)), ["extra"]);
});

Changes("a token that calls a recipe the extension replaces", () => {
    const extension = theme().extend(
        {},
        { recipes: [override(Recipes.darken, (color) => color)] },
    );

    Assert.equal(names(changesOf(extension)), [
        "colors.hover",
        "colors.pressed",
    ]);
});

Changes("is relative to the library the extension extends", () => {
    const first = theme().extend({});
    first.tokens.colors.primary.set(hex("#111111"));
    const second = first.extend({});
    second.tokens.colors.other.set(hex("#222222"));

    Assert.equal(names(changesOf(second)), ["colors.other"]);
    Assert.equal(names(changesOf(first)), [
        "colors.primary",
        "colors.alias",
        "colors.hover",
        "colors.pressed",
    ]);
});

Changes("reads no value", () => {
    let evaluated = 0;
    const counted = recipes({
        same: (color: ReadonlyColor): ReadonlyColor => {
            evaluated++;
            return color;
        },
    });
    const library = Library.create<Theme>({
        colors: {
            $type: C,
            primary: { $value: hex("#336699") },
            alias: { $value: $.colors.primary },
            hover: { $value: counted.same($.colors.primary) },
            pressed: { $value: hex("#000000") },
            other: { $value: hex("#ffffff") },
        },
    });
    const extension = library.extend({});
    extension.tokens.colors.primary.set(hex("#000000"));
    changesOf(extension);

    Assert.is(evaluated, 0);
});

Changes("a library that extends nothing has every token as its own", () => {
    Assert.is(changesOf(theme()).length, 5);
});

Changes.run();
