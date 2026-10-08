import { suite } from "uvu";
import * as Assert from "uvu/assert";
import { spy } from "sinon";
import { Library } from "../lib/library.js";
import { DesignToken } from "../lib/design-token.js";

interface ABTheme {
    a: DesignToken.Color;
    b: DesignToken.Color;
}

const Description = suite("DesignToken.$description");
const Lib = suite("DesignToken.Library");
const Extend = suite("DesignToken.Library.Extend");
const Name = suite("DesignToken.name");
const Subscription = suite("DesignToken.subscription");
const Type = suite("DesignToken.$type");
const Value = suite("DesignToken.$value");
const Format = suite("DesignToken.format");
const make = (config: any): any => Library.create(config);

function nextUpdate(): Promise<void> {
    return new Promise((resolve) => {
        queueMicrotask(resolve);
    });
}

Description("should exist in the library when defined on the token", () => {
    const library = Library.create({
        token: {
            $type: DesignToken.Type.Color,
            $value: "#FFFFFF",
            $description: "Hello world",
        },
    });

    Assert.equal(library.tokens.token.$description, "Hello world");
});

Name("should be the object name path delimited by '.' chars", () => {
    const library = Library.create({
        token: {
            $type: DesignToken.Type.Color,
            $value: "#FFFFFF",
        },
        colors: {
            primary: {
                $type: DesignToken.Type.Color,
                $value: "#FFFFFF",
            },
        },
    });

    Assert.equal(library.tokens.token.name, "token");
    Assert.equal(library.tokens.colors.primary.name, "colors.primary");
});

Name("should be case sensitive", () => {
    const library = Library.create({
        tOkEn: {
            $type: DesignToken.Type.Color,
            $value: "#FFFFFF",
        },
    });

    Assert.equal(library.tokens.tOkEn.name, "tOkEn");
});

Type(
    "A token should get it's type assigned when it is defined on the token",
    () => {
        const library = Library.create({
            token: {
                $type: DesignToken.Type.Color,
                $value: "#FFFFFF",
            },
        });

        Assert.equal(library.tokens.token.$type, DesignToken.Type.Color);
    },
);

Type(
    "A token should inherit it's group's type when it does not define a type ",
    () => {
        const library = Library.create({
            $type: DesignToken.Type.Color,
            token: {
                $value: "#FFFFFF",
            },
        });

        Assert.equal(library.tokens.token.$type, DesignToken.Type.Color);
    },
);

Type(
    "A token should override it's group's type when a type is explicitly assigned",
    () => {
        const library = Library.create({
            $type: DesignToken.Type.Border,
            token: {
                $type: DesignToken.Type.Color,
                $value: "#FFFFFF",
            },
        });

        Assert.equal(library.tokens.token.$type, DesignToken.Type.Color);
    },
);

Type(
    "should throw when there is no type declared for a token and it's ancestor groups",
    () => {
        Assert.throws(() => {
            Library.create({ token: { $value: "#FFFFFF " } });
        });
    },
);

Value(
    "should be the value a token was defined with when defined with a static value",
    () => {
        const library = Library.create({
            token: {
                $type: DesignToken.Type.Color,
                $value: "#FFFFFF",
            },
            anotherToken: {
                $type: DesignToken.Type.Border,
                $value: {
                    color: "#FFFFFF",
                    style: "solid",
                    width: "2px",
                },
            },
        });

        Assert.equal(library.tokens.token.$value, "#FFFFFF");
        Assert.equal(library.tokens.anotherToken.$value, {
            color: "#FFFFFF",
            style: "solid",
            width: "2px",
        });
    },
);

Value("should invoke function values with the token library", () => {
    // Arrange
    interface Theme {
        token: DesignToken.Color;
        anotherToken: DesignToken.Color;
    }

    const value = spy((context: Library.Context<Theme>) => context.token);
    const config: Library.Config<Theme> = {
        token: {
            $type: DesignToken.Type.Color,
            $value: "#FF0000",
        },
        anotherToken: {
            $type: DesignToken.Type.Color,
            $value: value,
        },
    };
    const library = Library.create(config);

    // Act
    const anotherTokenValue = library.tokens.anotherToken.$value;

    Assert.equal(value.calledOnce, true);
    Assert.equal(value.firstCall.args[0], library.tokens);
});

