import { suite } from "uvu";
import * as Assert from "uvu/assert";
import { DesignToken } from "../lib/design-token.js";
import * as Package from "../lib/index.js";
import { Library } from "../lib/library.js";
import { REF, refs } from "../lib/ref.js";
import { Elevation } from "./custom-types.fixtures.js";
import { Equal, Expect, nextUpdate, recorder } from "./helpers.js";
import { hex, px } from "./values.js";

const Refs = suite("refs()");
const C = DesignToken.Type.Color;

interface Theme {
    colors: {
        $type: DesignToken.Type.Color;
        $root: DesignToken.Color;
        primary: DesignToken.Color;
        link: DesignToken.Color;
    };
    size: DesignToken.Dimension;
    weight: DesignToken.Number;
    border: DesignToken.Border;
    curve: DesignToken.CubicBezier;
    elevation: DesignToken.Custom<"elevation", Elevation>;
}

const $ = refs<Theme>();

const themeConfig = (): Library.Config<Theme> => ({
    colors: {
        $type: C,
        $root: { $value: $.colors.primary },
        primary: { $value: hex("#111111") },
        link: { $value: $.colors.$root },
    },
    size: { $type: DesignToken.Type.Dimension, $value: px(2) },
    weight: { $type: DesignToken.Type.Number, $value: 0.5 },
    border: {
        $type: DesignToken.Type.Border,
        $value: { color: $.colors.link, width: $.size, style: "solid" },
    },
    curve: {
        $type: DesignToken.Type.CubicBezier,
        $value: [$.weight, 0, 1, 1],
    },
    // A custom value: an object with a ref as the value of a property.
    elevation: {
        $type: "elevation",
        $value: {
            level: 1,
            shadowColor: $.colors.primary,
            offsets: [$.size, px(0)],
        },
    },
});

const theme = () => Library.create(themeConfig());

Refs("refs() is exported by the package", () => {
    Assert.is(Reflect.get(Package, "refs"), refs);
});

Refs("a ref resolves to the value of its token, at any depth", () => {
    const library = theme();

    Assert.equal(library.tokens.colors.$root.$value, hex("#111111"));
    Assert.equal(library.tokens.colors.link.$value, hex("#111111"));
    Assert.equal(library.tokens.border.$value, {
        color: hex("#111111"),
        width: px(2),
        style: "solid",
    });
    Assert.equal(library.tokens.curve.$value, [0.5, 0, 1, 1]);
    Assert.equal(library.tokens.elevation.$value, {
        level: 1,
        shadowColor: hex("#111111"),
        offsets: [px(2), px(0)],
    });
});

Refs("a ref is the path of its token, as data", () => {
    Assert.equal($.colors.primary[REF], ["colors", "primary"]);
    Assert.equal($.colors.$root[REF], ["colors", "$root"]);
});

Refs("a path is always the same ref", () => {
    Assert.is($.colors.primary, $.colors.primary);
    Assert.is.not($.colors.primary, refs<Theme>().colors.primary);
});

Refs("a ref is frozen", () => {
    Assert.equal(Object.keys($.colors.primary), []);
    Assert.ok(Object.isFrozen($.colors.primary));
    Assert.throws(() => {
        // @ts-expect-error a ref is readonly
        $.colors = $.size;
    });
});

Refs(
    "a token with a ref changes when the token it refers to changes",
    async () => {
        const library = theme();
        library.tokens.border.$value;
        library.tokens.elevation.$value;
        const subscriber = recorder();
        library.subscribe(subscriber);

        library.tokens.colors.primary.set(hex("#222222"));
        await nextUpdate();

        Assert.equal(library.tokens.border.$value.color, hex("#222222"));
        Assert.equal(
            library.tokens.elevation.$value.shadowColor,
            hex("#222222"),
        );
        Assert.equal(subscriber.batches.length, 1);
        Assert.ok(subscriber.batches[0].includes("border"));
        Assert.ok(subscriber.batches[0].includes("elevation"));
    },
);

