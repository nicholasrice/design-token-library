import { suite } from "uvu";
import * as Assert from "uvu/assert";
import { spy } from "sinon";
import { DesignToken } from "../lib/design-token.js";
import {
    captureUncaughtErrors,
    createUntyped,
    nextUpdate,
    recorder,
    settle,
} from "./helpers.js";

const Subscription = suite("Library subscriptions");
const SameValue = suite("Library subscriptions: unchanged values");
const C = DesignToken.Type.Color;

Subscription("[S1] unsubscribe stops notifications", async () => {
    const library = createUntyped({ a: { type: C, value: "#111111" } });
    const subscriber = recorder();
    library.subscribe(subscriber);

    library.tokens.a.set("#222222");
    await nextUpdate();
    library.unsubscribe(subscriber);
    library.tokens.a.set("#333333");
    await nextUpdate();

    Assert.equal(subscriber.batches, [["a"]]);
});

Subscription(
    "[S2] unsubscribing an unknown subscriber is a no-op",
    async () => {
        const library = createUntyped({ a: { type: C, value: "#111111" } });
        const subscriber = recorder();
        library.subscribe(subscriber);

        Assert.not.throws(() => library.unsubscribe(recorder()));

        library.tokens.a.set("#222222");
        await nextUpdate();
        Assert.equal(subscriber.batches, [["a"]]);
    },
);

Subscription(
    "[S3] a token set twice in one microtask appears once in the batch",
    async () => {
        const library = createUntyped({ a: { type: C, value: "#111111" } });
        const subscriber = recorder();
        library.subscribe(subscriber);

        library.tokens.a.set("#222222");
        library.tokens.a.set("#333333");
        await nextUpdate();

        Assert.equal(subscriber.batches, [["a"]]);
    },
);

Subscription(
    "[S4] a read alias token is included when its dependency changes",
    async () => {
        const library = createUntyped({
            a: { type: C, value: "#111111" },
            b: { type: C, value: (context: any) => context.a },
        });
        const subscriber = recorder();
        library.subscribe(subscriber);
        library.tokens.b.value;

        library.tokens.a.set("#222222");
        await nextUpdate();

        Assert.equal(subscriber.batches, [["a", "b"]]);
    },
);

Subscription(
    "[S5] an alias token that was never read is not included (lazy tracking)",
    async () => {
        const library = createUntyped({
            a: { type: C, value: "#111111" },
            b: { type: C, value: (context: any) => context.a },
        });
        const subscriber = recorder();
        library.subscribe(subscriber);

        library.tokens.a.set("#222222");
        await nextUpdate();

        Assert.equal(subscriber.batches, [["a"]]);
    },
);

Subscription(
    "[S6] a deep alias dependent is included when its dependency changes",
    async () => {
        const library = createUntyped({
            a: { type: C, value: "#111111" },
            b: {
                type: DesignToken.Type.Border,
                value: {
                    color: (context: any) => context.a,
                    width: "1px",
                    style: "solid",
                },
            },
        });
        library.tokens.b.value;
        const subscriber = recorder();
        library.subscribe(subscriber);

        library.tokens.a.set("#222222");
        await nextUpdate();

        Assert.equal(subscriber.batches, [["a", "b"]]);
    },
);

Subscription("[S7] transitive dependents are all included", async () => {
    const library = createUntyped({
        a: { type: C, value: "#111111" },
        b: { type: C, value: (context: any) => context.a },
        c: { type: C, value: (context: any) => context.b },
    });
    library.tokens.c.value;
    const subscriber = recorder();
    library.subscribe(subscriber);

    library.tokens.a.set("#222222");
    await nextUpdate();

    Assert.equal(subscriber.batches, [["a", "b", "c"]]);
});

Subscription(
    "[S8] multiple subscribers receive the same records array",
    async () => {
        const library = createUntyped({ a: { type: C, value: "#111111" } });
        const first = spy();
        const second = spy();
        library.subscribe({ onChange: first });
        library.subscribe({ onChange: second });

        library.tokens.a.set("#222222");
        await nextUpdate();

        Assert.ok(first.calledOnce);
        Assert.ok(second.calledOnce);
        Assert.is(first.firstCall.args[0], second.firstCall.args[0]);
    },
);

Subscription("[S9] the records array is frozen", async () => {
    const library = createUntyped({ a: { type: C, value: "#111111" } });
    const onChange = spy();
    library.subscribe({ onChange });

    library.tokens.a.set("#222222");
    await nextUpdate();

    Assert.ok(Object.isFrozen(onChange.firstCall.args[0]));
});