Value(
    "should return the value of a referenced token when assigned a token reference",
    () => {
        interface Theme {
            token: DesignToken.Color;
            anotherToken: DesignToken.Color;
        }
        const config: Library.Config<Theme> = {
            token: {
                $type: DesignToken.Type.Color,
                $value: "#FF0000",
            },
            anotherToken: {
                $type: DesignToken.Type.Color,
                $value: (theme: Library.Context<Theme>) => theme.token,
            },
        };
        const library = Library.create(config);

        Assert.equal(
            library.tokens.anotherToken.$value,
            library.tokens.token.$value,
        );
    },
);

Value("reference tokens should support multiple levels of inheritance", () => {
    interface Theme {
        token: DesignToken.Color;
        secondaryToken: DesignToken.Color;
        tertiaryToken: DesignToken.Color;
    }
    const config: Library.Config<Theme> = {
        token: {
            $type: DesignToken.Type.Color,
            $value: "#FF0000",
        },
        secondaryToken: {
            $type: DesignToken.Type.Color,
            $value: (theme) => theme.token,
        },
        tertiaryToken: {
            $type: DesignToken.Type.Color,
            $value: (theme) => theme.secondaryToken,
        },
    };
    const library = Library.create(config);

    Assert.equal(
        library.tokens.tertiaryToken.$value,
        library.tokens.token.$value,
    );
});

Value("should support reading alias values from complex values", () => {
    interface Theme {
        color: DesignToken.Color;
        dimension: DesignToken.Dimension;
        border: DesignToken.Border;
    }

    const config: Library.Config<Theme> = {
        color: {
            $type: DesignToken.Type.Color,
            $value: "#FF0000",
        },
        dimension: {
            $type: DesignToken.Type.Dimension,
            $value: "12px",
        },
        border: {
            $type: DesignToken.Type.Border,
            $value: {
                color: (context) => context.color,
                width: "3px",
                style: {
                    dashArray: [(context) => context.dimension, "14px"],
                    lineCap: "butt",
                },
            },
        },
    };

    const library = Library.create(config);
    const border = library.tokens.border.$value;

    Assert.equal(border.color, "#FF0000", "color alias should be equal");
    Assert.equal(border.width, "3px", "dimension value should be equal");
    Assert.equal(
        border.style,
        { dashArray: ["12px", "14px"], lineCap: "butt" },
        "DeepAlias border style should be equal",
    );
});

Value("should support setting a static value", () => {
    interface Library {
        token: DesignToken.Color;
    }

    const config: Library.Config<Library> = {
        token: {
            $type: DesignToken.Type.Color,
            $value: "#FFFFFF",
        },
    };
    const library = Library.create(config);
    const value: DesignToken.Values.Color = "#000000";
    library.tokens.token.set(value);

    Assert.equal(library.tokens.token.$value, value);
});

Value("should support setting a token alias", () => {
    interface Theme {
        token: DesignToken.Color;
        secondaryToken: DesignToken.Color;
    }

    const config: Library.Config<Theme> = {
        token: {
            $type: DesignToken.Type.Color,
            $value: "#FFFFFF",
        },
        secondaryToken: {
            $type: DesignToken.Type.Color,
            $value: "#000000",
        },
    };

    const library = Library.create(config);
    library.tokens.secondaryToken.set((theme) => theme.token.$value);

    Assert.equal(
        library.tokens.secondaryToken.$value,
        library.tokens.token.$value,
    );
});

Value("should support setting a value alias", () => {
    interface Theme {
        token: DesignToken.Color;
        secondaryToken: DesignToken.Color;
    }

    const config: Library.Config<Theme> = {
        token: {
            $type: DesignToken.Type.Color,
            $value: "#FFFFFF",
        },
        secondaryToken: {
            $type: DesignToken.Type.Color,
            $value: "#000000",
        },
    };

    const library = Library.create(config);
    library.tokens.secondaryToken.set(() => "#FF0000");

    Assert.equal(library.tokens.secondaryToken.$value, "#FF0000");
});

