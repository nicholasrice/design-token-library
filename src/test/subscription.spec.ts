import { suite } from "uvu";
import * as Assert from "uvu/assert";
import { spy } from "sinon";
import { override, recipes } from "../lib/recipe.js";
import { ref, refs } from "../lib/ref.js";
import { DesignToken } from "../lib/design-token.js";
import { Library } from "../lib/library.js";
import {
    A,
    AB,
    ABC,
    captureUncaughtErrors,
    nextUpdate,
    recorder,
    settle,
} from "./helpers.js";
import { isCollected } from "./collect.js";
import { hex, px } from "./values.js";

const ab = refs<AB>();
const abc = refs<ABC>();

const Subscription = suite("Library subscriptions");
const SameValue = suite("Library subscriptions: unchanged values");
const Unsubscribed = suite("Library subscriptions: after the last unsubscribe");
const C = DesignToken.Type.Color;

Subscription("unsubscribe stops notifications", async () => {
    const library = Library.create<A>({
        a: { $type: C, $value: hex("#111111") },
    });
    const subscriber = recorder();
    library.subscribe(subscriber);

    library.tokens.a.set(hex("#222222"));
    await nextUpdate();
    library.unsubscribe(subscriber);
    library.tokens.a.set(hex("#333333"));
    await nextUpdate();

    Assert.equal(subscriber.batches, [["a"]]);
});

Subscription("unsubscribing an unknown subscriber is a no-op", async () => {
    const library = Library.create<A>({
        a: { $type: C, $value: hex("#111111") },
    });
    const subscriber = recorder();
    library.subscribe(subscriber);

    Assert.not.throws(() => library.unsubscribe(recorder()));

    library.tokens.a.set(hex("#222222"));
    await nextUpdate();
    Assert.equal(subscriber.batches, [["a"]]);
});

Subscription(
    "a token set twice in one microtask appears once in the batch",
    async () => {
        const library = Library.create<A>({
            a: { $type: C, $value: hex("#111111") },
        });
        const subscriber = recorder();
        library.subscribe(subscriber);

        library.tokens.a.set(hex("#222222"));
        library.tokens.a.set(hex("#333333"));
        await nextUpdate();

        Assert.equal(subscriber.batches, [["a"]]);
    },
);

Subscription(
    "a read alias token is included when its dependency changes",
    async () => {
        const library = Library.create<AB>({
            a: { $type: C, $value: hex("#111111") },
            b: {
                $type: C,
                $value: ab.a,
            },
        });
        const subscriber = recorder();
        library.subscribe(subscriber);
        library.tokens.b.$value;

        library.tokens.a.set(hex("#222222"));
        await nextUpdate();

        Assert.equal(subscriber.batches, [["a", "b"]]);
    },
);

Subscription("an alias token that was never read is included", async () => {
    const library = Library.create<AB>({
        a: { $type: C, $value: hex("#111111") },
        b: {
            $type: C,
            $value: ab.a,
        },
    });
    const subscriber = recorder();
    library.subscribe(subscriber);

    library.tokens.a.set(hex("#222222"));
    await nextUpdate();

    Assert.equal(subscriber.batches, [["a", "b"]]);
});

Subscription(
    "a deep alias dependent is included when its dependency changes",
    async () => {
        const library = Library.create<ColorAndBorder>({
            a: { $type: C, $value: hex("#111111") },
            b: {
                $type: DesignToken.Type.Border,
                $value: {
                    color: refs<ColorAndBorder>().a,
                    width: px(1),
                    style: "solid",
                },
            },
        });
        library.tokens.b.$value;
        const subscriber = recorder();
        library.subscribe(subscriber);

        library.tokens.a.set(hex("#222222"));
        await nextUpdate();

        Assert.equal(subscriber.batches, [["a", "b"]]);
    },
);

