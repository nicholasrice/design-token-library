import { suite } from "uvu";
import * as Assert from "uvu/assert";
import { DesignToken } from "../lib/design-token.js";
import { override } from "../lib/recipe.js";
import { Clamp, Pick, Shade, at } from "./recipes.fixtures.js";
import { nextUpdate, specTest } from "./helpers.js";
import {
    changeRecorder,
    create,
    entriesOfBatch,
    extend,
    ownTokensOf,
    subscribe,
    tokenOfEntry,
} from "./spec-api.js";
import { px } from "./values.js";

/**
 * Which of an extension's tokens it writes and reports: for each kind of token,
 * its origin, whether it's written (in `ownTokensOf()`), and whether it's
 * reported by default.
 */
const Cases = suite("extension reporting");
const T = DesignToken.Type;

/** The parent of the table's examples. */
const parent = () =>
    create({
        primary: { $type: T.Dimension, $value: px(10) },
        hover: { $type: T.Dimension, $value: Shade.darken(at("primary")) },
        border: { $type: T.Dimension, $value: px(1) },
        base: { $type: T.Dimension, $value: px(2) },
        mixed: {
            $type: T.Dimension,
            $value: Shade.mix(at("primary"), at("base")),
        },
        n: { $type: T.Number, $value: 20 },
        limit: { $type: T.Number, $value: Clamp.num(at("n")) },
        k: { $type: T.Number, $value: 1 },
        a: { $type: T.Dimension, $value: px(3) },
        b: { $type: T.Dimension, $value: px(4) },
        c: { $type: T.Dimension, $value: Pick.pick(at("k")) },
    });

/** An extension of `library`, with a default and an `inherited` subscriber. */
const watched = (library: any, config: any = {}, options?: any) => {
    const extension = extend(library, config, options);
    const own = changeRecorder();
    const inherited = changeRecorder();
    subscribe(extension, own);
    subscribe(extension, inherited, { inherited: true });
    return { extension, own, inherited };
};

const written = (library: any, name: string): boolean =>
    ownTokensOf(library).some((token) => token.name === name);

/** The change for `name` in the last batch. */
const changeOf = (
    recorder: ReturnType<typeof changeRecorder>,
    name: string,
) => {
    const batch = recorder.batches.at(-1) ?? [];
    const change = entriesOfBatch(batch).find(
        (entry) => tokenOfEntry(entry).name === name,
    );
    Assert.ok(change, `"${name}" is reported`);
    return change!;
};

const PRIMARY = { primary: { $value: px(20) } };

specTest(
    Cases,
    "C",
    "CASE-01: no own value, own dependency or overridden recipe",
    async () => {
        const library = parent();
        const { extension, own, inherited } = watched(library, PRIMARY);
        Assert.not.ok(written(extension, "border"));

        library.tokens.border.set(px(2));
        await nextUpdate();

        Assert.equal(own.batches, []);
        Assert.is(changeOf(inherited, "border").valueChanged, true);
    },
);

specTest(Cases, "C", "CASE-02: a $value in extend()", async () => {
    const { extension, own } = watched(parent(), PRIMARY);
    Assert.ok(written(extension, "primary"));

    extension.tokens.primary.set(px(30));
    await nextUpdate();

    const change = changeOf(own, "primary");
    Assert.is(change.origin, "own");
    Assert.is(change.valueChanged, true);
    Assert.is(change.originChanged, false);
});

specTest(Cases, "C", "CASE-03: set() to a new value", async () => {
    const { extension, own } = watched(parent());

    extension.tokens.primary.set(px(30));
    await nextUpdate();

    Assert.ok(written(extension, "primary"));
    const change = changeOf(own, "primary");
    Assert.is(change.valueChanged, true);
    Assert.is(change.originChanged, true);
});

specTest(Cases, "C", "CASE-04: set() to the parent's value", async () => {
    const library = parent();
    const { extension, own } = watched(library);

    extension.tokens.primary.set(library.tokens.primary.$value);
    await nextUpdate();

    Assert.ok(written(extension, "primary"));
    const change = changeOf(own, "primary");
    Assert.is(change.origin, "own");
    Assert.is(change.valueChanged, false);
    Assert.is(change.originChanged, true);
});

