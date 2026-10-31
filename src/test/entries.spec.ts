import { suite } from "uvu";
import * as Assert from "uvu/assert";
import { DesignToken } from "../lib/design-token.js";
import * as Package from "../lib/index.js";
import { Library, entriesOf } from "../lib/library.js";
import { Equal, Expect } from "./helpers.js";
import { hex, px } from "./values.js";

const Entries = suite("entriesOf()");
const C = DesignToken.Type.Color;

interface Theme {
    $type: DesignToken.Type.Color;
    brand: {
        $root: DesignToken.Color;
        $extensions: { former: string };
        primary: DesignToken.Color;
        deep: {
            $deprecated: true;
            shade: DesignToken.Color;
        };
    };
    surface: DesignToken.Color;
    spacing: {
        $type: DesignToken.Type.Dimension;
        small: DesignToken.Dimension;
    };
}

const create = () =>
    Library.create<Theme>({
        $type: C,
        brand: {
            $root: { $value: hex("#111111") },
            $extensions: { former: "main" },
            primary: { $value: hex("#336699"), $deprecated: "use brand" },
            deep: {
                $deprecated: true,
                shade: { $value: hex("#000033") },
            },
        },
        surface: { $value: hex("#ffffff") },
        spacing: {
            $type: DesignToken.Type.Dimension,
            small: { $value: px(4) },
        },
    });

const describe = (library: Library.Library<Theme>) =>
    [...entriesOf(library)].map(
        (entry) => `${entry.kind} ${entry.path.join(".")}`,
    );

Entries("is exported", () => {
    Assert.is(Package.entriesOf, entriesOf);
});

Entries("lists the tokens and groups with their paths, groups first", () => {
    Assert.equal(describe(create()), [
        "group brand",
        "token brand.$root",
        "token brand.primary",
        "group brand.deep",
        "token brand.deep.shade",
        "token surface",
        "group spacing",
        "token spacing.small",
    ]);
});

Entries("lists the library's tokens and a group's metadata", () => {
    const library = create();
    const entries = [...entriesOf(library)];

    const primary = entries.find(
        (entry) =>
            entry.kind === "token" && entry.path.join(".") === "brand.primary",
    );
    const brand = entries.find(
        (entry) => entry.kind === "group" && entry.path.length === 1,
    );

    Assert.is(
        primary?.kind === "token" && primary.token,
        library.tokens.brand.primary,
    );
    Assert.is(brand?.kind === "group" && brand.group, library.tokens.brand);
    Assert.equal(brand?.kind === "group" && brand.group.$extensions, {
        former: "main",
    });
});

Entries("a token's path matches its name", () => {
    for (const entry of entriesOf(create(), { whatToShow: "token" })) {
        Assert.is(entry.path.join("."), entry.token.name);
    }
});

Entries(
    "whatToShow lists only tokens, or only groups, and still descends",
    () => {
        const library = create();

        Assert.equal(
            [...entriesOf(library, { whatToShow: "token" })].map(
                (e) => e.token.name,
            ),
            [
                "brand.$root",
                "brand.primary",
                "brand.deep.shade",
                "surface",
                "spacing.small",
            ],
        );
        Assert.equal(
            [...entriesOf(library, { whatToShow: "group" })].map((e) =>
                e.path.join("."),
            ),
            ["brand", "brand.deep", "spacing"],
        );
    },
);

Entries("the entry kinds are typed by whatToShow", () => {
    const library = create();
    const tokens = [...entriesOf(library, { whatToShow: "token" })];
    const groups = [...entriesOf(library, { whatToShow: "group" })];
    const all = [...entriesOf(library)];

    Assert.is(tokens.length + groups.length, all.length);

    type _ = Expect<Equal<(typeof tokens)[number], Library.TokenEntry<Theme>>>;
    type __ = Expect<Equal<(typeof groups)[number], Library.GroupEntry>>;
    type ___ = Expect<
        Equal<
            (typeof all)[number],
            Library.TokenEntry<Theme> | Library.GroupEntry
        >
    >;
});

Entries(
    "a filter that returns false leaves an entry out and still descends",
    () => {
        const entries = [
            ...entriesOf(create(), {
                filter: (entry) => entry.kind === "token",
            }),
        ];

        Assert.is(entries.length, 5);
        Assert.ok(entries.every((entry) => entry.kind === "token"));
    },
);

Entries(
    'a filter that returns "reject" leaves out a group and what is under it',
    () => {
        const library = create();

        const rejected = [
            ...entriesOf(library, {
                filter: (entry) =>
                    entry.kind === "group" && entry.group.$deprecated
                        ? "reject"
                        : true,
            }),
        ].map((entry) => entry.path.join("."));

        Assert.not.ok(rejected.includes("brand.deep"));
        Assert.not.ok(rejected.includes("brand.deep.shade"));
        Assert.ok(rejected.includes("brand"));
        Assert.ok(rejected.includes("surface"));
    },
);

Entries("a filter is not called for the kinds that are not shown", () => {
    const seen = new Set<string>();

    [
        ...entriesOf(create(), {
            whatToShow: "token",
            filter: (entry) => {
                seen.add(entry.kind);
                return true;
            },
        }),
    ];

    Assert.equal([...seen], ["token"]);
});

Entries("a filter can read a token's deprecation", () => {
    const names = [
        ...entriesOf(create(), {
            whatToShow: "token",
            filter: ({ token }) => !token.$deprecated,
        }),
    ].map(({ token }) => token.name);

    Assert.not.ok(names.includes("brand.primary"));
    Assert.ok(names.includes("surface"));
});

Entries("the entries are lazy", () => {
    const iterator = entriesOf(create());

    Assert.is(iterator.next().value?.path.join("."), "brand");
});

Entries("walks an extended library with its new tokens", () => {
    const extended = create().extend<{ extra: DesignToken.Color }>({
        extra: { $type: C, $value: hex("#abcdef") },
    });

    Assert.equal(describe(extended as Library.Library<Theme>).slice(-1), [
        "token extra",
    ]);
    Assert.is(
        [...entriesOf(extended)].filter((entry) => entry.kind === "group")
            .length,
        3,
    );
});

Entries("an empty library has no entries", () => {
    Assert.equal([...entriesOf(Library.create<{}>({}))], []);
});

Entries.run();