Value(
    "should update the value of a token assigned an alias after the alias value changes",
    () => {
        interface Theme {
            a: DesignToken.Color;
            b: DesignToken.Color;
        }

        const config: Library.Config<Theme> = {
            a: {
                $type: DesignToken.Type.Color,
                $value: "#FFFFFF",
            },
            b: {
                $type: DesignToken.Type.Color,
                $value: (context) => context.a,
            },
        };

        const library = Library.create(config);

        Assert.equal(library.tokens.b.$value, "#FFFFFF");

        library.tokens.a.set("#000000");
        Assert.equal(library.tokens.b.$value, "#000000");
    },
);

Value(
    "should update the value of a token assigned a value alias after the alias value changes",
    () => {
        interface Theme {
            a: DesignToken.Color;
            b: DesignToken.Color;
            c: DesignToken.Border;
        }

        const config: Library.Config<Theme> = {
            a: {
                $type: DesignToken.Type.Color,
                $value: "#FFFFFF",
            },
            b: {
                $type: DesignToken.Type.Color,
                $value: (context) => context.a,
            },
            c: {
                $type: DesignToken.Type.Border,
                $value: {
                    style: "solid",
                    color: (context) => context.b,
                    width: "2px",
                },
            },
        };

        const library = Library.create(config);

        Assert.equal(library.tokens.c.$value.color, "#FFFFFF");

        library.tokens.a.set("#000000");
        Assert.equal(library.tokens.c.$value.color, "#000000");
    },
);

Subscription(
    "should notify a subscriber after a token changes with an array of the changed tokens",
    async () => {
        // Arrange
        const library = Library.create({
            token: { $type: DesignToken.Type.Color, $value: "#FFFFFF" },
        });
        const onChange = spy();
        const subscriber = {
            onChange,
        };
        library.subscribe(subscriber);

        // Act
        library.tokens.token.set("#000000");
        await nextUpdate();

        // Assert
        Assert.is(onChange.called, true);
        const args = onChange.firstCall.args;
        Assert.is(args.length, 1);
        Assert.ok(Array.isArray(args[0]));
        Assert.is(args[0][0], library.tokens.token);
    },
);

Subscription(
    "should notify a subscriber once after multiple tokens are changed in the same task microtask",
    async () => {
        // Arrange
        const library = Library.create({
            a: { $type: DesignToken.Type.Color, $value: "#FFFFFF" },
            b: { $type: DesignToken.Type.Color, $value: "#000000" },
        });
        const onChange = spy();
        const subscriber = {
            onChange,
        };
        library.subscribe(subscriber);

        // Act
        library.tokens.a.set("#000000");
        library.tokens.b.set("#FFFFFF");
        await nextUpdate();

        // Assert
        Assert.is(onChange.calledOnce, true);
        const args = onChange.firstCall.args;
        Assert.is(args.length, 1);
        Assert.ok(Array.isArray(args[0]));
        Assert.is(args[0][0], library.tokens.a);
        Assert.is(args[0][1], library.tokens.b);
    },
);

Subscription(
    "should notify a subscriber twice after multiple tokens are changed in different microtasks",
    async () => {
        // Arrange
        const library = Library.create({
            a: { $type: DesignToken.Type.Color, $value: "#FFFFFF" },
            b: { $type: DesignToken.Type.Color, $value: "#000000" },
        });
        const onChange = spy();
        const subscriber = {
            onChange,
        };
        library.subscribe(subscriber);

        // Act
        library.tokens.a.set("#000000");
        await nextUpdate();

        // Assert
        Assert.is(onChange.calledOnce, true);
        Assert.is(onChange.firstCall.args[0][0], library.tokens.a);

        // Act
        library.tokens.b.set("#FFFFFF");
        await nextUpdate();
        Assert.is(onChange.callCount, 2);
        Assert.is(onChange.secondCall.args[0][0], library.tokens.b);
    },
);

