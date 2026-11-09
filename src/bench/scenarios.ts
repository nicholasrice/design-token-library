import type { Library } from "../lib/library.js";
import type { Fixture } from "./fixtures.js";
import type { LibraryModule } from "./library-module.js";

export type Counts = Readonly<Record<string, number>>;

/**
 * A scenario timed in milliseconds. `setup()` isn't timed. A `"once"`
 * scenario runs once on each sample's own state, for what only happens once,
 * such as a first read. A `"repeat"` scenario runs many times on one state, for
 * what is too fast to time once.
 */
export interface Timed<S> {
    readonly id: string;
    readonly kind: "once" | "repeat";
    setup(): S;
    run(state: S): unknown;
    /**
     * At most this many samples, and one warm-up, for a scenario whose setup
     * is too slow for the default count.
     */
    readonly maxSamples?: number;
    /**
     * What the scenario did, such as how many tokens a subscriber was told
     * of, read after the last sample. A change of architecture changes these
     * as well as the times.
     */
    counts?(state: S): Counts | Promise<Counts>;
}

/**
 * A scenario that measures something other than time.
 */
export interface Measured {
    readonly id: string;
    readonly kind: "measure";
    readonly unit: "bytes" | "pass";
    readonly samples: number;
    measure(): Promise<number>;
}

export type Scenario = Timed<any> | Measured;

type AnyLibrary = Library.Library<any>;
type AnyToken = Library.Token<any, any>;

const timed = <S>(scenario: Timed<S>): Timed<S> => scenario;

export const gc = (): void => {
    const collect = Reflect.get(globalThis, "gc");
    if (typeof collect !== "function") {
        throw new Error("Run with `node --expose-gc`.");
    }
    collect();
};

/**
 * Resolves after the library's batch, which is queued as a microtask, is
 * delivered.
 */
const nextUpdate = (): Promise<void> =>
    new Promise((resolve) => queueMicrotask(resolve));

const settle = (): Promise<void> =>
    new Promise((resolve) => setTimeout(resolve, 0));

/**
 * Collects what earlier samples left. It waits for a macrotask first: until
 * the microtask queue is empty, V8 keeps the target of every `WeakRef` made
 * since, which the extensions of the library make for each of their tokens,
 * and the finalizers that unlink them don't run.
 */
export const quiesce = async (): Promise<void> => {
    await settle();
    gc();
};

const at = (library: AnyLibrary, path: string): AnyToken =>
    path.split(".").reduce((node, key) => node[key], library.tokens as any);

/**
 * A config for `extend()` with a value at a path.
 */
const configAt = (path: string, token: object): Record<string, unknown> => {
    const config: Record<string, any> = {};
    const keys = path.split(".");
    let node = config;
    for (const key of keys.slice(0, -1)) {
        node = node[key] = {};
    }
    node[keys[keys.length - 1]] = token;
    return config;
};

const recorder = () => ({
    tokens: 0,
    onChange(batch: ReadonlyArray<unknown>) {
        this.tokens += batch.length;
    },
});

/**
 * Keeps what a measurement made alive until it is measured.
 */
let sink: unknown;

const heapUsed = (): number => process.memoryUsage().heapUsed;

/**
 * The heap that `make()` keeps, divided by `count`.
 */
const heapOf = async (make: () => unknown, count: number): Promise<number> => {
    await quiesce();
    const before = heapUsed();
    sink = make();
    gc();
    const after = heapUsed();
    sink = undefined;
    return (after - before) / count;
};

const COMPUTED = Symbol.for("design-token-library.computed");

