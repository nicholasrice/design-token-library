import { suite } from "uvu";
import * as Assert from "uvu/assert";
import { DesignToken } from "../lib/design-token.js";
import { recipes } from "../lib/recipe.js";
import { Clamp, at, chain, counter } from "./fixtures-130.js";
import { nextUpdate, settle, specTest } from "./helpers.js";
import {
    changeRecorder,
    create,
    extend,
    subscribe,
    tokenOfEntry,
} from "./spec-api.js";
import { hex, px } from "./values.js";

/**
 * #130, PR B: a subscribed library resolves eagerly, re-resolves what a set()
 * reaches, and reports only the tokens whose values changed.
 */
const Evaluation = suite("#130 eager evaluation");
const Subscribing = suite("#130 subscribing");
const Reporting = suite("#130 reporting changed values");
const T = DesignToken.Type;

type Dimension = DesignToken.Values.Readonly.Dimension;

const Sum = recipes({
    sum: (a: Dimension, b: Dimension) => px(a.value + b.value),
});

const Fail = recipes({
    positive: (n: number): number => {
        if (n < 0) {
            throw new Error("negative");
        }
        return n;
    },
});

/**
 * `a`; `b` and `c` depend on it, through a ref chain; `d` doesn't. Each but
 * `a` counts its resolutions.
 */
const counted = () => {
    const count = counter();
    const library = create({
        a: { $type: T.Dimension, $value: px(1) },
        b: { $type: T.Dimension, $value: count.id("b", at("a")) },
        c: { $type: T.Dimension, $value: count.id("c", at("b")) },
        d: { $type: T.Dimension, $value: count.id("d", px(1)) },
    });
    return { library, ...count };
};

/**
 * A parent where `b` depends on `a` and `y` on `x`. Its extensions override
 * `a`.
 */
const parentOf = () => {
    const count = counter();
    const library = create({
        a: { $type: T.Dimension, $value: px(1) },
        b: { $type: T.Dimension, $value: count.id("b", at("a")) },
        x: { $type: T.Dimension, $value: px(2) },
        y: { $type: T.Dimension, $value: count.id("y", at("x")) },
    });
    const extendA = () => extend(library, { a: { $value: px(5) } });
    return { library, extendA, ...count };
};

/**
 * A parent with no subscriber, and a subscribed extension whose `own` depends
 * on its own `a` and the parent's `base`, through `via`.
 */
const lazyParent = (via: "base" | "m") => {
    const count = counter();
    const library = create({
        a: { $type: T.Dimension, $value: px(1) },
        base: { $type: T.Dimension, $value: px(2) },
        m: { $type: T.Dimension, $value: at("base") },
        own: {
            $type: T.Dimension,
            $value: count.id("own", Sum.sum(at("a"), at(via))),
        },
    });
    const extension = extend(library, { a: { $value: px(10) } });
    const subscriber = changeRecorder();
    subscribe(extension, subscriber);
    return { library, extension, subscriber, ...count };
};

specTest(
    Evaluation,
    "B",
    "EVAL-01: a root library resolves its tokens on subscribe()",
    () => {
        const { library, calls } = counted();
        subscribe(library, changeRecorder());

        Assert.equal([calls("b"), calls("c"), calls("d")], [1, 1, 1]);
    },
);

specTest(
    Evaluation,
    "B",
    "EVAL-02: a library without a subscriber stays lazy",
    async () => {
        const { library, calls } = counted();
        library.tokens.a.set(px(2));
        await nextUpdate();

        Assert.equal([calls("b"), calls("c"), calls("d")], [0, 0, 0]);
    },
);

specTest(
    Evaluation,
    "B",
    "EVAL-03: set() re-resolves what it reaches, and only that",
    async () => {
        const { library, calls, reset } = counted();
        subscribe(library, changeRecorder());
        reset();

        library.tokens.a.set(px(2));
        await nextUpdate();

        Assert.equal([calls("b"), calls("c"), calls("d")], [1, 1, 0]);
    },
);

specTest(
    Evaluation,
    "B",
    "EVAL-04: reached tokens are current without being read",
    async () => {
        const { library, calls, reset } = counted();
        subscribe(library, changeRecorder());
        reset();

        library.tokens.a.set(px(2));
        await nextUpdate();

        Assert.equal(library.tokens.c.$value, px(2));
        Assert.is(calls("c"), 1, "reading didn't resolve it again");
    },
);

