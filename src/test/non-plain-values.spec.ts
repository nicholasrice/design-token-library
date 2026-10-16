/**
 * Values that are not plain data (class instances, `Date`, `Map`, ...) are passed through
 * unchanged, only plain objects and arrays are walked for aliases.
 */
import { suite } from "uvu";
import * as Assert from "uvu/assert";
import { Library } from "../lib/library.js";

const NonPlain = suite("Non-plain values");

class Palette {
    readonly lookup = () => "own function property";

    constructor(readonly swatches: number[]) {}

    first() {
        return this.swatches[0];
    }
}

// Library values with a class or built in type don't type check as custom tokens, so the
// config is untyped here the same way a value cast through `any` would be.
const create = (config: Record<string, unknown>) => Library.create<any>(config);

NonPlain("a class instance returned by an alias is the same instance", () => {
    const instance = new Palette([1, 2, 3]);
    const library = create({ p: { $type: "palette", $value: () => instance } });

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

NonPlain(
    "an own function property of a class instance is not called as an alias",
    () => {
        let calls = 0;
        class Counted {
            readonly count = () => ++calls;
        }
        const instance = new Counted();
        const library = create({
            c: { $type: "counted", $value: () => instance },
        });

        Assert.is(typeof library.tokens.c.$value.count, "function");
        Assert.is(calls, 0);
    },
);

NonPlain("Date, Map and Set values are the same instances", () => {
    const date = new Date(0);
    const map = new Map([[1, 2]]);
    const set = new Set([1]);
    const library = create({
        d: { $type: "date", $value: () => date },
        m: { $type: "map", $value: () => map },
        s: { $type: "set", $value: () => set },
    });

    Assert.is(library.tokens.d.$value, date);
    Assert.is(library.tokens.m.$value, map);
    Assert.is(library.tokens.s.$value, set);
});

NonPlain(
    "a non-plain value inside plain data is kept, and sibling aliases still resolve",
    () => {
        const instance = new Palette([1, 2, 3]);
        const library = create({
            n: { $type: "number", $value: 5 },
            v: {
                $type: "composite",
                $value: {
                    palette: instance,
                    list: [instance, (t: any) => t.n.$value],
                    n: (t: any) => t.n.$value,
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

NonPlain("plain data is still copied and walked for aliases", () => {
    const source = { a: 1, nested: { b: 2 } };
    const library = create({
        v: {
            $type: "composite",
            $value: () => ({ ...source, alias: () => 3 }),
        },
    });

    const value = library.tokens.v.$value;

    Assert.equal(value, { a: 1, nested: { b: 2 }, alias: 3 });
    Assert.is.not(value.nested, source.nested);
});

NonPlain("an object with a null prototype is walked as plain data", () => {
    const plain = Object.create(null);
    plain.alias = () => "resolved";
    const library = create({ v: { $type: "composite", $value: plain } });

    Assert.is(library.tokens.v.$value.alias, "resolved");
});

NonPlain.run();