Lib("should be immutable", () => {
    const library = Library.create({
        colors: {
            $type: DesignToken.Type.Color,
            primary: {
                $value: "#FFFFFF",
            },
            secondary: {
                $value: "#000000",
            },
        },
    });

    library.tokens.colors.primary.$description;

    Assert.throws(
        () =>
            // @ts-ignore
            (library.tokens.colors = {}),
        "Assigning a group should throw",
    );
    Assert.throws(
        // @ts-ignore
        () => (library.tokens.colors.$type = DesignToken.Type.Color),
        "Assigning the 'type' field of a group should throw",
    );
    Assert.throws(
        // @ts-ignore
        () => (library.tokens.colors.primary = { $value: "#FFF000" }),
        "Assigning a token field should throw",
    );
    Assert.throws(
        // @ts-ignore
        () => (library.tokens.colors.primary.$value = "#FFF000"),
        "Assigning a token 'value' field  should throw",
    );
    Assert.throws(
        // @ts-ignore
        () => (library.tokens.colors.primary.$type = DesignToken.Type.Border),
        "Assigning a token 'type' field  should throw",
    );
    Assert.throws(
        // @ts-ignore
        () => (library.tokens.colors.primary.$extensions = {}),
        "Assigning a token 'extensions' field  should throw",
    );
    Assert.not.throws(
        () => (library.tokens.colors.primary.$extensions.foo = {}),
        "Assigning a field of a token's extension field should not throw",
    );
});

Extend(
    "An extended library should have the same token metadata as the source library",
    async () => {
        interface Theme {
            a: DesignToken.Color;
            b: DesignToken.Color;
        }

        const config: Library.Config<Theme> = {
            a: {
                $type: DesignToken.Type.Color,
                $value: "#FFFFFF",
                $description: "description",
                $extensions: {
                    e: "e",
                },
            },
            b: {
                $type: DesignToken.Type.Color,
                $value: (context) => context.a,
            },
        };
        const source = Library.create(config);
        const extended = source.extend({});

        Assert.is(extended.tokens.a.$type, DesignToken.Type.Color);
        Assert.is(extended.tokens.a.$description, "description");
        Assert.equal(extended.tokens.a.$extensions, { e: "e" });
    },
);
Extend(
    "An extending library should use the extended library if no config value is set for the extending library",
    () => {
        const config: Library.Config<ABTheme> = {
            a: {
                $type: DesignToken.Type.Color,
                $value: "#FFFFFF",
            },
            b: {
                $type: DesignToken.Type.Color,
                $value: (context) => context.a,
            },
        };
        const source = Library.create(config);
        const extended = source.extend({});

        Assert.is(extended.tokens.a.$value, "#FFFFFF");
        Assert.is(extended.tokens.b.$value, "#FFFFFF");
    },
);
Extend(
    "An extending library should use the extending if a config value is set for the extending library",
    () => {
        const config: Library.Config<ABTheme> = {
            a: {
                $type: DesignToken.Type.Color,
                $value: "#FFFFFF",
            },
            b: {
                $type: DesignToken.Type.Color,
                $value: (context) => context.a,
            },
        };
        const source = Library.create(config);
        const extended = source.extend({
            b: {
                $value: "#000000",
            },
        });

        Assert.is(extended.tokens.b.$value, "#000000");
    },
);