Refs("a ref can be given to set() and to extend()", () => {
    const library = theme();
    library.tokens.colors.link.set($.colors.primary);
    library.tokens.colors.primary.set(hex("#333333"));

    Assert.equal(library.tokens.colors.link.$value, hex("#333333"));

    const extended = library.extend({
        colors: { primary: { $value: hex("#444444") } },
        border: {
            $value: { color: $.colors.primary, width: px(1), style: "dashed" },
        },
    });

    Assert.equal(extended.tokens.border.$value.color, hex("#444444"));
});

Refs("a ref resolves in the library it's read in, after extend()", () => {
    const library = theme();
    const extended = library.extend({
        colors: { primary: { $value: hex("#555555") } },
    });

    Assert.equal(extended.tokens.border.$value.color, hex("#555555"));
    Assert.equal(library.tokens.border.$value.color, hex("#111111"));
});

Refs("the same refs serve every library of the shape", () => {
    const one = theme();
    const two = theme();
    two.tokens.colors.primary.set(hex("#666666"));

    Assert.equal(one.tokens.colors.link.$value, hex("#111111"));
    Assert.equal(two.tokens.colors.link.$value, hex("#666666"));
});

Refs("a ref to a path that isn't a token throws when it's read", () => {
    // A shape the library doesn't have
    const loose = refs<{
        colors: { primary: DesignToken.Color; secondary: DesignToken.Color };
        sizes: { small: { base: DesignToken.Dimension } };
    }>();
    const library = Library.create<any>({
        colors: { $type: C, primary: { $value: hex("#111111") } },
        missing: { $type: C, $value: loose.colors.secondary },
        group: { $type: C, $value: loose.colors },
        deep: { $type: C, $value: loose.sizes.small.base },
    });

    Assert.throws(
        () => library.tokens.missing.$value,
        /The library has no token "colors.secondary"/,
    );
    Assert.throws(
        () => library.tokens.group.$value,
        /The library has no token "colors"/,
    );
    Assert.throws(
        () => library.tokens.deep.$value,
        /The library has no token "sizes.small.base"/,
    );
});

// Type-level: a ref has the value type of its token and the library's token values.
type RefTypes = [
    Expect<
        Equal<
            typeof $.colors.primary,
            Library.Ref<DesignToken.Values.Color, Library.TokenValues<Theme>>
        >
    >,
    Expect<
        Equal<
            typeof $.colors.$root,
            Library.Ref<DesignToken.Values.Color, Library.TokenValues<Theme>>
        >
    >,
    Expect<
        Equal<typeof $.weight, Library.Ref<number, Library.TokenValues<Theme>>>
    >,
];

// Never called: these configs are type errors.
const refChecks = () => {
    // @ts-expect-error a group's metadata has no ref
    $.colors.$type;
    // @ts-expect-error the library has no token with that name
    $.colors.secondary;

    Library.create<Theme>({
        ...themeConfig(),
        // @ts-expect-error a ref resolves to a value of its token's type
        size: { $type: DesignToken.Type.Dimension, $value: $.colors.primary },
    });
    // @ts-expect-error a ref resolves to a value of its token's type
    theme().tokens.size.set($.weight);

    // A ref to a library of another shape is a type error
    interface Other {
        colors: { primary: DesignToken.Color };
    }
    const other = refs<Other>();
    Library.create<{ a: DesignToken.Color }>({
        // @ts-expect-error the library has no `colors.primary`
        a: { $type: C, $value: other.colors.primary },
    });
};

// A ref of the shape a function needs works in any library that has it (#68).
interface Needs {
    size: { base: DesignToken.Dimension };
}
const needs = refs<Needs>();
function spacing<Root extends Needs>(): Library.Config<
    { $type: DesignToken.Type.Dimension; gap: DesignToken.Dimension },
    Root
> {
    return {
        $type: DesignToken.Type.Dimension,
        gap: { $value: needs.size.base },
    };
}
interface WithSpacing extends Needs {
    spacing: { $type: DesignToken.Type.Dimension; gap: DesignToken.Dimension };
}

Refs("a ref of a shape that a library extends resolves in the library", () => {
    const library = Library.create<WithSpacing>({
        size: {
            base: { $type: DesignToken.Type.Dimension, $value: px(8) },
        },
        spacing: spacing<WithSpacing>(),
    });

    Assert.equal(library.tokens.spacing.gap.$value, px(8));
});

Refs("type-level assertions compile", () => {
    Assert.ok([refChecks]);
});

Refs.run();
