import { suite } from "uvu";
import * as Assert from "uvu/assert";
import { recipes } from "../lib/recipe.js";
import { refs } from "../lib/ref.js";
import { DesignToken } from "../lib/design-token.js";
import { Library, TokenResolutionError } from "../lib/library.js";
import { captureUncaughtErrors, recorder, settle } from "./helpers.js";

const Errors = suite("Library subscriptions: errors");
const N = DesignToken.Type.Number;

interface Numbers {
    n: DesignToken.Number;
    a: DesignToken.Number;
    b: DesignToken.Number;
}

const $ = refs<Numbers>();
const failure = new Error("negative");
const { positive } = recipes({
    positive: (n: number): number => {
        if (n < 0) {
            throw failure;
        }
        return n;
    },
});

/** A library where `a` is `positive(n)` and `b` refers to `a`. */
const numbers = (n = 1) =>
    Library.create<Numbers>({
        n: { $type: N, $value: n },
        a: { $type: N, $value: positive($.n) },
        b: { $type: N, $value: $.a },
    });

Errors(
    "a recipe that throws as a subscribed library re-resolves is given to onError",
    async () => {
        const library = numbers();
        const subscriber = recorder();
        library.subscribe(subscriber);

        library.tokens.n.set(-1);
        await settle();

        Assert.is(
            subscriber.errors.length,
            1,
            "once, for the token that threw",
        );
        const [error] = subscriber.errors;
        Assert.instance(error, TokenResolutionError);
        Assert.is(error.name, "TokenResolutionError");
        Assert.is(error.tokenName, "a");
        Assert.is(error.phase, "resolve");
        Assert.is(error.cause, failure);
        Assert.equal(
            subscriber.batches.map((batch) => batch.sort()),
            [["a", "b", "n"]],
        );
        // A read still throws the error itself.
        Assert.throws(
            () => library.tokens.b.$value,
            (thrown: unknown) => thrown === failure,
        );
    },
);

Errors(
    "a token that throws as it's subscribed is given to onError",
    async () => {
        const library = numbers(-1);
        const subscriber = recorder();
        library.subscribe(subscriber);
        Assert.equal(subscriber.errors, [], "in a microtask");

        await settle();

        Assert.equal(
            subscriber.errors.map((error) => [error.tokenName, error.cause]),
            [["a", failure]],
        );
        Assert.equal(subscriber.batches, []);
    },
);

Errors("the subscription keeps delivering after an error", async () => {
    const library = numbers();
    const subscriber = recorder();
    library.subscribe(subscriber);

    library.tokens.n.set(-1);
    await settle();
    library.tokens.n.set(2);
    await settle();
    library.tokens.n.set(-2);
    await settle();

    Assert.equal(
        subscriber.batches.map((batch) => batch.sort()),
        [
            ["a", "b", "n"],
            ["a", "b", "n"],
            ["a", "b", "n"],
        ],
    );
    Assert.is(subscriber.errors.length, 2, "an error for each change");
});

Errors(
    "an error that no subscriber has an onError for is thrown from a microtask",
    async () => {
        const uncaught = captureUncaughtErrors();
        try {
            const library = numbers();
            const batches: number[] = [];
            library.subscribe({
                onChange: (changes) => batches.push(changes.length),
            });

            Assert.not.throws(() => library.tokens.n.set(-1));
            await settle();

            Assert.equal(batches, [3], "the batch is delivered");
            Assert.is(uncaught.errors.length, 1);
            const [error] = uncaught.errors as TokenResolutionError[];
            Assert.instance(error, TokenResolutionError);
            Assert.is(error.tokenName, "a");
            Assert.is(error.cause, failure);
        } finally {
            uncaught.restore();
        }
    },
);

Errors(
    "an error is given to the subscribers with onError, and not thrown",
    async () => {
        const uncaught = captureUncaughtErrors();
        try {
            const library = numbers();
            const subscriber = recorder();
            library.subscribe({ onChange() {} });
            library.subscribe(subscriber);

            library.tokens.n.set(-1);
            await settle();

            Assert.is(subscriber.errors.length, 1);
            Assert.equal(uncaught.errors, []);
        } finally {
            uncaught.restore();
        }
    },
);

Errors(
    "an onError that throws doesn't stop the other subscribers",
    async () => {
        const uncaught = captureUncaughtErrors();
        try {
            const library = numbers();
            const thrown = new Error("onError failed");
            const subscriber = recorder();
            library.subscribe({
                onChange() {},
                onError() {
                    throw thrown;
                },
            });
            library.subscribe(subscriber);

            library.tokens.n.set(-1);
            await settle();

            Assert.is(subscriber.errors.length, 1);
            Assert.equal(uncaught.errors, [thrown]);
        } finally {
            uncaught.restore();
        }
    },
);

Errors(
    "an extension's default subscriber isn't given the errors of its ancestor's tokens",
    async () => {
        const uncaught = captureUncaughtErrors();
        try {
            const library = numbers();
            library.subscribe(recorder());
            const extension = library.extend({
                n: { $value: 1 },
            } as never);
            const own = recorder();
            const inherited = recorder();
            extension.subscribe(own);
            extension.subscribe(inherited, { inherited: true });
            const plain = library.extend({});
            const told = recorder();
            plain.subscribe(told);
            const all = recorder();
            plain.subscribe(all, { inherited: true });

            library.tokens.n.set(-1);
            extension.tokens.n.set(-1);
            await settle();

            Assert.equal(
                own.errors.map((error) => error.tokenName),
                ["a"],
                "its own token",
            );
            Assert.equal(
                inherited.errors.map((error) => error.tokenName),
                ["a"],
            );
            Assert.equal(told.errors, [], "a token that is its ancestor's");
            Assert.equal(
                all.errors.map((error) => error.tokenName),
                ["a"],
            );
            Assert.equal(uncaught.errors, []);
        } finally {
            uncaught.restore();
        }
    },
);

Errors("a read of a token that throws still throws to its reader", () => {
    const library = numbers();
    library.subscribe(recorder());
    library.tokens.n.set(-1);

    Assert.throws(
        () => library.tokens.a.$value,
        (thrown: unknown) => thrown === failure,
    );
});

Errors(
    "an isEqual that throws comparing an ancestor's token is given to onError",
    async () => {
        const thrown = new Error("isEqual failed");
        const library: any = Library.create(
            {
                n: { $type: N, $value: 1 },
                box: { $type: "box", $value: { n: refs<any>().n } },
            } as any,
            {
                types: {
                    box: {
                        isEqual: () => {
                            throw thrown;
                        },
                    },
                },
            } as any,
        );
        const extension = library.extend({});
        const subscriber = recorder();
        extension.subscribe(subscriber, { inherited: true });

        library.tokens.n.set(2);
        await settle();

        Assert.equal(
            subscriber.errors.map((error) => [
                error.tokenName,
                error.phase,
                error.cause,
            ]),
            [["box", "isEqual", thrown]],
        );
        Assert.equal(
            subscriber.batches.map((batch) => batch.sort()),
            [["box", "n"]],
        );
        Assert.equal(extension.tokens.box.$value, { n: 2 });
    },
);

Errors.run();
