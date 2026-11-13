import { suite } from "uvu";
import { spy } from "sinon";
import * as Assert from "uvu/assert";
import { DesignToken } from "../lib/design-token.js";
import { Library } from "../lib/library.js";
import { recipes } from "../lib/recipe.js";
import { refs } from "../lib/ref.js";
import { ABC, nextUpdate, recorder } from "./helpers.js";
import { isCollected } from "./collect.js";
import { hex } from "./values.js";

const Lazy = suite("an extension makes its tokens when they are read");
const Lifetime = suite("an extension that nothing refers to is collected");
const C = DesignToken.Type.Color;
const $ = refs<ABC>();

const source = () =>
    Library.create<ABC>({
        a: { $type: C, $value: hex("#111111") },
        b: { $type: C, $value: $.a },
        c: { $type: C, $value: hex("#333333") },
    });

Lazy("an extension's token that is read has the source's value", () => {
    const library = source();
    const extended = library.extend<{}>({});

    library.tokens.a.set(hex("#222222"));

    Assert.equal(extended.tokens.b.$value, hex("#222222"));
    Assert.is(extended.tokens.b, extended.tokens.b);
});

Lazy("a token read after the source is set follows later sets", () => {
    const library = source();
    const extended = library.extend<{}>({});

    library.tokens.a.set(hex("#222222"));
    Assert.equal(extended.tokens.a.$value, hex("#222222"));
    library.tokens.a.set(hex("#444444"));

    Assert.equal(extended.tokens.a.$value, hex("#444444"));
    Assert.equal(extended.tokens.b.$value, hex("#444444"));
});

Lazy(
    "reading a token of an extension doesn't watch the source's token",
    async () => {
        const library = source();
        const extended = library.extend<{}>({});
        const subscriber = recorder();
        // `b` makes `a` of the extension as it resolves.
        extended.tokens.b.$value;
        extended.subscribe(subscriber);

        library.tokens.a.set(hex("#222222"));
        await nextUpdate();

        // Its tokens are its source's, which it isn't told of.
        Assert.equal(subscriber.batches, []);
    },
);

Lazy("an override of an extension is still checked by extend()", () => {
    Assert.throws(
        () =>
            source().extend({
                a: { $type: DesignToken.Type.Dimension } as any,
            }),
        /cannot change the '\$type'/,
    );
});

Lazy("a set on a token that hasn't been read detaches it", () => {
    const library = source();
    const extended = library.extend<{}>({});

    extended.tokens.a.set(hex("#aaaaaa"));
    library.tokens.a.set(hex("#222222"));

    Assert.equal(extended.tokens.a.$value, hex("#aaaaaa"));
    Assert.equal(library.tokens.a.$value, hex("#222222"));
});

Lazy("an extension of an extension follows through the middle", () => {
    const library = source();
    const middle = library.extend<{}>({});
    const last = middle.extend<{}>({});

    library.tokens.a.set(hex("#222222"));
    Assert.equal(last.tokens.b.$value, hex("#222222"));
    middle.tokens.a.set(hex("#555555"));

    Assert.equal(last.tokens.b.$value, hex("#555555"));
});

Lazy("extend() reads no token of the library it extends", () => {
    const made = spy((color: DesignToken.Values.Readonly.Color) => color);
    const { same } = recipes({ same: made });
    const library = Library.create<ABC>({
        a: { $type: C, $value: same(hex("#111111")) },
        b: { $type: C, $value: same($.a) },
        c: { $type: C, $value: same(hex("#333333")) },
    });

    const extended = library.extend<{}>({ c: { $value: $.b } });

    Assert.is(made.callCount, 0);
    Assert.equal(extended.tokens.c.$value, hex("#111111"));
});

Lifetime("an extension that was never read", async () => {
    const library = source();
    const extended = new WeakRef(library.extend<{}>({}).tokens);

    Assert.ok(await isCollected(extended));
});

Lifetime("an extension whose tokens were read", async () => {
    const library = source();
    const extended = (() => {
        const extension = library.extend<{}>({});
        extension.tokens.b.$value;
        return new WeakRef(extension.tokens);
    })();

    Assert.ok(await isCollected(extended));
    // The links of the collected tokens are gone, or are harmless.
    library.tokens.a.set(hex("#222222"));
    Assert.equal(library.tokens.b.$value, hex("#222222"));
});

Lifetime("an extension with a subscriber", async () => {
    const library = source();
    const subscriber = recorder();
    const extended = (() => {
        const extension = library.extend<{}>({});
        extension.subscribe(subscriber);
        return new WeakRef(extension.tokens);
    })();

    Assert.ok(await isCollected(extended));
    library.tokens.a.set(hex("#222222"));
    await nextUpdate();
    Assert.equal(subscriber.batches, []);
});

Lifetime("an extension of an extension that is kept", async () => {
    const library = source();
    const middle = library.extend<{}>({});
    middle.tokens.b.$value;
    const last = (() => {
        const extension = middle.extend<{}>({});
        extension.tokens.b.$value;
        return new WeakRef(extension.tokens);
    })();

    Assert.ok(await isCollected(last));
    library.tokens.a.set(hex("#222222"));
    Assert.equal(middle.tokens.b.$value, hex("#222222"));
});

Lifetime("an extension that is referred to is kept", async () => {
    const library = source();
    const extended = library.extend<{}>({});
    extended.tokens.b.$value;
    const target = new WeakRef(extended.tokens);

    Assert.not.ok(await isCollected(target));
    library.tokens.a.set(hex("#222222"));
    Assert.equal(extended.tokens.b.$value, hex("#222222"));
});

Lifetime(
    "an extension that is kept after its source is dropped resolves and follows sets",
    async () => {
        const make = () => {
            const library = source();
            return {
                extended: library.extend<{}>({}),
                dropped: new WeakRef(library),
            };
        };
        const { extended, dropped } = make();

        Assert.ok(await isCollected(dropped));
        Assert.equal(extended.tokens.b.$value, hex("#111111"));
        extended.tokens.a.set(hex("#222222"));
        Assert.equal(extended.tokens.b.$value, hex("#222222"));
    },
);

Lazy.run();
Lifetime.run();
