/**
 * Values that are not plain data (class instances, `Date`, `Map`, ...) are passed through
 * unchanged, only plain objects and arrays are walked for refs and computed values.
 */
import { suite } from "uvu";
import * as Assert from "uvu/assert";
import { DesignToken } from "../lib/design-token.js";
import { Library } from "../lib/library.js";
import { recipes } from "../lib/recipe.js";
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

const $ = refs<{ n: DesignToken.Number }>();

/**
 * A computed value whose recipe returns `value`.
 */
const returning = (value: unknown) => recipes({ value: () => value }).value();

NonPlain("a class instance returned by a recipe is the same instance", () => {
    const instance = new Palette([1, 2, 3]);
    const library = create({
        p: { $type: "palette", $value: returning(instance) },
    });

    const value = library.tokens.p.$value;

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
    const library = create({
        c: { $type: "counted", $value: returning(instance) },
    });

    Assert.is(typeof library.tokens.c.$value.count, "function");
    Assert.is(calls, 0);
});

NonPlain("Date, Map and Set values are the same instances", () => {
    const date = new Date(0);
    const map = new Map([[1, 2]]);
    const set = new Set([1]);
    const library = create({
        d: { $type: "date", $value: returning(date) },
        m: { $type: "map", $value: returning(map) },
        s: { $type: "set", $value: returning(set) },
    });

    Assert.is(library.tokens.d.$value, date);
    Assert.is(library.tokens.m.$value, map);
    Assert.is(library.tokens.s.$value, set);
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

NonPlain.run();
