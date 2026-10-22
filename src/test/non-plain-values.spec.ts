/**
 * Values that are not plain data (class instances, `Date`, `Map`, ...) are passed through
 * unchanged, and only plain objects and arrays are copied and walked for refs.
 */
import { suite } from "uvu";
import * as Assert from "uvu/assert";
import { DesignToken } from "../lib/design-token.js";
import { Library } from "../lib/library.js";
import { refs } from "../lib/ref.js";

const NonPlain = suite("Non-plain values");

class Palette {
    readonly lookup = () => "own function property";

    constructor(readonly swatches: number[]) {}

    first() {
        return this.swatches[0];
    }
}

// The configs are untyped, as a value cast through `any` would be, so that the runtime is
// tested without the types. Typed class values are tested with the custom types.
const create = (config: Record<string, unknown>) => Library.create<any>(config);

const $ = refs<{ n: DesignToken.Number; source: DesignToken.Number }>();

/**
 * A library where `ref` refers to the token `source`, whose value is `value`.
 */
const referring = (value: unknown) =>
    create({
        source: { $type: "x", $value: value },
        ref: { $type: "x", $value: $.source },
    }).tokens.ref.$value;

NonPlain("a class instance through a ref is the same instance", () => {
    const instance = new Palette([1, 2, 3]);
    const value = referring(instance);

    Assert.is(value, instance);
    Assert.instance(value, Palette);
    Assert.is(value.first(), 1);
});

NonPlain("a static class instance is the same instance", () => {
    const instance = new Palette([1, 2, 3]);
    const library = create({ p: { $type: "palette", $value: instance } });

    Assert.is(library.tokens.p.$value, instance);
});

NonPlain("an own function property of a class instance is not called", () => {
    let calls = 0;
    class Counted {
        readonly count = () => ++calls;
    }
    const instance = new Counted();

    Assert.is(typeof referring(instance).count, "function");
    Assert.is(calls, 0);
});

NonPlain("Date, Map and Set values are the same instances", () => {
    const date = new Date(0);
    const map = new Map([[1, 2]]);
    const set = new Set([1]);

    Assert.is(referring(date), date);
    Assert.is(referring(map), map);
    Assert.is(referring(set), set);
});

NonPlain(
    "a non-plain value inside plain data is kept, and sibling refs still resolve",
    () => {
        const instance = new Palette([1, 2, 3]);
        const library = create({
            n: { $type: "number", $value: 5 },
            v: {
                $type: "composite",
                $value: {
                    palette: instance,
                    list: [instance, $.n],
                    n: $.n,
                },
            },
        });

        const value = library.tokens.v.$value;

        Assert.is(value.palette, instance);
        Assert.is(value.list[0], instance);
        Assert.is(value.list[1], 5);
        Assert.is(value.n, 5);
    },
);

NonPlain("plain data is still copied and walked for refs", () => {
    const source = { a: 1, nested: { b: 2 } };
    const library = create({
        n: { $type: "number", $value: 3 },
        v: { $type: "composite", $value: { ...source, ref: $.n } },
    });

    const value = library.tokens.v.$value;

    Assert.equal(value, { a: 1, nested: { b: 2 }, ref: 3 });
    Assert.is.not(value.nested, source.nested);
});

NonPlain("an object with a null prototype is walked as plain data", () => {
    const plain = Object.create(null);
    plain.ref = $.n;
    const library = create({
        n: { $type: "number", $value: 3 },
        v: { $type: "composite", $value: plain },
    });

    Assert.is(library.tokens.v.$value.ref, 3);
});

const Copy = suite("Copies of plain data");

Copy("symbol-keyed and non-enumerable properties are copied", () => {
    const key = Symbol("key");
    const source = Object.defineProperty({ [key]: $.n }, "hidden", {
        value: $.n,
        enumerable: false,
    });
    const value = create({
        n: { $type: "number", $value: 3 },
        v: { $type: "composite", $value: source },
    }).tokens.v.$value;

    Assert.is(value[key], 3);
    Assert.is(value.hidden, 3);
    Assert.not.ok(
        Object.keys(value).includes("hidden"),
        "still not enumerable",
    );
});