specTest(
    Evaluation,
    "B",
    "EVAL-05: an extension resolves only its own tokens",
    () => {
        const { library, extendA, calls, reset } = parentOf();
        subscribe(library, changeRecorder());
        const extension = extendA();
        reset();

        subscribe(extension, changeRecorder());

        Assert.is(calls("b"), 1, "b depends on the extension's a");
        Assert.is(calls("y"), 0, "y is the parent's");
    },
);

specTest(
    Evaluation,
    "B",
    "EVAL-06: an ancestor token is its ancestor's object",
    () => {
        const { library, extendA, calls, reset } = parentOf();
        subscribe(library, changeRecorder());
        const extension = extendA();
        subscribe(extension, changeRecorder());
        reset();

        Assert.is(extension.tokens.y.$value, library.tokens.y.$value);
        Assert.is(calls("y"), 0);
    },
);

specTest(
    Evaluation,
    "B",
    "EVAL-07: an ancestor resolves a token once for several extensions",
    () => {
        const { library, extendA, calls } = parentOf();
        const extensions = [extendA(), extendA(), extendA()];
        for (const extension of extensions) {
            subscribe(extension, changeRecorder());
        }

        const values = extensions.map((extension) => extension.tokens.y.$value);

        Assert.is(calls("y"), 1);
        for (const value of values) {
            Assert.is(value, library.tokens.y.$value);
        }
        Assert.is(calls("y"), 1, "the parent kept it");
    },
);

specTest(
    Evaluation,
    "B",
    "EVAL-08: an extension leaves its lazy ancestors lazy",
    () => {
        const { library, extendA, calls } = parentOf();
        subscribe(extendA(), changeRecorder());

        Assert.is(calls("y"), 0, "the extension doesn't read y");
        Assert.is(calls("b"), 1, "the extension's own b");

        library.tokens.b.$value;
        Assert.is(calls("b"), 2, "the parent hadn't resolved its b");
    },
);

specTest(
    Evaluation,
    "B",
    "EVAL-09: a lazy ancestor's change is compared with the value the extension kept",
    async () => {
        const { library, extension, subscriber } = lazyParent("base");

        library.tokens.base.set(px(3));
        await nextUpdate();
        Assert.equal(subscriber.names, [["own"]], "a new value");
        Assert.equal(extension.tokens.own.$value, px(13));

        library.tokens.base.set(px(3));
        await nextUpdate();
        Assert.equal(subscriber.names, [["own"]], "an equal value");
    },
);

specTest(
    Evaluation,
    "B",
    "EVAL-10: an extension's walk doesn't stop at tokens it hasn't cached",
    async () => {
        const { library, extension, subscriber } = lazyParent("m");

        library.tokens.base.set(px(3));
        await nextUpdate();

        Assert.equal(subscriber.names, [["own"]]);
        Assert.equal(extension.tokens.own.$value, px(13));
    },
);

specTest(
    Evaluation,
    "B",
    "EVAL-11: a ref chain of 1,000 tokens resolves eagerly in a library",
    async () => {
        const library = create(chain(1000));
        subscribe(library, changeRecorder());

        library.tokens.t0.set(5);
        await nextUpdate();

        Assert.is(library.tokens.t999.$value, 5);
    },
);

specTest(
    Evaluation,
    "B",
    "EVAL-12: a ref chain of 400 tokens resolves eagerly in an extension",
    async () => {
        const library = create(chain(400));
        const extension = extend(library, { t0: { $value: 1 } });
        subscribe(extension, changeRecorder());

        extension.tokens.t0.set(7);
        await nextUpdate();

        Assert.is(extension.tokens.t399.$value, 7);
    },
);

specTest(
    Subscribing,
    "B",
    "SUB-01: subscribe() sends no initial batch",
    async () => {
        const { library } = counted();
        const subscriber = changeRecorder();
        subscribe(library, subscriber);
        await settle();

        Assert.equal(subscriber.batches, []);
    },
);

specTest(
    Subscribing,
    "B",
    "SUB-02: an extension's subscribe() sends no initial batch",
    async () => {
        const { extendA } = parentOf();
        const subscriber = changeRecorder();
        subscribe(extendA(), subscriber);
        await settle();

        Assert.equal(subscriber.batches, []);
    },
);