Subscription(
    "[S10] a subscriber subscribed twice is notified once",
    async () => {
        const library = createUntyped({ a: { type: C, value: "#111111" } });
        const onChange = spy();
        const subscriber = { onChange };
        library.subscribe(subscriber);
        library.subscribe(subscriber);

        library.tokens.a.set("#222222");
        await nextUpdate();

        Assert.ok(onChange.calledOnce);
    },
);

const throwingSubscriber = (error: Error) => ({
    onChange() {
        throw error;
    },
});

Subscription.skip(
    "[S11a] a throwing subscriber does not block later subscribers (fails: #18)",
    async () => {
        const uncaught = captureUncaughtErrors();
        try {
            const library = createUntyped({
                a: { type: C, value: "#111111" },
            });
            const second = spy();
            library.subscribe(throwingSubscriber(new Error("first")));
            library.subscribe({ onChange: second });

            library.tokens.a.set("#222222");
            await settle();

            Assert.ok(second.calledOnce);
        } finally {
            uncaught.restore();
        }
    },
);

Subscription(
    "[S11b] a subscriber's error is reported as an uncaught error with the original instance",
    async () => {
        const uncaught = captureUncaughtErrors();
        try {
            const library = createUntyped({
                a: { type: C, value: "#111111" },
            });
            const error = new Error("subscriber error");
            library.subscribe(throwingSubscriber(error));

            library.tokens.a.set("#222222");
            await settle();

            Assert.equal(uncaught.errors.length, 1);
            Assert.is(uncaught.errors[0], error);
        } finally {
            uncaught.restore();
        }
    },
);

