import { suite } from "uvu";
import * as Assert from "uvu/assert";
import { DesignToken } from "../lib/design-token.js";
import { toCSS } from "../lib/css-reflector.js";
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
import { hex, px } from "./values.js";

/**
 * The origin of an extension's tokens, `Change` entries, the
 * `origin` option, and the first-render query.
 */
const Origin = suite("origin");
const Changes = suite("change entries");
const T = DesignToken.Type;

/**
 * `b`, `c` and `d` depend on `a`, `d` through a recipe; `e` on `x` through a
 * recipe in a recipe's arguments, and on `y`. `border` depends on nothing.
 */
const parent = () =>
    create({
        a: { $type: T.Dimension, $value: px(1) },
        b: { $type: T.Dimension, $value: at("a") },
        c: { $type: T.Dimension, $value: at("b") },
        d: { $type: T.Dimension, $value: Shade.darken(at("a")) },
        e: {
            $type: T.Dimension,
            $value: Shade.mix(Shade.darken(at("x")), at("y")),
        },
        x: { $type: T.Dimension, $value: px(2) },
        y: { $type: T.Dimension, $value: px(3) },
        border: { $type: T.Dimension, $value: px(4) },
    });

const ownNames = (library: any): string[] =>
    ownTokensOf(library).map((token) => token.name);

/** The entry of a batch for the token named `name`. */
const entryOf = (batch: ReadonlyArray<any>, name: string) => {
    const entry = entriesOfBatch(batch).find(
        (change) => tokenOfEntry(change).name === name,
    );
    Assert.ok(entry, `"${name}" is in the batch`);
    return entry!;
};

/** A parent where `p` is `pick(k)`, which returns a ref to `a`. */
const picked = () =>
    create({
        k: { $type: T.Number, $value: 1 },
        a: { $type: T.Dimension, $value: px(1) },
        b: { $type: T.Dimension, $value: px(2) },
        p: { $type: T.Dimension, $value: Pick.pick(at("k")) },
    });

specTest(Origin, "C", "ORIGIN-01: every token of a root library is own", () => {
    Assert.equal(ownNames(parent()), [
        "a",
        "b",
        "c",
        "d",
        "e",
        "x",
        "y",
        "border",
    ]);
});

specTest(Origin, "C", "ORIGIN-02: a $value in extend() is own", () => {
    const extension = extend(parent(), { x: { $value: px(9) } });
    Assert.ok(ownNames(extension).includes("x"));
});

specTest(Origin, "C", "ORIGIN-03: a token set() is own", () => {
    const extension = extend(parent(), {});
    extension.tokens.x.set(px(9));
    Assert.ok(ownNames(extension).includes("x"));
});

specTest(
    Origin,
    "C",
    "ORIGIN-04: a token set() to its parent's value is own",
    () => {
        const library = parent();
        const extension = extend(library, {});
        extension.tokens.x.set(library.tokens.x.$value);
        Assert.ok(ownNames(extension).includes("x"));
    },
);

specTest(Origin, "C", "ORIGIN-05: a token new in the extension is own", () => {
    const extension = extend(parent(), {
        brand: { accent: { $type: T.Dimension, $value: px(1) } },
    });
    Assert.ok(ownNames(extension).includes("brand.accent"));
});

specTest(
    Origin,
    "C",
    "ORIGIN-06: a token that depends on an own token, at any depth, is own",
    () => {
        const extension = extend(parent(), { a: { $value: px(9) } });
        Assert.equal(ownNames(extension), ["a", "b", "c", "d"]);
    },
);

specTest(
    Origin,
    "C",
    "ORIGIN-07: a dependency in a recipe's arguments makes a token own",
    () => {
        const extension = extend(parent(), { x: { $value: px(9) } });
        Assert.equal(ownNames(extension), ["e", "x"]);
    },
);

specTest(
    Origin,
    "C",
    "ORIGIN-08: a dependency in plain data makes a token own",
    () => {
        const library = create({
            col: { $type: T.Color, $value: hex("#111111") },
            bd: {
                $type: T.Border,
                $value: { color: at("col"), width: px(1), style: "solid" },
            },
        });
        const extension = extend(library, {
            col: { $value: hex("#222222") },
        });
        Assert.equal(ownNames(extension), ["col", "bd"]);
    },
);

specTest(
    Origin,
    "C",
    "ORIGIN-09: a ref found in a recipe's result makes a token own",
    () => {
        const library = picked();
        library.tokens.p.$value;
        const extension = extend(library, { a: { $value: px(7) } });

        Assert.ok(ownNames(extension).includes("p"));
        Assert.equal(extension.tokens.p.$value, px(7));
    },
);

specTest(
    Origin,
    "C",
    "ORIGIN-10: a ref found in a recipe's result counts though the parent never read it",
    () => {
        const extension = extend(picked(), { a: { $value: px(7) } });

        Assert.ok(ownNames(extension).includes("p"));
        Assert.equal(extension.tokens.p.$value, px(7));
    },
);