specTest(
    Subscribing,
    "B",
    "SUB-03: the last unsubscribe() makes a library lazy",
    async () => {
        const { library, calls, reset } = counted();
        const subscriber = changeRecorder();
        subscribe(library, subscriber);
        library.unsubscribe(subscriber);
        reset();

        library.tokens.a.set(px(2));
        await nextUpdate();

        Assert.equal([calls("b"), calls("c"), calls("d")], [0, 0, 0]);
    },
);

specTest(
    Subscribing,
    "B",
    "SUB-04: a library made lazy keeps its cached values",
    async () => {
        const { library, calls, reset } = counted();
        const subscriber = changeRecorder();
        subscribe(library, subscriber);
        const d = library.tokens.d.$value;
        library.unsubscribe(subscriber);
        reset();

        library.tokens.a.set(px(2));
        await nextUpdate();

        Assert.is(library.tokens.d.$value, d);
        Assert.is(calls("d"), 0);
    },
);

specTest(
    Subscribing,
    "B",
    "SUB-05: a library stays eager while any subscriber remains",
    async () => {
        const { library, calls, reset } = counted();
        const first = changeRecorder();
        subscribe(library, first);
        subscribe(library, changeRecorder());
        library.unsubscribe(first);
        reset();

        library.tokens.a.set(px(2));
        await nextUpdate();

        Assert.is(calls("b"), 1);
    },
);

specTest(
    Subscribing,
    "B",
    "SUB-06: a new subscriber resolves a lazy library again",
    async () => {
        const { library, calls, reset } = counted();
        const first = changeRecorder();
        subscribe(library, first);
        library.unsubscribe(first);
        library.tokens.a.set(px(2));
        await nextUpdate();
        reset();

        const second = changeRecorder();
        subscribe(library, second);
        await settle();

        Assert.equal([calls("b"), calls("c")], [1, 1]);
        Assert.equal(second.batches, []);
    },
);

specTest(
    Subscribing,
    "B",
    "SUB-07: unsubscribing drops the previous values",
    async () => {
        const original = px(1);
        const library = create({
            a: { $type: T.Dimension, $value: original },
            b: { $type: T.Dimension, $value: at("a") },
        });
        const first = changeRecorder();
        subscribe(library, first);
        library.unsubscribe(first);
        library.tokens.a.set(px(2));
        await nextUpdate();

        const second = changeRecorder();
        subscribe(library, second);
        library.tokens.a.set(original);
        await nextUpdate();

        Assert.equal(second.names, [["a", "b"]]);
    },
);

specTest(
    Subscribing,
    "B",
    "SUB-08: a subscriber added during onChange gets the batch being delivered",
    async () => {
        const { library } = counted();
        const late = changeRecorder();
        let added = false;
        subscribe(library, {
            onChange() {
                if (!added) {
                    added = true;
                    subscribe(library, late);
                }
            },
        });

        library.tokens.a.set(px(2));
        await settle();
        library.tokens.a.set(px(3));
        await settle();

        Assert.is(late.batches.length, 2);
    },
);

specTest(
    Subscribing,
    "B",
    "SUB-09: a subscriber added before the flush gets the pending batch",
    async () => {
        const { library } = counted();
        library.tokens.a.set(px(2));
        const subscriber = changeRecorder();
        subscribe(library, subscriber);
        await settle();

        Assert.is(subscriber.batches.length, 1);
        Assert.ok(subscriber.names[0].includes("a"));
    },
);

specTest(
    Subscribing,
    "B",
    "SUB-10: an extension's last unsubscribe() makes it lazy",
    async () => {
        const { library, extension, subscriber, calls, reset } =
            lazyParent("base");
        extension.unsubscribe(subscriber);
        reset();

        library.tokens.base.set(px(3));
        await nextUpdate();

        Assert.is(calls("own"), 0);
    },
);

specTest(
    Reporting,
    "B",
    "REP-01: an unread dependent is reported",
    async () => {
        const library = create({
            a: { $type: T.Color, $value: hex("#111111") },
            b: { $type: T.Color, $value: at("a") },
        });
        const subscriber = changeRecorder();
        subscribe(library, subscriber);

        library.tokens.a.set(hex("#222222"));
        await nextUpdate();

        Assert.equal(subscriber.names, [["a", "b"]]);
    },
);