Extend(
    "An extending library should update its value for a token that isn't configured when the source changes",
    async () => {
        interface Theme {
            a: DesignToken.Color;
            b: DesignToken.Color;
        }

        const config: Library.Config<Theme> = {
            a: {
                $type: DesignToken.Type.Color,
                $value: "#FFFFFF",
            },
            b: {
                $type: DesignToken.Type.Color,
                $value: (context) => context.a,
            },
        };
        const source = Library.create(config);
        const extended = source.extend({});

        Assert.is(extended.tokens.a.$value, "#FFFFFF");
        Assert.is(extended.tokens.b.$value, "#FFFFFF");

        source.tokens.a.set("#111111");

        Assert.is(
            extended.tokens.a.$value,
            "#111111",
            "Extended token 'a' is #111111",
        );
        Assert.is(
            extended.tokens.b.$value,
            "#111111",
            "Extended token 'b' is #111111",
        );
    },
);
Extend(
    "An extending library should notify for tokens not configured by the extending library",
    async () => {
        const config: Library.Config<ABTheme> = {
            a: {
                $type: DesignToken.Type.Color,
                $value: "#FFFFFF",
            },
            b: {
                $type: DesignToken.Type.Color,
                $value: (context) => context.a,
            },
        };
        const source = Library.create(config);
        const extending = source.extend({});
        const onChange = spy();
        const subscriber: Library.Subscriber<ABTheme> = {
            onChange,
        };

        extending.subscribe(subscriber);

        extending.tokens.b.$value; // b needs to be accessed to set up watchers
        source.tokens.a.set("#111111");
        await nextUpdate();
        Assert.ok(onChange.calledOnce);
        Assert.is(
            onChange.firstCall.args[0].length,
            2,
            "Called with both a and b tokens",
        );
        Assert.is(
            onChange.firstCall.args[0][0],
            extending.tokens.a,
            "a notified",
        );
        Assert.is(
            onChange.firstCall.args[0][1],
            extending.tokens.b,
            "b notified",
        );
    },
);
Extend(
    "An extending library should not notify for tokens that are configured by the extending library",
    async () => {
        const config: Library.Config<ABTheme> = {
            a: {
                $type: DesignToken.Type.Color,
                $value: "#FFFFFF",
            },
            b: {
                $type: DesignToken.Type.Color,
                $value: (context) => context.a,
            },
        };
        const source = Library.create(config);
        const extending = source.extend({
            a: { $value: "#000000" },
            b: { $value: "#000000" },
        });
        const onChange = spy();
        const subscriber: Library.Subscriber<ABTheme> = {
            onChange,
        };

        extending.subscribe(subscriber);

        extending.tokens.b.$value; // b needs to be accessed to set up watchers
        extending.tokens.a.$value;
        source.tokens.a.set("#111111");

        await nextUpdate();
        Assert.is(onChange.calledOnce, false);
    },
);
Extend("Should allow adding new tokens to an extending library", async () => {
    const config: Library.Config<ABTheme> = {
        a: {
            $type: DesignToken.Type.Color,
            $value: "#FFFFFF",
        },
        b: {
            $type: DesignToken.Type.Color,
            $value: (context) => context.a,
        },
    };
    interface Extending {
        c: DesignToken.Color;
    }
    const source = Library.create(config);
    const extending = source.extend<Extending>({
        a: { $type: DesignToken.Type.Color, $value: "#000000" },
        c: { $type: DesignToken.Type.Color, $value: "#111111" },
    });

    Assert.is(extending.tokens.a.$value, "#000000");
    Assert.is(extending.tokens.c.$value, "#111111");
});

Extend(
    "should extend tokens nested inside groups, inheriting and overriding",
    () => {
        interface Theme {
            group: {
                kept: DesignToken.Color;
                overridden: DesignToken.Color;
            };
        }
        const config: Library.Config<Theme> = {
            group: {
                kept: { $type: DesignToken.Type.Color, $value: "#AAAAAA" },
                overridden: {
                    $type: DesignToken.Type.Color,
                    $value: "#BBBBBB",
                },
            },
        };
        const source = Library.create(config);
        const extended = source.extend({
            group: { overridden: { $value: "#CCCCCC" } },
        } as any);

        Assert.is(
            (extended.tokens.group as any).kept.$value,
            "#AAAAAA",
            "unconfigured nested token inherits from source",
        );
        Assert.is(
            (extended.tokens.group as any).overridden.$value,
            "#CCCCCC",
            "configured nested token is overridden",
        );
        // Source is untouched.
        Assert.is(source.tokens.group.overridden.$value, "#BBBBBB");
    },
);

Format("a string reference resolves to the referenced token's value", () => {
    const library = make({
        $type: "color",
        base: { $value: "#FF0000" },
        alias: { $value: "{base}" },
        chained: { $value: "{alias}" },
    });

    Assert.is(library.tokens.chained.$value, "#FF0000");

    library.tokens.base.set("#00FF00");
    Assert.is(library.tokens.chained.$value, "#00FF00");
});