Subscription("transitive dependents are all included", async () => {
    const library = Library.create<ABC>({
        a: { $type: C, $value: hex("#111111") },
        b: {
            $type: C,
            $value: abc.a,
        },
        c: { $type: C, $value: abc.b },
    });
    library.tokens.c.$value;
    const subscriber = recorder();
    library.subscribe(subscriber);

    library.tokens.a.set(hex("#222222"));
    await nextUpdate();

    Assert.equal(subscriber.batches, [["a", "b", "c"]]);
});

Subscription(
    "multiple subscribers receive the same records array",
    async () => {
        const library = Library.create<A>({
            a: { $type: C, $value: hex("#111111") },
        });
        const first = spy();
        const second = spy();
        library.subscribe({ onChange: first });
        library.subscribe({ onChange: second });

        library.tokens.a.set(hex("#222222"));
        await nextUpdate();

        Assert.ok(first.calledOnce);
        Assert.ok(second.calledOnce);
        Assert.is(first.firstCall.args[0], second.firstCall.args[0]);
    },
);

Subscription("the records array is frozen", async () => {
    const library = Library.create<A>({
        a: { $type: C, $value: hex("#111111") },
    });
    const onChange = spy();
    library.subscribe({ onChange });

    library.tokens.a.set(hex("#222222"));
    await nextUpdate();

    Assert.ok(Object.isFrozen(onChange.firstCall.args[0]));
});

Subscription("a subscriber subscribed twice is notified once", async () => {
    const library = Library.create<A>({
        a: { $type: C, $value: hex("#111111") },
    });
    const onChange = spy();
    const subscriber = { onChange };
    library.subscribe(subscriber);
    library.subscribe(subscriber);

    library.tokens.a.set(hex("#222222"));
    await nextUpdate();

    Assert.ok(onChange.calledOnce);
});

interface ColorAndBorder {
    a: DesignToken.Color;
    b: DesignToken.Border;
}

interface BorderTheme {
    a: DesignToken.Border;
}

const throwingSubscriber = (error: Error) => ({
    onChange() {
        throw error;
    },
});

Subscription(
    "a throwing subscriber does not block later subscribers",
    async () => {
        const uncaught = captureUncaughtErrors();
        try {
            const library = Library.create<A>({
                a: { $type: C, $value: hex("#111111") },
            });
            const second = spy();
            library.subscribe(throwingSubscriber(new Error("first")));
            library.subscribe({ onChange: second });

            library.tokens.a.set(hex("#222222"));
            await settle();

            Assert.ok(second.calledOnce);
        } finally {
            uncaught.restore();
        }
    },
);

Subscription(
    "a subscriber's error is reported as an uncaught error with the original instance",
    async () => {
        const uncaught = captureUncaughtErrors();
        try {
            const library = Library.create<A>({
                a: { $type: C, $value: hex("#111111") },
            });
            const error = new Error("subscriber error");
            library.subscribe(throwingSubscriber(error));

            library.tokens.a.set(hex("#222222"));
            await settle();

            Assert.equal(uncaught.errors.length, 1);
            Assert.is(uncaught.errors[0], error);
        } finally {
            uncaught.restore();
        }
    },
);

Subscription(
    "errors from multiple subscribers are each reported and all others still run",
    async () => {
        const uncaught = captureUncaughtErrors();
        try {
            const library = Library.create<A>({
                a: { $type: C, $value: hex("#111111") },
            });
            const first = new Error("first");
            const third = new Error("third");
            const second = spy();
            const fourth = spy();
            library.subscribe(throwingSubscriber(first));
            library.subscribe({ onChange: second });
            library.subscribe(throwingSubscriber(third));
            library.subscribe({ onChange: fourth });

            library.tokens.a.set(hex("#222222"));
            await settle();

            Assert.ok(second.calledOnce, "second called");
            Assert.ok(fourth.calledOnce, "fourth called");
            Assert.equal(uncaught.errors, [first, third]);
        } finally {
            uncaught.restore();
        }
    },
);