specTest(
    Reporting,
    "B",
    "REP-02: unread transitive dependents are reported",
    async () => {
        const library = create({
            a: { $type: T.Color, $value: hex("#111111") },
            b: { $type: T.Color, $value: at("a") },
            c: { $type: T.Color, $value: at("b") },
        });
        const subscriber = changeRecorder();
        subscribe(library, subscriber);

        library.tokens.a.set(hex("#222222"));
        await nextUpdate();

        Assert.equal(subscriber.names, [["a", "b", "c"]]);
    },
);

/** `n`, and `t`, which clamps it to 10. */
const clamped = () => {
    const count = counter();
    const library = create({
        n: { $type: T.Number, $value: 20 },
        t: { $type: T.Number, $value: Clamp.num(at("n")) },
        u: { $type: T.Number, $value: count.id("u", at("t")) },
        v: { $type: T.Number, $value: count.id("v", at("n")) },
    });
    const subscriber = changeRecorder();
    subscribe(library, subscriber);
    return { library, subscriber, ...count };
};

specTest(
    Reporting,
    "B",
    "REP-03: a token re-resolved to an equal value isn't reported",
    async () => {
        const { library, subscriber } = clamped();

        library.tokens.n.set(30);
        await nextUpdate();

        Assert.not.ok(subscriber.names[0].includes("t"));
    },
);

specTest(
    Reporting,
    "B",
    "REP-04: propagation stops at a token that didn't change",
    async () => {
        const { library, subscriber, calls, reset } = clamped();
        reset();

        library.tokens.n.set(30);
        await nextUpdate();

        Assert.is(calls("u"), 0);
        Assert.not.ok(subscriber.names[0].includes("u"));
    },
);

specTest(
    Reporting,
    "B",
    "REP-05: set() to an equal value isn't reported",
    async () => {
        const red = (hex: string) => ({
            colorSpace: "srgb",
            components: [1, 0, 0],
            hex,
        });
        const library = create({
            a: { $type: T.Color, $value: red("#ff0000") },
        });
        const subscriber = changeRecorder();
        subscribe(library, subscriber);

        library.tokens.a.set(red("#fe0000"));
        await nextUpdate();

        Assert.equal(subscriber.batches, []);
    },
);

specTest(
    Reporting,
    "B",
    "REP-06: of what a set() reaches, only the changed values are reported",
    async () => {
        const { library, subscriber } = clamped();

        library.tokens.n.set(30);
        await nextUpdate();

        Assert.equal(subscriber.names, [["n", "v"]]);
    },
);

specTest(
    Reporting,
    "B",
    "REP-07: sets of several tokens in one microtask are reported together",
    async () => {
        const library = create({
            a: { $type: T.Dimension, $value: px(1) },
            b: { $type: T.Dimension, $value: px(2) },
            a2: { $type: T.Dimension, $value: at("a") },
            b2: { $type: T.Dimension, $value: at("b") },
        });
        const subscriber = changeRecorder();
        subscribe(library, subscriber);

        library.tokens.a.set(px(3));
        library.tokens.b.set(px(4));
        await nextUpdate();

        Assert.equal(subscriber.names, [["a", "a2", "b", "b2"]]);
    },
);

specTest(
    Reporting,
    "B",
    "REP-08: a token set and set back before the flush isn't reported",
    async () => {
        const original = px(1);
        const library = create({
            a: { $type: T.Dimension, $value: original },
            b: { $type: T.Dimension, $value: at("a") },
        });
        const subscriber = changeRecorder();
        subscribe(library, subscriber);

        library.tokens.a.set(px(2));
        library.tokens.a.set(original);
        await nextUpdate();

        Assert.equal(subscriber.batches, []);
    },
);

specTest(
    Reporting,
    "B",
    "REP-09: a batch's entries are the library's tokens",
    async () => {
        const library = create({
            a: { $type: T.Color, $value: hex("#111111") },
            b: { $type: T.Color, $value: at("a") },
        });
        const subscriber = changeRecorder();
        subscribe(library, subscriber);

        library.tokens.a.set(hex("#222222"));
        await nextUpdate();

        const tokens = subscriber.batches[0].map(tokenOfEntry);
        Assert.ok(tokens.includes(library.tokens.a));
        Assert.ok(tokens.includes(library.tokens.b));
    },
);