specTest(
    Origin,
    "C",
    "ORIGIN-11: a token that calls an overridden recipe is own",
    () => {
        const extension = extend(
            parent(),
            {},
            { recipes: [override(Shade.darken, (d) => px(d.value - 5))] },
        );
        const names = ownNames(extension);

        Assert.ok(names.includes("d"));
        Assert.not.ok(names.includes("b"));
    },
);

specTest(
    Origin,
    "C",
    "ORIGIN-12: an overridden recipe in another recipe's arguments makes a token own",
    () => {
        const extension = extend(
            parent(),
            {},
            { recipes: [override(Shade.darken, (d) => px(d.value - 5))] },
        );
        Assert.ok(ownNames(extension).includes("e"));
    },
);

specTest(
    Origin,
    "C",
    "ORIGIN-13: origin is relative to the immediate parent",
    () => {
        const middle = extend(parent(), { a: { $value: px(9) } });
        const leaf = extend(middle, {});

        Assert.equal(ownNames(middle), ["a", "b", "c", "d"]);
        Assert.equal(ownNames(leaf), []);
    },
);

specTest(
    Origin,
    "C",
    "ORIGIN-14: an extension of an extension owns what it changes",
    () => {
        const middle = extend(parent(), { a: { $value: px(9) } });
        const leaf = extend(middle, { x: { $value: px(8) } });

        Assert.equal(ownNames(leaf), ["e", "x"]);
    },
);

specTest(
    Origin,
    "C",
    "ORIGIN-15: nothing makes an own token ancestor again",
    async () => {
        const library = parent();
        const extension = extend(library, {});
        extension.tokens.x.set(library.tokens.x.$value);

        library.tokens.x.set(px(100));
        await nextUpdate();

        Assert.ok(ownNames(extension).includes("x"));
        Assert.equal(extension.tokens.x.$value, px(2));
    },
);

specTest(
    Origin,
    "C",
    "ORIGIN-16: ownTokensOf() lists the extension's tokens, frozen, in library order",
    () => {
        const extension = extend(parent(), { a: { $value: px(9) } });
        const own = ownTokensOf(extension);
        const { a, b, c, d } = extension.tokens;

        Assert.ok(Object.isFrozen(own));
        Assert.is(own.length, 4);
        [a, b, c, d].forEach((token, i) => Assert.is(own[i], token));
    },
);

specTest(
    Changes,
    "C",
    "CHG-01: a root library's change is own, with its value changed",
    async () => {
        const library = parent();
        const subscriber = changeRecorder();
        subscribe(library, subscriber);

        library.tokens.a.set(px(5));
        await nextUpdate();

        const change = entryOf(subscriber.batches[0], "a");
        Assert.is(change.token, library.tokens.a);
        Assert.is(change.valueChanged, true);
        Assert.is(change.origin, "own");
        Assert.is(change.originChanged, false);
    },
);

specTest(
    Changes,
    "C",
    "CHG-02: every change has its value or its origin changed",
    async () => {
        const library = parent();
        const extension = extend(library, { a: { $value: px(9) } });
        const subscriber = changeRecorder();
        subscribe(extension, subscriber);

        extension.tokens.x.set(library.tokens.x.$value);
        await nextUpdate();
        library.tokens.a.set(px(5));
        await nextUpdate();
        extension.tokens.a.set(px(10));
        await nextUpdate();
        library.tokens.y.set(px(6));
        await nextUpdate();

        Assert.ok(subscriber.batches.length > 0);
        for (const batch of subscriber.batches) {
            for (const change of entriesOfBatch(batch)) {
                Assert.ok(change.valueChanged || change.originChanged);
            }
        }
    },
);

specTest(
    Changes,
    "C",
    "CHG-03: set() to the parent's value changes only the origin",
    async () => {
        const library = parent();
        const extension = extend(library, {});
        const subscriber = changeRecorder();
        subscribe(extension, subscriber);

        extension.tokens.x.set(library.tokens.x.$value);
        await nextUpdate();

        const change = entryOf(subscriber.batches[0], "x");
        Assert.is(change.valueChanged, false);
        Assert.is(change.originChanged, true);
        Assert.is(change.origin, "own");
    },
);

specTest(
    Changes,
    "C",
    "CHG-04: set() to a new value changes the value and the origin",
    async () => {
        const extension = extend(parent(), {});
        const subscriber = changeRecorder();
        subscribe(extension, subscriber);

        extension.tokens.x.set(px(50));
        await nextUpdate();

        const change = entryOf(subscriber.batches[0], "x");
        Assert.is(change.valueChanged, true);
        Assert.is(change.originChanged, true);
    },
);

/** Asserts that a batch is the ancestor tokens `a`, `b`, `c` and `d`. */
const assertInheritedABCD = (batch: ReadonlyArray<any>) => {
    const changes = entriesOfBatch(batch);
    Assert.equal(changes.map((change) => tokenOfEntry(change).name).sort(), [
        "a",
        "b",
        "c",
        "d",
    ]);
    for (const change of changes) {
        Assert.is(change.origin, "ancestor");
        Assert.is(change.valueChanged, true);
        Assert.is(change.originChanged, false);
    }
};