Subscription.skip(
    "[S11c] errors from multiple subscribers are each reported and all others still run (fails: #18)",
    async () => {
        const uncaught = captureUncaughtErrors();
        try {
            const library = createUntyped({
                a: { type: C, value: "#111111" },
            });
            const first = new Error("first");
            const third = new Error("third");
            const second = spy();
            const fourth = spy();
            library.subscribe(throwingSubscriber(first));
            library.subscribe({ onChange: second });
            library.subscribe(throwingSubscriber(third));
            library.subscribe({ onChange: fourth });

            library.tokens.a.set("#222222");
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
    "[S11d] the library keeps notifying after a subscriber throws",
    async () => {
        const uncaught = captureUncaughtErrors();
        try {
            const library = createUntyped({
                a: { type: C, value: "#111111" },
            });
            let calls = 0;
            library.subscribe({
                onChange() {
                    calls++;
                    throw new Error("subscriber error");
                },
            });

            library.tokens.a.set("#222222");
            await settle();
            library.tokens.a.set("#333333");
            await settle();

            Assert.is(calls, 2);
            Assert.is(library.tokens.a.value, "#333333");
        } finally {
            uncaught.restore();
        }
    },
);

Subscription(
    "[S13] changes in one library do not notify another library's subscribers",
    async () => {
        const first = createUntyped({ a: { type: C, value: "#111111" } });
        const second = createUntyped({ a: { type: C, value: "#111111" } });
        const subscriber = recorder();
        second.subscribe(subscriber);

        first.tokens.a.set("#222222");
        await nextUpdate();

        Assert.equal(subscriber.batches, []);
    },
);

SameValue.skip(
    "[S12a] setting the same primitive does not notify (fails: #22)",
    async () => {
        const library = createUntyped({ a: { type: C, value: "#111111" } });
        const subscriber = recorder();
        library.subscribe(subscriber);

        library.tokens.a.set("#111111");
        await nextUpdate();

        Assert.equal(subscriber.batches, []);
    },
);

SameValue.skip(
    "[S12b] setting the same alias function reference does not notify (fails: #22)",
    async () => {
        const alias = (context: any) => context.a;
        const library = createUntyped({
            a: { type: C, value: "#111111" },
            b: { type: C, value: alias },
        });
        const subscriber = recorder();
        library.subscribe(subscriber);

        library.tokens.b.set(alias);
        await nextUpdate();

        Assert.equal(subscriber.batches, []);
    },
);

SameValue.skip(
    "[S12c] setting the same object reference does not notify (fails: #22)",
    async () => {
        const value = { color: "#111111", width: "1px", style: "solid" };
        const library = createUntyped({
            a: { type: DesignToken.Type.Border, value },
        });
        const subscriber = recorder();
        library.subscribe(subscriber);

        library.tokens.a.set(value);
        await nextUpdate();

        Assert.equal(subscriber.batches, []);
    },
);

SameValue(
    "[S12d] setting a structurally equal but new object notifies",
    async () => {
        const library = createUntyped({
            a: {
                type: DesignToken.Type.Border,
                value: { color: "#111111", width: "1px", style: "solid" },
            },
        });
        const subscriber = recorder();
        library.subscribe(subscriber);

        library.tokens.a.set({
            color: "#111111",
            width: "1px",
            style: "solid",
        });
        await nextUpdate();

        Assert.equal(subscriber.batches, [["a"]]);
    },
);

SameValue(
    "[S12e] setting a new function with the same body notifies",
    async () => {
        const library = createUntyped({
            a: { type: C, value: "#111111" },
            b: { type: C, value: (context: any) => context.a },
        });
        const subscriber = recorder();
        library.subscribe(subscriber);

        library.tokens.b.set((context: any) => context.a);
        await nextUpdate();

        Assert.equal(subscriber.batches, [["b"]]);
    },
);

SameValue.skip(
    "[S12f] a no-op set does not invalidate the cache (fails: #22)",
    () => {
        const alias = spy((context: any) => context.a);
        const library = createUntyped({
            a: { type: C, value: "#111111" },
            b: { type: C, value: alias },
        });
        library.tokens.b.value;

        library.tokens.b.set(alias);
        library.tokens.b.value;

        Assert.is(alias.callCount, 1);
    },
);

SameValue(
    "[S12g] setting an inherited value on an extended token detaches it from the source",
    () => {
        const source = createUntyped({ a: { type: C, value: "#111111" } });
        const extended = source.extend({});

        extended.tokens.a.set("#111111");
        source.tokens.a.set("#222222");

        Assert.is(extended.tokens.a.value, "#111111");
    },
);

SameValue(
    "[S12h] after detaching, source changes neither change nor notify the extended token",
    async () => {
        const source = createUntyped({ a: { type: C, value: "#111111" } });
        const extended = source.extend({});
        extended.tokens.a.set("#111111");
        await nextUpdate();
        const subscriber = recorder();
        extended.subscribe(subscriber);

        source.tokens.a.set("#222222");
        await nextUpdate();

        Assert.is(extended.tokens.a.value, "#111111");
        Assert.equal(subscriber.batches, []);
    },
);

SameValue.skip(
    "[S12i] setting the inherited value on an extended token does not notify (fails: #22)",
    async () => {
        const alias = (context: any) => context.a;
        const source = createUntyped({
            a: { type: C, value: "#111111" },
            b: { type: C, value: alias },
        });
        const extended = source.extend({});
        extended.tokens.b.value;
        const subscriber = recorder();
        extended.subscribe(subscriber);

        extended.tokens.a.set("#111111");
        extended.tokens.b.set(alias);
        await nextUpdate();

        Assert.equal(subscriber.batches, []);
    },
);

SameValue(
    "[S12j] an inherited alias resolves against the extending library before and after assignment",
    async () => {
        const aliasB = (context: any) => context.a;
        const source = createUntyped({
            a: { type: C, value: "#111111" },
            b: { type: C, value: aliasB },
        });
        const extended = source.extend({ a: { value: "#999999" } });

        // Before assignment
        Assert.is(extended.tokens.b.value, "#999999", "extended before");
        Assert.is(source.tokens.b.value, "#111111", "source before");

        // Assign the same alias reference
        extended.tokens.b.set(aliasB);
        Assert.is(extended.tokens.b.value, "#999999", "extended after");
        await nextUpdate();

        const subscriber = recorder();
        extended.subscribe(subscriber);

        // Source changes no longer reach the extended token
        source.tokens.a.set("#222222");
        await nextUpdate();
        Assert.is(source.tokens.b.value, "#222222", "source updated");
        Assert.is(extended.tokens.b.value, "#999999", "extended unchanged");
        Assert.equal(subscriber.batches, [], "extended not notified");

        // Dependency tracking within the extended library survives detaching
        extended.tokens.a.set("#AAAAAA");
        await nextUpdate();
        Assert.is(extended.tokens.b.value, "#AAAAAA", "extended dependency");
        Assert.equal(subscriber.batches, [["a", "b"]], "extended notified");
    },
);

SameValue(
    "[S12k] an inherited static value resolves the same before and after assignment",
    async () => {
        const source = createUntyped({ a: { type: C, value: "#111111" } });
        const extended = source.extend({});

        Assert.is(extended.tokens.a.value, "#111111", "before");

        extended.tokens.a.set("#111111");
        Assert.is(extended.tokens.a.value, "#111111", "after");
        await nextUpdate();

        const subscriber = recorder();
        extended.subscribe(subscriber);
        source.tokens.a.set("#222222");
        await nextUpdate();

        Assert.is(source.tokens.a.value, "#222222", "source updated");
        Assert.is(extended.tokens.a.value, "#111111", "extended unchanged");
        Assert.equal(subscriber.batches, [], "extended not notified");
    },
);

Subscription.run();
SameValue.run();