specTest(Cases, "C", "CASE-05: new in the extension", async () => {
    const { extension, own } = watched(parent(), {
        brand: { accent: { $type: T.Dimension, $value: px(1) } },
    });
    Assert.ok(written(extension, "brand.accent"));

    extension.tokens.brand.accent.set(px(2));
    await nextUpdate();

    const change = changeOf(own, "brand.accent");
    Assert.is(change.origin, "own");
    Assert.is(change.valueChanged, true);
});

specTest(Cases, "C", "CASE-06: depends on an own token", async () => {
    const { extension, own } = watched(parent());

    extension.tokens.primary.set(px(30));
    await nextUpdate();
    Assert.ok(written(extension, "hover"));
    const becameOwn = changeOf(own, "hover");
    Assert.is(becameOwn.origin, "own");
    Assert.is(becameOwn.originChanged, true);
    Assert.is(becameOwn.valueChanged, true);

    extension.tokens.primary.set(px(40));
    await nextUpdate();
    const changed = changeOf(own, "hover");
    Assert.is(changed.originChanged, false);
    Assert.is(changed.valueChanged, true);
});

specTest(Cases, "C", "CASE-07: calls an overridden recipe", async () => {
    const library = parent();
    const { extension, own } = watched(
        library,
        {},
        { recipes: [override(Shade.darken, (d) => px(d.value - 5))] },
    );
    Assert.ok(written(extension, "hover"));
    Assert.equal(extension.tokens.hover.$value, px(5));

    library.tokens.primary.set(px(11));
    await nextUpdate();

    const change = changeOf(own, "hover");
    Assert.is(change.origin, "own");
    Assert.is(change.valueChanged, true);
    Assert.equal(extension.tokens.hover.$value, px(6));
});

specTest(
    Cases,
    "C",
    "CASE-08: ancestor, and the parent's token changes",
    async () => {
        const library = parent();
        const { extension, own, inherited } = watched(library, PRIMARY);

        library.tokens.border.set(px(2));
        await nextUpdate();

        Assert.not.ok(written(extension, "border"));
        Assert.equal(own.batches, []);
        const change = changeOf(inherited, "border");
        Assert.is(change.origin, "ancestor");
        Assert.is(change.valueChanged, true);
        Assert.is(change.originChanged, false);
    },
);

specTest(
    Cases,
    "C",
    "CASE-09: an own value, and the parent's same token changes",
    async () => {
        const library = parent();
        const { extension, own } = watched(library, PRIMARY);

        library.tokens.primary.set(px(11));
        await nextUpdate();

        Assert.ok(written(extension, "primary"));
        Assert.equal(own.batches, []);
    },
);

specTest(
    Cases,
    "C",
    "CASE-10: own, and a dependency from the parent changes",
    async () => {
        const library = parent();
        const { extension, own } = watched(library, PRIMARY);

        library.tokens.base.set(px(5));
        await nextUpdate();

        Assert.ok(written(extension, "mixed"));
        Assert.equal(own.names, [["mixed"]]);
        Assert.is(changeOf(own, "mixed").valueChanged, true);
    },
);

specTest(Cases, "C", "CASE-11: own, equal to the parent's value", async () => {
    const library = parent();
    const { extension, own } = watched(library, {
        primary: { $value: px(10) },
    });

    Assert.ok(written(extension, "hover"));
    Assert.equal(extension.tokens.hover.$value, library.tokens.hover.$value);

    extension.tokens.primary.set(px(30));
    await nextUpdate();

    Assert.is(changeOf(own, "hover").valueChanged, true);
});

specTest(
    Cases,
    "C",
    "CASE-12: own, and re-resolved to an equal value",
    async () => {
        const { extension, own } = watched(parent(), { n: { $value: 20 } });
        Assert.ok(written(extension, "limit"));

        extension.tokens.n.set(30);
        await nextUpdate();

        Assert.equal(own.names, [["n"]]);
    },
);

specTest(
    Cases,
    "C",
    "CASE-13: a recipe whose result is a ref to an own token",
    async () => {
        const { extension, own } = watched(parent(), { a: { $value: px(7) } });
        Assert.ok(written(extension, "c"));

        extension.tokens.a.set(px(8));
        await nextUpdate();

        Assert.is(changeOf(own, "c").valueChanged, true);
        Assert.equal(extension.tokens.c.$value, px(8));
    },
);

Cases.run();