Copy("an object in a value twice has one copy", () => {
    const shared = { n: $.n };
    const value = create({
        n: { $type: "number", $value: 3 },
        v: { $type: "composite", $value: { a: shared, b: [shared] } },
    }).tokens.v.$value;

    Assert.is(value.a, value.b[0]);
    Assert.is.not(value.a, shared);
    Assert.is(value.a.n, 3);
});

Copy("a value that contains itself resolves", () => {
    const cyclic: Record<string, unknown> = { n: $.n };
    cyclic.self = cyclic;
    const value = create({
        n: { $type: "number", $value: 3 },
        v: { $type: "composite", $value: cyclic },
    }).tokens.v.$value;

    Assert.is(value.self, value);
    Assert.is(value.n, 3);
});

Copy("a getter is read once, into a data property", () => {
    let reads = 0;
    const value = create({
        v: {
            $type: "composite",
            $value: {
                get count() {
                    return ++reads;
                },
            },
        },
    }).tokens.v.$value;

    Assert.is(value.count, 1);
    Assert.is(value.count, 1);
    Assert.is(reads, 1);
    Assert.ok("value" in Object.getOwnPropertyDescriptor(value, "count")!);
});

Copy("an Array subclass isn't plain data, and is returned as it is", () => {
    class Steps extends Array<number> {}
    const steps = Steps.from([1, 2]);

    Assert.is(referring(steps), steps);
});

Copy("an object literal from another realm is plain data", async () => {
    // node:vm makes another realm; it's imported by name so the specs don't
    // need Node's types.
    const vm = await import(String("node:vm"));
    const literal = vm.runInNewContext("({})");
    literal.n = $.n;
    const value = create({
        n: { $type: "number", $value: 3 },
        v: { $type: "composite", $value: literal },
    }).tokens.v.$value;

    Assert.is(value.n, 3);
});

const Throws = suite("Refs in values that aren't plain data");

Throws(
    "a ref in a class instance throws, naming the token and the class",
    () => {
        class Holder {
            readonly level = $.n;
        }
        const library = create({
            n: { $type: "number", $value: 3 },
            v: { $type: "composite", $value: new Holder() },
        });

        Assert.throws(
            () => library.tokens.v.$value,
            /The value of "v" has a ref in a Holder, which isn't plain data/,
        );
    },
);

Throws("a ref deeper in a class instance throws", () => {
    class Holder {
        readonly nested = { list: [$.n] };
    }
    const library = create({
        n: { $type: "number", $value: 3 },
        v: { $type: "composite", $value: { holder: new Holder() } },
    });

    Assert.throws(() => library.tokens.v.$value, /has a ref in a Holder/);
});

Throws("a class instance that contains itself is checked", () => {
    class Node {
        readonly self = this;
        readonly level = $.n;
    }
    const library = create({
        n: { $type: "number", $value: 3 },
        v: { $type: "composite", $value: new Node() },
    });

    Assert.throws(() => library.tokens.v.$value, /has a ref in a Node/);
});

Throws("a ref in an object with a prototype throws", () => {
    const value = Object.assign(Object.create({ inherited: 1 }), { n: $.n });
    const library = create({
        n: { $type: "number", $value: 3 },
        v: { $type: "composite", $value: value },
    });

    Assert.throws(
        () => library.tokens.v.$value,
        /has a ref in an object with a prototype, which isn't plain data/,
    );
});

Throws("a getter of a class instance isn't called by the check", () => {
    let reads = 0;
    class Lazy {
        get n() {
            reads++;
            return $.n;
        }
    }
    const instance = new Lazy();

    Assert.is(referring(instance), instance);
    Assert.is(reads, 0);
});

NonPlain.run();
Copy.run();
Throws.run();