Subscription(
    "the library keeps notifying after a subscriber throws",
    async () => {
        const uncaught = captureUncaughtErrors();
        try {
            const library = Library.create<A>({
                a: { $type: C, $value: hex("#111111") },
            });
            let calls = 0;
            library.subscribe({
                onChange() {
                    calls++;
                    throw new Error("subscriber error");
                },
            });

            library.tokens.a.set(hex("#222222"));
            await settle();
            library.tokens.a.set(hex("#333333"));
            await settle();

            Assert.is(calls, 2);
            Assert.equal(library.tokens.a.$value, hex("#333333"));
        } finally {
            uncaught.restore();
        }
    },
);

Subscription(
    "changes in one library do not notify another library's subscribers",
    async () => {
        const first = Library.create<A>({
            a: { $type: C, $value: hex("#111111") },
        });
        const second = Library.create<A>({
            a: { $type: C, $value: hex("#111111") },
        });
        const subscriber = recorder();
        second.subscribe(subscriber);

        first.tokens.a.set(hex("#222222"));
        await nextUpdate();

        Assert.equal(subscriber.batches, []);
    },
);

SameValue("setting the same primitive does not notify", async () => {
    const library = Library.create<{ n: DesignToken.Number }>({
        n: { $type: DesignToken.Type.Number, $value: 1 },
    });
    const subscriber = recorder();
    library.subscribe(subscriber);

    library.tokens.n.set(1);
    await nextUpdate();

    Assert.equal(subscriber.batches, []);
});

SameValue("setting the same ref again does not notify", async () => {
    const toA = ab.a;
    const library = Library.create<AB>({
        a: { $type: C, $value: hex("#111111") },
        b: { $type: C, $value: toA },
    });
    const subscriber = recorder();
    library.subscribe(subscriber);

    library.tokens.b.set(toA);
    await nextUpdate();

    Assert.equal(subscriber.batches, []);
});

SameValue("setting the same object reference does not notify", async () => {
    const value: DesignToken.Values.Border = {
        color: hex("#111111"),
        width: px(1),
        style: "solid",
    };
    const library = Library.create<BorderTheme>({
        a: { $type: DesignToken.Type.Border, $value: value },
    });
    const subscriber = recorder();
    library.subscribe(subscriber);

    library.tokens.a.set(value);
    await nextUpdate();

    Assert.equal(subscriber.batches, []);
});

SameValue(
    "setting a structurally equal but new object doesn't notify",
    async () => {
        const library = Library.create<BorderTheme>({
            a: {
                $type: DesignToken.Type.Border,
                $value: { color: hex("#111111"), width: px(1), style: "solid" },
            },
        });
        const subscriber = recorder();
        library.subscribe(subscriber);

        library.tokens.a.set({
            color: hex("#111111"),
            width: px(1),
            style: "solid",
        });
        await nextUpdate();

        Assert.equal(subscriber.batches, []);
    },
);

SameValue("setting an equal but new ref doesn't notify", async () => {
    const library = Library.create<AB>({
        a: { $type: C, $value: hex("#111111") },
        b: { $type: C, $value: ref("a") },
    });
    const subscriber = recorder();
    library.subscribe(subscriber);

    library.tokens.b.set(ref("a"));
    await nextUpdate();

    Assert.equal(subscriber.batches, []);
});

SameValue("a no-op set does not invalidate the cache", () => {
    const library = Library.create<AB>({
        a: { $type: C, $value: hex("#111111") },
        b: { $type: C, $value: ab.a },
    });
    const value = library.tokens.b.$value;

    library.tokens.b.set(ab.a);

    // The value isn't resolved again
    Assert.is(library.tokens.b.$value, value);
});

SameValue(
    "setting an inherited value on an extended token detaches it from the source",
    () => {
        const source = Library.create<A>({
            a: { $type: C, $value: hex("#111111") },
        });
        const extended = source.extend<{}>({});

        extended.tokens.a.set(hex("#111111"));
        source.tokens.a.set(hex("#222222"));

        Assert.equal(extended.tokens.a.$value, hex("#111111"));
    },
);

