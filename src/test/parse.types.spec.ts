/**
 * Type-level tests for parse(). These are enforced by `tsc -b`: a failing
 * `Expect`, or a valid call that errors, fails the build.
 */
import { suite } from "uvu";
import * as Assert from "uvu/assert";
import { Library } from "../lib/library.js";
import { parse } from "../lib/parse.js";
import { Base, createBase } from "./parse.fixtures.js";
import { Equal, Expect } from "./helpers.js";

const Types = suite("parse types");

Types("a document is untyped, unless it extends a library", () => {
    const base = createBase();
    const config = parse("{}");
    const extension = parse("{}", { extends: base });

    type Untyped = Expect<Equal<typeof config, Library.Config<any>>>;
    type Extension = Expect<
        Equal<typeof extension, Library.ExtendConfig<Base, Base>>
    >;

    Assert.ok(Library.create(config));
});

Types("a document that extends a library is a config of extend()", () => {
    const base = createBase();
    const extended: Library.Library<Base> = base.extend(
        parse(
            '{ "colors": { "primary": { "$value": { "colorSpace": "srgb", "components": [0, 0, 0] } } } }',
            { extends: base },
        ),
    );

    Assert.equal(extended.tokens.colors.primary.$value.components, [0, 0, 0]);
});

Types.run();