export const scenariosOf = (
    lib: LibraryModule,
    fixture: Fixture,
): readonly Scenario[] => {
    const { Library, dependentsOf, entriesOf, configuredValueOf } = lib;
    const id = (name: string) => `${fixture.id}/${name}`;
    const create = (): AnyLibrary => Library.create<any>(fixture.config);
    const tokensOf = (library: AnyLibrary): AnyToken[] =>
        [...entriesOf(library, { whatToShow: "token" })].map(
            (entry) => entry.token,
        );
    const readAll = (tokens: readonly AnyToken[]): void => {
        for (const token of tokens) {
            token.$value;
        }
    };
    // The fixtures have only standard types, so they need no converters.
    const toCSS = lib.toCSS as (library: AnyLibrary) => string;
    const color = lib.hex("#123456");

    const E1 = configAt(fixture.root, { $value: lib.hex("#00ff00") });
    const E2 = {
        recipes: [lib.override(fixture.recipe as any, fixture.override)],
    };
    const extendE1 = (source: AnyLibrary) => source.extend(E1 as any);
    const extendE2 = (source: AnyLibrary) => source.extend({}, E2);
    /**
     * The paths of the tokens a set of the token at `path` reaches, itself
     * included.
     */
    const reachedFrom = (library: AnyLibrary, path: string): string[] => {
        const reached = new Set<string>();
        const visit = (token: AnyToken) => {
            if (!reached.has(token.name)) {
                reached.add(token.name);
                dependentsOf(token).forEach(visit);
            }
        };
        visit(at(library, path));
        return [...reached];
    };
    const extendChain = (source: AnyLibrary, length: number) => {
        let library = source;
        for (let i = 0; i < length; i++) {
            library = library.extend({});
        }
        return library;
    };

    /**
     * The tokens that differ in an extension, found as a tool finds them
     * today: walk it, compare each token's configured value with its
     * source's, add the tokens that call a replaced recipe, and close over
     * `dependentsOf()`.
     */
    const delta = (
        source: AnyLibrary,
        extension: AnyLibrary,
        replaced: ReadonlySet<unknown>,
    ): Set<AnyToken> => {
        const calls = (value: unknown, seen = new Set<object>()): boolean => {
            if (
                typeof value !== "object" ||
                value === null ||
                seen.has(value)
            ) {
                return false;
            }
            seen.add(value);
            const computed = Reflect.get(value, COMPUTED);
            if (computed !== undefined) {
                return (
                    replaced.has(computed.recipe) ||
                    computed.args.some((arg: unknown) => calls(arg, seen))
                );
            }
            return Object.values(value).some((child) => calls(child, seen));
        };
        const changed = new Set<AnyToken>();
        const visit = (token: AnyToken) => {
            if (!changed.has(token)) {
                changed.add(token);
                dependentsOf(token).forEach(visit);
            }
        };

        for (const { path, token } of entriesOf(extension, {
            whatToShow: "token",
        })) {
            const value = configuredValueOf(token);
            const original = at(source, path.join("."));
            if (
                original === undefined ||
                value !== configuredValueOf(original) ||
                (replaced.size > 0 && calls(value))
            ) {
                visit(token);
            }
        }

        return changed;
    };

    const base: Scenario[] = [
        timed({
            id: id("create"),
            kind: "once",
            setup: () => null,
            run: create,
        }),
        timed({
            id: id("read.first.one"),
            kind: "once",
            setup: create,
            run: (library) => at(library, fixture.leaf).$value,
        }),
        timed({
            id: id("read.first.all"),
            kind: "once",
            setup: () => tokensOf(create()),
            run: readAll,
        }),
        timed({
            id: id("read.cached.all"),
            kind: "repeat",
            setup: () => {
                const tokens = tokensOf(create());
                readAll(tokens);
                return tokens;
            },
            run: readAll,
        }),
    ];

    // Setting a token that nothing depends on, and one that many do, in a
    // library that hasn't been read and in one that has, with a subscriber.
    for (const target of ["leaf", "root"] as const) {
        for (const read of [false, true]) {
            const setup = () => {
                const library = create();
                if (read) {
                    readAll(tokensOf(library));
                }
                const subscriber = recorder();
                library.subscribe(subscriber);
                return { token: at(library, fixture[target]), subscriber };
            };
            const counts = async (state: ReturnType<typeof setup>) => {
                await nextUpdate();
                return { batch: state.subscriber.tokens };
            };
            const name = `set.${target}.${read ? "read" : "unread"}`;

            base.push(
                timed({
                    id: id(`${name}.sync`),
                    kind: "once",
                    setup,
                    run: ({ token }) => token.set(color),
                    counts,
                }),
                timed({
                    id: id(`${name}.flush`),
                    kind: "once",
                    setup,
                    run: async ({ token }) => {
                        token.set(color);
                        await nextUpdate();
                    },
                    counts,
                }),
            );
        }
    }

    // A set in a library that has read every token, followed by reading every
    // token the set reaches: what a library with no eager evaluation costs a
    // consumer that wants current values.
    for (const target of ["leaf", "root"] as const) {
        const setup = () => {
            const library = create();
            readAll(tokensOf(library));
            const subscriber = recorder();
            library.subscribe(subscriber);
            const reached = reachedFrom(library, fixture[target]).map((path) =>
                at(library, path),
            );
            return { token: at(library, fixture[target]), reached, subscriber };
        };
        base.push(
            timed({
                id: id(`set.${target}.read.reread`),
                kind: "once",
                setup,
                run: async ({ token, reached }) => {
                    token.set(color);
                    await nextUpdate();
                    readAll(reached);
                },
                counts: async (state) => {
                    await nextUpdate();
                    return { batch: state.subscriber.tokens };
                },
            }),
        );
    }

    base.push(
        timed({
            id: id("dependentsOf.first"),
            kind: "once",
            setup: () => at(create(), fixture.root),
            run: (token) => dependentsOf(token),
        }),
        timed({
            id: id("dependentsOf.afterSet"),
            kind: "once",
            setup: () => {
                const library = create();
                const token = at(library, fixture.root);
                dependentsOf(token);
                at(library, fixture.leaf).set(color);
                return token;
            },
            run: (token) => dependentsOf(token),
        }),
        timed({
            id: id("dependentsOf.cached"),
            kind: "repeat",
            setup: () => {
                const token = at(create(), fixture.root);
                dependentsOf(token);
                return token;
            },
            run: (token) => dependentsOf(token),
        }),
        timed({
            id: id("toCSS"),
            kind: "once",
            setup: create,
            run: toCSS,
        }),
        timed({
            id: id("subscribe"),
            kind: "once",
            setup: create,
            run: (library) => library.subscribe(recorder()),
        }),
    );

    const extension: Scenario[] = [
        timed({
            id: id("E0/extend"),
            kind: "once",
            setup: create,
            run: (source) => source.extend({}),
        }),
        timed({
            id: id("E1/extend"),
            kind: "once",
            setup: create,
            run: extendE1,
        }),
        timed({
            id: id("E2/extend"),
            kind: "once",
            setup: create,
            run: extendE2,
        }),
        timed({
            id: id("E3x3/extend"),
            kind: "once",
            setup: create,
            run: (source) => extendChain(source, 3),
        }),
        timed({
            id: id("E3x5/extend"),
            kind: "once",
            setup: create,
            run: (source) => extendChain(source, 5),
        }),
        timed({
            id: id("E4x100/extend"),
            kind: "once",
            setup: create,
            run: (source) => {
                for (let i = 0; i < 100; i++) {
                    source.extend({});
                }
            },
        }),
        timed({
            id: id("E1/read.first.one"),
            kind: "once",
            setup: () => extendE1(create()),
            run: (library) => at(library, fixture.leaf).$value,
        }),
        timed({
            id: id("E1/read.first.all"),
            kind: "once",
            setup: () => tokensOf(extendE1(create())),
            run: readAll,
        }),
        timed({
            id: id("E3x5/read.first.all"),
            kind: "once",
            setup: () => tokensOf(extendChain(create(), 5)),
            run: readAll,
        }),
        timed({
            id: id("E1/read.cached.all"),
            kind: "repeat",
            setup: () => {
                const tokens = tokensOf(extendE1(create()));
                readAll(tokens);
                return tokens;
            },
            run: readAll,
        }),
        timed({
            id: id("E0/subscribe"),
            kind: "once",
            setup: () => create().extend({}),
            run: (library) => library.subscribe(recorder()),
        }),
        timed({
            id: id("E1/subscribe"),
            kind: "once",
            setup: () => extendE1(create()),
            run: (library) => library.subscribe(recorder()),
        }),
    ];

    // Setting a token of an extension, with a subscriber: the leaf, which it
    // inherits until the set, and the root, which E1 gives a value.
    for (const target of ["leaf", "root"] as const) {
        for (const read of [false, true]) {
            const setup = () => {
                const library = extendE1(create());
                if (read) {
                    readAll(tokensOf(library));
                }
                const subscriber = recorder();
                library.subscribe(subscriber);
                return { token: at(library, fixture[target]), subscriber };
            };

            extension.push(
                timed({
                    id: id(
                        `E1/set.${target}.${read ? "read" : "unread"}.flush`,
                    ),
                    kind: "once",
                    setup,
                    run: async ({ token }) => {
                        token.set(color);
                        await nextUpdate();
                    },
                    counts: async (state) => {
                        await nextUpdate();
                        return { batch: state.subscriber.tokens };
                    },
                }),
            );
        }
    }

    // The same in an extension, and a set of the source's leaf, which the
    // extension inherits, while the extension is subscribed and the source
    // isn't.
    for (const target of ["leaf", "root"] as const) {
        const setup = () => {
            const library = extendE1(create());
            readAll(tokensOf(library));
            const subscriber = recorder();
            library.subscribe(subscriber);
            const reached = reachedFrom(library, fixture[target]).map((path) =>
                at(library, path),
            );
            return { token: at(library, fixture[target]), reached, subscriber };
        };
        extension.push(
            timed({
                id: id(`E1/set.${target}.read.reread`),
                kind: "once",
                setup,
                run: async ({ token, reached }) => {
                    token.set(color);
                    await nextUpdate();
                    readAll(reached);
                },
                counts: async (state) => {
                    await nextUpdate();
                    return { batch: state.subscriber.tokens };
                },
            }),
        );
    }
    extension.push(
        timed({
            id: id("E1/set.source.leaf.flush"),
            kind: "once",
            setup: () => {
                const source = create();
                const library = extendE1(source);
                const subscriber = recorder();
                library.subscribe(subscriber);
                return { token: at(source, fixture.leaf), library, subscriber };
            },
            run: async ({ token }) => {
                token.set(color);
                await nextUpdate();
            },
            counts: async (state) => {
                await nextUpdate();
                return { batch: state.subscriber.tokens };
            },
        }),
    );

    // 100 extensions of one library that each give the root a value and are
    // subscribed, as the scopes of an app are: subscribing them, and a set of
    // the source's leaf.
    const subscribedE1x100 = (source: AnyLibrary) => {
        const subscribers = [];
        const extensions = [];
        for (let i = 0; i < 100; i++) {
            const library = extendE1(source);
            const subscriber = recorder();
            library.subscribe(subscriber);
            extensions.push(library);
            subscribers.push(subscriber);
        }
        return { subscribers, extensions };
    };
    extension.push(
        timed({
            id: id("E1x100/subscribe"),
            kind: "once",
            maxSamples: 5,
            setup: create,
            run: subscribedE1x100,
        }),
        timed({
            id: id("E1x100/set.source.leaf.flush"),
            kind: "once",
            maxSamples: 5,
            setup: () => {
                const source = create();
                return { source, ...subscribedE1x100(source) };
            },
            run: async ({ source }) => {
                at(source, fixture.leaf).set(color);
                await nextUpdate();
            },
            counts: ({ subscribers }) => ({
                notified: subscribers.reduce(
                    (total, subscriber) => total + subscriber.tokens,
                    0,
                ),
            }),
        }),
    );

    // A set on a source with 100 extensions that inherit the token: with no
    // subscriber, with one each, and with one each that has read every token
    // the set reaches.
    for (const variant of ["unsubscribed", "subscribed", "read"] as const) {
        const setup = () => {
            const source = create();
            const root = at(source, fixture.root);
            const reached = new Set<string>();
            const visit = (token: AnyToken) => {
                if (!reached.has(token.name)) {
                    reached.add(token.name);
                    dependentsOf(token).forEach(visit);
                }
            };
            visit(root);

            const subscribers = [];
            const extensions = [];
            for (let i = 0; i < 100; i++) {
                const library = source.extend({});
                extensions.push(library);
                if (variant !== "unsubscribed") {
                    const subscriber = recorder();
                    library.subscribe(subscriber);
                    subscribers.push(subscriber);
                }
                if (variant === "read") {
                    for (const path of reached) {
                        at(library, path).$value;
                    }
                }
            }
            return { root, subscribers, extensions };
        };

        extension.push(
            timed({
                id: id(`E4x100/set.root.flush.${variant}`),
                kind: "once",
                maxSamples: 5,
                setup,
                run: async ({ root }) => {
                    root.set(color);
                    await nextUpdate();
                },
                counts: ({ subscribers }) => ({
                    notified: subscribers.reduce(
                        (total, subscriber) => total + subscriber.tokens,
                        0,
                    ),
                }),
            }),
        );
    }

    extension.push(
        timed({
            id: id("E1/dependentsOf.first"),
            kind: "once",
            setup: () => at(extendE1(create()), fixture.root),
            run: (token) => dependentsOf(token),
        }),
        timed({
            id: id("E1/dependentsOf.afterSet"),
            kind: "once",
            setup: () => {
                const library = extendE1(create());
                const token = at(library, fixture.root);
                dependentsOf(token);
                at(library, fixture.leaf).set(color);
                return token;
            },
            run: (token) => dependentsOf(token),
        }),
    );

    const deltaOf = (
        name: string,
        make: (source: AnyLibrary) => AnyLibrary,
        replaced: ReadonlySet<unknown>,
        afterSet: boolean,
    ) => {
        const setup = () => {
            const source = create();
            const library = make(source);
            if (afterSet) {
                delta(source, library, replaced);
                at(library, fixture.leaf).set(color);
            }
            return { source, library, size: 0 };
        };
        return timed({
            id: id(name),
            kind: "once",
            setup,
            run: (state) => {
                state.size = delta(state.source, state.library, replaced).size;
            },
            counts: ({ size }) => ({ delta: size }),
        });
    };

    extension.push(
        deltaOf("E1/delta.cold", extendE1, new Set(), false),
        deltaOf("E1/delta.afterSet", extendE1, new Set(), true),
        deltaOf("E2/delta.cold", extendE2, new Set([fixture.recipe]), false),
        timed({
            id: id("E1/toCSS"),
            kind: "once",
            setup: () => extendE1(create()),
            run: toCSS,
        }),
    );

    const memory: Scenario[] = [
        {
            id: id("heap.perToken"),
            kind: "measure",
            unit: "bytes",
            samples: 5,
            measure: () =>
                heapOf(() => {
                    const library = create();
                    readAll(tokensOf(library));
                    return library;
                }, fixture.tokens),
        },
    ];

    for (const variant of ["unread", "read", "subscribed"] as const) {
        memory.push({
            id: id(`E1/heap.perExtension.${variant}`),
            kind: "measure",
            unit: "bytes",
            samples: 5,
            measure: async () => {
                const source = create();
                return heapOf(() => {
                    const extensions = [];
                    for (let i = 0; i < 10; i++) {
                        const library = extendE1(source);
                        if (variant === "read") {
                            readAll(tokensOf(library));
                        } else if (variant === "subscribed") {
                            library.subscribe(recorder());
                        }
                        extensions.push(library);
                    }
                    return extensions;
                }, 10);
            },
        });
    }

    // 1 when an extension that is no longer referred to is collected.
    for (const [name, make] of [
        ["E0", (source: AnyLibrary) => source.extend({})],
        ["E1", extendE1],
    ] as const) {
        memory.push({
            id: id(`${name}/collected.subscribed`),
            kind: "measure",
            unit: "pass",
            samples: 3,
            measure: async () => {
                const source = create();
                const target = (() => {
                    const library = make(source);
                    library.subscribe(recorder());
                    at(library, fixture.leaf).$value;
                    return new WeakRef(library);
                })();
                for (let i = 0; i < 10 && target.deref() !== undefined; i++) {
                    await settle();
                    gc();
                }
                at(source, fixture.root).set(color);
                return target.deref() === undefined ? 1 : 0;
            },
        });
    }

    return [...base, ...extension, ...memory];
};