SameValue(
    "setting the inherited ref on an extended token detaches it from the source",
    () => {
        const toA = ab.a;
        const source = Library.create<AB>({
            a: { $type: C, $value: hex("#111111") },
            b: { $type: C, $value: toA },
        });
        const extended = source.extend<{}>({});

        extended.tokens.b.set(toA);
        source.tokens.b.set(hex("#222222"));

        Assert.equal(extended.tokens.b.$value, hex("#111111"));
    },
);

SameValue(
    "after detaching, source changes neither change nor notify the extended token",
    async () => {
        const source = Library.create<A>({
            a: { $type: C, $value: hex("#111111") },
        });
        const extended = source.extend<{}>({});
        extended.tokens.a.set(hex("#111111"));
        await nextUpdate();
        const subscriber = recorder();
        extended.subscribe(subscriber);

        source.tokens.a.set(hex("#222222"));
        await nextUpdate();

        Assert.equal(extended.tokens.a.$value, hex("#111111"));
        Assert.equal(subscriber.batches, []);
    },
);

SameValue(
    "setting the inherited value on an extended token reports only its origin",
    async () => {
        const value = hex("#111111");
        const toA = ab.a;
        const source = Library.create<AB>({
            a: { $type: C, $value: value },
            b: { $type: C, $value: toA },
        });
        const extended = source.extend<{}>({});
        extended.tokens.b.$value;
        const batches: Library.Change<AB>[][] = [];
        extended.subscribe({
            onChange: (changes) => batches.push([...changes]),
        });

        extended.tokens.a.set(value);
        extended.tokens.b.set(toA);
        await nextUpdate();

        Assert.equal(
            batches.map((batch) =>
                batch.map(({ token, valueChanged, originChanged }) => [
                    token.name,
                    valueChanged,
                    originChanged,
                ]),
            ),
            [
                [
                    ["a", false, true],
                    ["b", false, true],
                ],
            ],
        );
    },
);

SameValue(
    "an inherited alias resolves against the extending library before and after assignment",
    async () => {
        const aliasB = ab.a;
        const source = Library.create<AB>({
            a: { $type: C, $value: hex("#111111") },
            b: { $type: C, $value: aliasB },
        });
        const extended = source.extend<{}>({ a: { $value: hex("#999999") } });

        // Before assignment
        Assert.equal(
            extended.tokens.b.$value,
            hex("#999999"),
            "extended before",
        );
        Assert.equal(source.tokens.b.$value, hex("#111111"), "source before");

        // Assign the same ref
        extended.tokens.b.set(aliasB);
        Assert.equal(
            extended.tokens.b.$value,
            hex("#999999"),
            "extended after",
        );
        await nextUpdate();

        const subscriber = recorder();
        extended.subscribe(subscriber);

        // Source changes no longer reach the extended token
        source.tokens.a.set(hex("#222222"));
        await nextUpdate();
        Assert.equal(source.tokens.b.$value, hex("#222222"), "source updated");
        Assert.equal(
            extended.tokens.b.$value,
            hex("#999999"),
            "extended unchanged",
        );
        Assert.equal(subscriber.batches, [], "extended not notified");

        // Dependency tracking within the extended library survives detaching
        extended.tokens.a.set(hex("#AAAAAA"));
        await nextUpdate();
        Assert.equal(
            extended.tokens.b.$value,
            hex("#AAAAAA"),
            "extended dependency",
        );
        Assert.equal(subscriber.batches, [["a", "b"]], "extended notified");
    },
);

