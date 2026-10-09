import { suite } from "uvu";
import * as Assert from "uvu/assert";
import { DesignToken } from "../lib/design-token.js";
import { Library } from "../lib/library.js";
import { toCSS, toProperties } from "../lib/css-reflector.js";

const Props = suite("$-prefixed properties");
const C = DesignToken.Type.Color;

Props("a token is told apart from a group by its $value", () => {
    interface Theme {
        g: { $type: DesignToken.Type.Color; a: DesignToken.Color };
    }
    const library = Library.create<Theme>({
        g: { $type: C, a: { $value: "#111111" } },
    });

    Assert.is(library.tokens.g.a.$value, "#111111");
    Assert.is(library.tokens.g.a.name, "g.a");
});

Props("a token cannot have children", () => {
    Assert.throws(
        () =>
            Library.create<any>({
                a: { $type: C, $value: "#111111", b: { $value: "#222222" } },
            }),
        /"a" has a \$value, so it is a token and cannot have a child "b"/,
    );
});

Props("group metadata is not enumerable and is readable from the group", () => {
    interface Theme {
        g: {
            $type: DesignToken.Type.Color;
            $description?: string;
            $extensions?: Record<string, any>;
            $deprecated?: boolean | string;
            a: DesignToken.Color;
        };
    }
    const library = Library.create<Theme>({
        g: {
            $type: C,
            $description: "group",
            $extensions: { k: 1 },
            $deprecated: "old",
            a: { $value: "#111111" },
        },
    });

    Assert.equal(Object.keys(library.tokens.g), ["a"]);
    Assert.is(library.tokens.g.$description, "group");
    Assert.equal(library.tokens.g.$extensions, { k: 1 });
    Assert.is(library.tokens.g.$deprecated, "old");
});

Props("a group $type applies regardless of key order", () => {
    interface Theme {
        g: { a: DesignToken.Color; $type: DesignToken.Type.Color };
    }
    const library = Library.create<Theme>({
        g: { a: { $value: "#111111" }, $type: C },
    });

    Assert.is(library.tokens.g.a.$type, C);
});

Props("group metadata survives extend()", () => {
    interface Theme {
        g: {
            $type: DesignToken.Type.Color;
            $description?: string;
            a: DesignToken.Color;
        };
    }
    const source = Library.create<Theme>({
        g: { $type: C, $description: "group", a: { $value: "#111111" } },
    });
    const extended = source.extend({ g: { a: { $value: "#222222" } } });

    Assert.is(extended.tokens.g.$type, C);
    Assert.is(extended.tokens.g.$description, "group");
    Assert.is(extended.tokens.g.a.$type, C);
    Assert.equal(Object.keys(extended.tokens.g), ["a"]);
});

Props("$root is a token in its group", () => {
    interface Theme {
        color: {
            $type: DesignToken.Type.Color;
            $root: DesignToken.Color;
            light: DesignToken.Color;
        };
    }
    const library = Library.create<Theme>({
        color: {
            $type: C,
            $root: { $value: "#111111" },
            light: { $value: "#EEEEEE" },
        },
    });

    Assert.is(library.tokens.color.$root.$value, "#111111");
    Assert.is(library.tokens.color.$root.name, "color.$root");
    Assert.equal(Object.keys(library.tokens.color), ["$root", "light"]);
});

Props("a token exposes $deprecated, false by default", () => {
    interface Theme {
        a: DesignToken.Color;
        b: DesignToken.Color;
        c: DesignToken.Color;
    }
    const library = Library.create<Theme>({
        a: { $type: C, $value: "#111111" },
        b: { $type: C, $value: "#111111", $deprecated: true },
        c: { $type: C, $value: "#111111", $deprecated: "use a" },
    });

    Assert.is(library.tokens.a.$deprecated, false);
    Assert.is(library.tokens.b.$deprecated, true);
    Assert.is(library.tokens.c.$deprecated, "use a");
});

Props("an extension can restate a token's metadata", () => {
    interface Theme {
        a: DesignToken.Color;
    }
    const source = Library.create<Theme>({
        a: { $type: C, $value: "#111111", $description: "source" },
    });
    const extended = source.extend({
        a: {
            $value: "#222222",
            $description: "extended",
            $deprecated: true,
        },
    });

    Assert.is(extended.tokens.a.$description, "extended");
    Assert.is(extended.tokens.a.$deprecated, true);
    Assert.is(source.tokens.a.$description, "source");
    Assert.is(source.tokens.a.$deprecated, false);
});

Props("a circular reference throws instead of overflowing the stack", () => {
    interface Theme {
        a: DesignToken.Color;
        b: DesignToken.Color;
    }
    const library = Library.create<Theme>({
        a: { $type: C, $value: (context) => context.b },
        b: { $type: C, $value: (context) => context.a },
    });

    Assert.throws(() => library.tokens.a.$value, /Circular reference/);
    // The token can recover once the cycle is broken.
    library.tokens.b.set("#111111");
    Assert.is(library.tokens.a.$value, "#111111");
});

Props("toCSS emits the $-prefixed token values", () => {
    interface Theme {
        g: { $type: DesignToken.Type.Color; a: DesignToken.Color };
    }
    const library = Library.create<Theme>({
        g: { $type: C, a: { $value: "#111111" } },
    });

    Assert.is(toCSS(library), "--g-a:#111111;");
});

Props("toCSS names a $root token for its group", () => {
    interface Theme {
        color: {
            $type: DesignToken.Type.Color;
            $root: DesignToken.Color;
            light: DesignToken.Color;
        };
    }
    const library = Library.create<Theme>({
        color: {
            $type: C,
            $root: { $value: "#111111" },
            light: { $value: "#EEEEEE" },
        },
    });

    Assert.is(toCSS(library), "--color:#111111;--color-light:#EEEEEE;");
    Assert.is(toProperties(library).color.$root.property, "--color");
});

Props.run();