Format("a reference inside a composite value resolves", () => {
    const library = make({
        color: { $type: "color", $value: "#FF0000" },
        width: { $type: "dimension", $value: "1px" },
        border: {
            $type: "border",
            $value: { color: "{color}", width: "{width}", style: "solid" },
        },
    });

    Assert.equal(library.tokens.border.$value, {
        color: "#FF0000",
        width: "1px",
        style: "solid",
    });
});

Format("a reference to a group is rejected", () => {
    const library = make({
        $type: "color",
        group: { a: { $value: "#FF0000" } },
        alias: { $value: "{group}" },
    });

    Assert.throws(() => library.tokens.alias.$value, /which is a group/);
});

Format("a reference that cannot be resolved names the token", () => {
    const library = make({
        $type: "color",
        alias: { $value: "{missing.token}" },
    });

    Assert.throws(
        () => library.tokens.alias.$value,
        /Token "alias" could not resolve reference "\{missing\.token\}"/,
    );
});

Format("a circular reference throws instead of overflowing the stack", () => {
    const library = make({
        $type: "color",
        a: { $value: "{b}" },
        b: { $value: "{a}" },
    });

    Assert.throws(() => library.tokens.a.$value, /Circular reference/);
});

Format("a value that is an object with a 'value' key is not unwrapped", () => {
    const library = make({
        size: { $type: "number", $value: { value: 1, unit: "px" } },
        alias: { $type: "number", $value: "{size}" },
    });

    Assert.equal(library.tokens.size.$value, { value: 1, unit: "px" });
    Assert.equal(library.tokens.alias.$value, { value: 1, unit: "px" });
});

Format("a group carries its own description, extensions and type", () => {
    const library = make({
        group: {
            $type: "color",
            $description: "Brand colors",
            $extensions: { vendor: 1 },
            $deprecated: "old",
            a: { $value: "#FF0000" },
        },
    });

    Assert.is(library.tokens.group.$description, "Brand colors");
    Assert.equal(library.tokens.group.$extensions, { vendor: 1 });
    Assert.is(library.tokens.group.$deprecated, "old");
    Assert.is(library.tokens.group.$type, "color");
    Assert.equal(Object.keys(library.tokens.group), ["a"]);
});

Format("a token reports whether it is deprecated", () => {
    const library = make({
        $type: "color",
        a: { $value: "#FF0000" },
        b: { $value: "#FF0000", $deprecated: true },
        c: { $value: "#FF0000", $deprecated: "use a" },
    });

    Assert.is(library.tokens.a.$deprecated, false);
    Assert.is(library.tokens.b.$deprecated, true);
    Assert.is(library.tokens.c.$deprecated, "use a");
});

Format("$root is a token in its group", () => {
    const library = make({
        accent: {
            $type: "color",
            $root: { $value: "#0000FF" },
            light: { $value: "#8888FF" },
        },
        alias: { $type: "color", $value: "{accent.$root}" },
    });

    Assert.is(library.tokens.accent.$root.name, "accent.$root");
    Assert.is(library.tokens.alias.$value, "#0000FF");
    Assert.equal(Object.keys(library.tokens.accent), ["$root", "light"]);
});

Format("a token cannot also have children", () => {
    Assert.throws(
        () =>
            make({
                t: { $type: "color", $value: "#FF0000", child: {} },
            }),
        /has a \$value, so it is a token and cannot have a child "child"/,
    );
});

Format("an extension keeps the source group's type for new tokens", () => {
    const source = make({
        group: { $type: "color", a: { $value: "#FF0000" } },
    });
    const extended = source.extend({ group: { b: { $value: "#00FF00" } } });

    Assert.is(extended.tokens.group.b.$type, "color");
    Assert.is(extended.tokens.group.a.$type, "color");
});

Format("an extension can restate a token's description", () => {
    const source = make({
        a: { $type: "color", $value: "#FF0000", $description: "one" },
    });
    const extended = source.extend({
        a: { $value: "#00FF00", $description: "two" },
    });

    Assert.is(extended.tokens.a.$description, "two");
    Assert.is(source.tokens.a.$description, "one");
});

Description.run();
Lib.run();
Extend.run();
Name.run();
Subscription.run();
Type.run();
Value.run();
Format.run();