SameValue(
    "an inherited static value resolves the same before and after assignment",
    async () => {
        const source = Library.create<A>({
            a: { $type: C, $value: hex("#111111") },
        });
        const extended = source.extend<{}>({});

        Assert.equal(extended.tokens.a.$value, hex("#111111"), "before");

        extended.tokens.a.set(hex("#111111"));
        Assert.equal(extended.tokens.a.$value, hex("#111111"), "after");
        await nextUpdate();

        const subscriber = recorder();
        extended.subscribe(subscriber);
        source.tokens.a.set(hex("#222222"));
        await nextUpdate();

        Assert.equal(source.tokens.a.$value, hex("#222222"), "source updated");
        Assert.equal(
            extended.tokens.a.$value,
            hex("#111111"),
            "extended unchanged",
        );
        Assert.equal(subscriber.batches, [], "extended not notified");
    },
);

Subscription(
    "a token set to a value with a ref is included when the ref's token changes",
    async () => {
        const library = Library.create<ABC>({
            a: { $type: C, $value: hex("#111111") },
            b: { $type: C, $value: hex("#222222") },
            c: { $type: C, $value: hex("#333333") },
        });
        library.tokens.c.set(abc.a);
        library.tokens.c.$value;
        await nextUpdate();
        const subscriber = recorder();
        library.subscribe(subscriber);

        library.tokens.a.set(hex("#444444"));
        await nextUpdate();
        library.tokens.c.set(abc.b);
        library.tokens.c.$value;
        await nextUpdate();
        library.tokens.a.set(hex("#555555"));
        await nextUpdate();

        Assert.equal(subscriber.batches, [["a", "c"], ["c"], ["a"]]);
    },
);

Subscription(
    "a token whose recipe returns a ref is included when the ref's token changes",
    async () => {
        interface Picked {
            n: DesignToken.Number;
            a: DesignToken.Color;
            b: DesignToken.Color;
            c: DesignToken.Color;
        }
        const $ = refs<Picked>();
        const Pick = recipes({
            // A recipe's function can return a ref, which the library
            // resolves, though the configured value doesn't show it.
            pick: (first: number): any => (first > 0 ? $.a : $.b),
        });
        const library = Library.create<Picked>({
            n: { $type: DesignToken.Type.Number, $value: 1 },
            a: { $type: C, $value: hex("#111111") },
            b: { $type: C, $value: hex("#222222") },
            c: { $type: C, $value: Pick.pick($.n) },
        });
        library.tokens.c.$value;
        const subscriber = recorder();
        library.subscribe(subscriber);

        library.tokens.a.set(hex("#333333"));
        await nextUpdate();

        Assert.equal(subscriber.batches, [["a", "c"]]);
        Assert.equal(library.tokens.c.$value, hex("#333333"));
    },
);

Subscription(
    "a token whose recipe returns another ref is no longer included when the old ref's token changes",
    async () => {
        interface Picked {
            n: DesignToken.Number;
            a: DesignToken.Color;
            b: DesignToken.Color;
            c: DesignToken.Color;
        }
        const $ = refs<Picked>();
        const Pick = recipes({
            pick: (first: number): any => (first > 0 ? $.a : $.b),
        });
        const library = Library.create<Picked>({
            n: { $type: DesignToken.Type.Number, $value: 1 },
            a: { $type: C, $value: hex("#111111") },
            b: { $type: C, $value: hex("#222222") },
            c: { $type: C, $value: Pick.pick($.n) },
        });
        library.tokens.c.$value;
        library.tokens.n.set(0);
        Assert.equal(library.tokens.c.$value, hex("#222222"));
        await nextUpdate();
        const subscriber = recorder();
        library.subscribe(subscriber);

        library.tokens.a.set(hex("#333333"));
        await nextUpdate();
        library.tokens.b.set(hex("#444444"));
        await nextUpdate();

        Assert.equal(subscriber.batches, [["a"], ["b", "c"]]);
        Assert.equal(library.tokens.c.$value, hex("#444444"));
    },
);