specTest(
    Changes,
    "C",
    "CHG-05: origin 'all' reports ancestor tokens whose values changed",
    async () => {
        const library = parent();
        const extension = extend(library, {});
        extension.tokens.d.$value;
        const subscriber = changeRecorder();
        subscribe(extension, subscriber, { origin: "all" });

        library.tokens.a.set(px(5));
        await nextUpdate();

        Assert.is(subscriber.batches.length, 1);
        assertInheritedABCD(subscriber.batches[0]);
    },
);

specTest(
    Changes,
    "C",
    "CHG-06: origin 'all' reports ancestor tokens that weren't read",
    async () => {
        const library = parent();
        const extension = extend(library, {});
        const subscriber = changeRecorder();
        subscribe(extension, subscriber, { origin: "all" });

        library.tokens.a.set(px(5));
        await nextUpdate();

        Assert.is(subscriber.batches.length, 1);
        assertInheritedABCD(subscriber.batches[0]);
    },
);

specTest(
    Changes,
    "C",
    "CHG-07: origin 'all' doesn't report an equal re-resolve",
    async () => {
        const library = create({
            n: { $type: T.Number, $value: 20 },
            t: { $type: T.Number, $value: Clamp.num(at("n")) },
        });
        const extension = extend(library, {});
        extension.tokens.t.$value;
        const subscriber = changeRecorder();
        subscribe(extension, subscriber, { origin: "all" });

        library.tokens.n.set(30);
        await nextUpdate();

        Assert.equal(subscriber.names, [["n"]]);
    },
);

specTest(
    Changes,
    "C",
    "CHG-08: origin 'all' reports each token once",
    async () => {
        const library = parent();
        const extension = extend(library, {});
        // `b` makes `a` of the extension as it resolves.
        extension.tokens.b.$value;
        const subscriber = changeRecorder();
        subscribe(extension, subscriber, { origin: "all" });

        library.tokens.a.set(px(5));
        await nextUpdate();

        const names = subscriber.names[0];
        Assert.equal(names, [...new Set(names)]);
        Assert.equal(names, ["a", "b", "c", "d"]);
    },
);

specTest(
    Changes,
    "C",
    "CHG-09: default and origin 'all' subscribers of one extension",
    async () => {
        const library = parent();
        const extension = extend(library, {});
        const own = changeRecorder();
        const all = changeRecorder();
        subscribe(extension, own);
        subscribe(extension, all, { origin: "all" });

        library.tokens.a.set(px(5));
        await nextUpdate();

        Assert.equal(own.batches, []);
        Assert.equal(all.names, [["a", "b", "c", "d"]]);
    },
);

specTest(
    Changes,
    "C",
    "CHG-10: an own token is reported when its inherited dependency changes",
    async () => {
        const library = parent();
        const extension = extend(library, { x: { $value: px(9) } });
        const subscriber = changeRecorder();
        subscribe(extension, subscriber);

        library.tokens.y.set(px(6));
        await nextUpdate();

        Assert.equal(subscriber.names, [["e"]]);
        const change = entryOf(subscriber.batches[0], "e");
        Assert.is(change.origin, "own");
        Assert.is(change.valueChanged, true);
    },
);

specTest(
    Changes,
    "C",
    "CHG-11: a token equal to its parent's value is still own, and reported",
    async () => {
        const library = parent();
        const extension = extend(library, { a: { $value: px(1) } });
        const subscriber = changeRecorder();
        subscribe(extension, subscriber);

        Assert.ok(ownNames(extension).includes("b"));
        Assert.equal(extension.tokens.b.$value, library.tokens.b.$value);

        extension.tokens.a.set(px(30));
        await nextUpdate();

        Assert.is(entryOf(subscriber.batches[0], "b").valueChanged, true);
    },
);

specTest(
    Changes,
    "C",
    "CHG-12: an own token re-resolved to an equal value isn't reported",
    async () => {
        const library = create({
            n: { $type: T.Number, $value: 20 },
            t: { $type: T.Number, $value: Clamp.num(at("n")) },
        });
        const extension = extend(library, { n: { $value: 20 } });
        extension.tokens.t.$value;
        const subscriber = changeRecorder();
        subscribe(extension, subscriber);

        extension.tokens.n.set(30);
        await nextUpdate();

        Assert.ok(ownNames(extension).includes("t"));
        Assert.equal(subscriber.names, [["n"]]);
    },
);

specTest(
    Changes,
    "C",
    "CSS-01: an extension is written from its own tokens, equal values included",
    () => {
        const library = create({
            a: { $type: T.Number, $value: 1 },
            b: { $type: T.Number, $value: at("a") },
            x: { $type: T.Number, $value: 5 },
            y: { $type: T.Number, $value: 6 },
        });
        const extension = extend(library, { a: { $value: 2 } });
        extension.tokens.x.set(5);
        const own = new Set(ownTokensOf(extension));

        Assert.is(
            toCSS(extension, { filter: (token) => own.has(token) }),
            "--a:2;--b:2;--x:5;",
        );
    },
);

Origin.run();
Changes.run();