specTest(
    Reporting,
    "B",
    "REP-10: an extension reports its own tokens that change",
    async () => {
        const library = create({
            a: { $type: T.Color, $value: hex("#111111") },
            b: { $type: T.Color, $value: at("a") },
        });
        const extension = extend(library, { a: { $value: hex("#999999") } });
        const subscriber = changeRecorder();
        subscribe(extension, subscriber);

        extension.tokens.a.set(hex("#222222"));
        await nextUpdate();

        Assert.equal(subscriber.names, [["a", "b"]]);
    },
);

specTest(
    Reporting,
    "B",
    "REP-11: an extension doesn't report its ancestor tokens by default",
    async () => {
        const library = create({
            a: { $type: T.Color, $value: hex("#111111") },
            b: { $type: T.Color, $value: at("a") },
        });
        const extension = extend(library, {});
        const subscriber = changeRecorder();
        subscribe(extension, subscriber);

        library.tokens.a.set(hex("#222222"));
        await nextUpdate();

        Assert.equal(subscriber.batches, []);
    },
);

specTest(
    Reporting,
    "B",
    "REP-12: a token that throws doesn't stop subscribe()",
    async () => {
        const library = create({
            a: { $type: T.Color, $value: at("missing") },
            b: { $type: T.Color, $value: hex("#111111") },
        });
        const subscriber = changeRecorder();

        Assert.not.throws(() => subscribe(library, subscriber));
        Assert.throws(() => library.tokens.a.$value, /missing/);

        library.tokens.b.set(hex("#222222"));
        await nextUpdate();
        Assert.equal(subscriber.names, [["b"]]);
    },
);

specTest(
    Reporting,
    "B",
    "REP-13: a token that starts throwing is reported as changed",
    async () => {
        const library = create({
            n: { $type: T.Number, $value: 1 },
            b: { $type: T.Number, $value: Fail.positive(at("n")) },
        });
        const subscriber = changeRecorder();
        subscribe(library, subscriber);

        Assert.not.throws(() => library.tokens.n.set(-1));
        await nextUpdate();

        Assert.equal(subscriber.names, [["b", "n"]]);
        Assert.throws(() => library.tokens.b.$value, /negative/);
    },
);

const Choose = recipes({
    font: (n: number): any => (n > 0 ? "A" : ["A"]),
    zero: (n: number): number => (n > 0 ? 0 : -0),
    nan: (_n: number): number => NaN,
    weight: (n: number): any => (n > 0 ? 400 : "normal"),
});

/** A subscribed library where `t` is `recipe(n)`. */
const chosen = ($type: string, recipe: (n: any) => unknown) => {
    const library = create({
        n: { $type: T.Number, $value: 1 },
        t: { $type, $value: recipe(at("n")) },
    });
    const subscriber = changeRecorder();
    subscribe(library, subscriber);
    return { library, subscriber };
};

specTest(
    Reporting,
    "B",
    "EQ-10: fontFamily is compared as written",
    async () => {
        const { library, subscriber } = chosen(T.FontFamily, Choose.font);

        library.tokens.n.set(-1);
        await nextUpdate();

        Assert.equal(subscriber.names, [["n", "t"]], '"A" isn\'t ["A"]');
    },
);

specTest(
    Reporting,
    "B",
    "EQ-12: numbers are compared with Object.is",
    async () => {
        const zero = chosen(T.Number, Choose.zero);
        zero.library.tokens.n.set(-1);
        await nextUpdate();
        Assert.equal(zero.subscriber.names, [["n", "t"]], "0 isn't -0");

        const nan = chosen(T.Number, Choose.nan);
        nan.library.tokens.n.set(2);
        await nextUpdate();
        Assert.equal(nan.subscriber.names, [["n"]], "NaN is NaN");
    },
);

specTest(
    Reporting,
    "B",
    "EQ-13: fontWeight is compared with Object.is",
    async () => {
        const { library, subscriber } = chosen(T.FontWeight, Choose.weight);

        library.tokens.n.set(2);
        await nextUpdate();
        library.tokens.n.set(-1);
        await nextUpdate();

        Assert.equal(subscriber.names, [["n"], ["n", "t"]]);
    },
);

Evaluation.run();
Subscribing.run();
Reporting.run();