Subscription(
    "an extension that overrides a recipe to return another ref is included when that ref's token changes",
    async () => {
        interface Picked {
            n: DesignToken.Number;
            a: DesignToken.Color;
            b: DesignToken.Color;
            c: DesignToken.Color;
        }
        const $ = refs<Picked>();
        const Pick = recipes({
            pick: (_: number): any => $.a,
        });
        const library = Library.create<Picked>({
            n: { $type: DesignToken.Type.Number, $value: 1 },
            a: { $type: C, $value: hex("#111111") },
            b: { $type: C, $value: hex("#222222") },
            c: { $type: C, $value: Pick.pick($.n) },
        });
        // The refs a recipe's result has are found in each library that
        // resolves it, as an override can return different ones.
        const extended = library.extend<{}>(
            {},
            { recipes: [override(Pick.pick, (_: number): any => $.b)] },
        );
        library.tokens.c.$value;
        extended.tokens.c.$value;
        const fromLibrary = recorder();
        const fromExtended = recorder();
        library.subscribe(fromLibrary);
        extended.subscribe(fromExtended);

        library.tokens.b.set(hex("#333333"));
        await nextUpdate();

        Assert.equal(fromLibrary.batches, [["b"]]);
        // A subscribed extension isn't told of the tokens it inherits.
        Assert.equal(fromExtended.batches, [["c"]]);
        Assert.equal(library.tokens.c.$value, hex("#111111"));
        Assert.equal(extended.tokens.c.$value, hex("#333333"));
    },
);

interface Measured {
    n: DesignToken.Number;
    d: DesignToken.Dimension;
}
const measured = refs<Measured>();
// While it fails, a token that a change dropped stays dropped, even in a
// library that resolves its tokens as they change.
let failing = false;
const { scale } = recipes({
    scale: (_: number) => {
        if (failing) {
            throw new Error("scale failed");
        }
        return px(4);
    },
});
const measuredConfig = () =>
    ({
        n: { $type: DesignToken.Type.Number, $value: 1 },
        // Equal for any n, so a change of n drops d without changing it.
        d: { $type: DesignToken.Type.Dimension, $value: scale(measured.n) },
    }) as const;

Unsubscribed(
    "a value dropped while subscribed isn't kept once the last subscriber unsubscribes",
    async () => {
        const library = Library.create<Measured>(measuredConfig());
        const subscriber = recorder();
        library.subscribe(subscriber);
        const before = library.tokens.d.$value;

        failing = true;
        library.tokens.n.set(2);
        await nextUpdate();
        library.unsubscribe(subscriber);
        failing = false;

        const after = library.tokens.d.$value;
        Assert.equal(after, before);
        Assert.is.not(after, before);
    },
);

Unsubscribed(
    "an extension's value dropped while subscribed isn't kept once the last subscriber unsubscribes",
    async () => {
        const library = Library.create<Measured>(measuredConfig());
        const extended = library.extend<{}>({ n: { $value: 1 } });
        const subscriber = recorder();
        extended.subscribe(subscriber);
        const before = extended.tokens.d.$value;

        failing = true;
        extended.tokens.n.set(2);
        await nextUpdate();
        extended.unsubscribe(subscriber);
        failing = false;

        const after = extended.tokens.d.$value;
        Assert.equal(after, before);
        Assert.is.not(after, before);
    },
);

Unsubscribed("a library with another subscriber keeps comparing", async () => {
    const library = Library.create<Measured>(measuredConfig());
    const first = recorder();
    const second = recorder();
    library.subscribe(first);
    library.subscribe(second);
    const before = library.tokens.d.$value;

    library.tokens.n.set(2);
    await nextUpdate();
    library.unsubscribe(first);

    Assert.is(library.tokens.d.$value, before);
});

Unsubscribed(
    "a value dropped while subscribed is collected once the last subscriber unsubscribes",
    async () => {
        const library = Library.create<Measured>(measuredConfig());
        const subscriber = recorder();
        library.subscribe(subscriber);
        const dropped = new WeakRef(library.tokens.d.$value);

        failing = true;
        library.tokens.n.set(2);
        await nextUpdate();
        library.unsubscribe(subscriber);
        failing = false;

        Assert.ok(await isCollected(dropped));
    },
);

Subscription.run();
SameValue.run();
Unsubscribed.run();
