import type { DesignToken } from "../lib/design-token.js";
import type { Library } from "../lib/library.js";
import type { LibraryModule } from "./library-module.js";

type Color = DesignToken.Values.Readonly.Color;

/**
 * A library shape that a scenario runs on, with the paths it sets and reads.
 */
export interface Fixture {
    readonly id: string;
    readonly description: string;
    readonly tokens: number;
    /**
     * A token that many tokens depend on, through refs and recipes.
     */
    readonly root: string;
    /**
     * A token that nothing depends on, at the end of the longest chain.
     */
    readonly leaf: string;
    readonly config: Record<string, unknown>;
    /**
     * The recipe that the fixture's computed values call, which an extension
     * overrides.
     */
    readonly recipe: Library.Recipe<any, unknown>;
    readonly override: (...args: any[]) => unknown;
}

const mix = (a: Color, b: Color, weight: number): Color => ({
    colorSpace: "srgb",
    components: a.components.map(
        (component, i) =>
            (component as number) * (1 - weight) +
            (b.components[i] as number) * weight,
    ) as [number, number, number],
});

const mixMore = (a: Color, b: Color, weight: number): Color =>
    mix(a, b, Math.min(1, weight * 2));

const gray = (lib: LibraryModule, i: number) =>
    lib.hex("#" + (i % 256).toString(16).padStart(2, "0").repeat(3));

/**
 * `roots` colors, then `depth` groups of `width` tokens. Each token reads two
 * tokens of the group below it: an even one through a recipe, an odd one
 * through a ref.
 */
const layered = (
    lib: LibraryModule,
    id: string,
    roots: number,
    depth: number,
    width: number,
): Fixture => {
    const { mix: recipe } = lib.recipes({ mix });
    const config: Record<string, any> = { $type: "color", root: {} };
    for (let i = 0; i < roots; i++) {
        config.root[`r${i}`] = { $value: gray(lib, i) };
    }

    let below = Array.from({ length: roots }, (_, i) => `root.r${i}`);
    for (let d = 0; d < depth; d++) {
        const group: Record<string, unknown> = {};
        const here: string[] = [];
        for (let i = 0; i < width; i++) {
            const a = lib.ref<any>(below[i % below.length] as never);
            const b = lib.ref<any>(below[(i * 7 + 3) % below.length] as never);
            group[`t${i}`] = { $value: i % 2 === 0 ? recipe(a, b, 0.5) : a };
            here.push(`l${d}.t${i}`);
        }
        config[`l${d}`] = group;
        below = here;
    }

    return {
        id,
        description: `${roots} roots, ${depth} layers of ${width}, half recipes`,
        tokens: roots + depth * width,
        root: "root.r0",
        leaf: below[0],
        config,
        recipe,
        override: mixMore,
    };
};

/**
 * One color that every other token reads, half through a recipe.
 */
const hub = (lib: LibraryModule, id: string, fanOut: number): Fixture => {
    const { mix: recipe } = lib.recipes({ mix });
    const hubRef = lib.ref<any>("hub" as never);
    const fan: Record<string, unknown> = {};
    for (let i = 0; i < fanOut; i++) {
        fan[`t${i}`] = {
            $value: i % 2 === 0 ? recipe(hubRef, gray(lib, i), 0.5) : hubRef,
        };
    }

    return {
        id,
        description: `1 token read by ${fanOut}, half recipes`,
        tokens: fanOut + 1,
        root: "hub",
        leaf: `fan.t${fanOut - 1}`,
        config: {
            $type: "color",
            hub: { $value: lib.hex("#808080") },
            fan,
        },
        recipe,
        override: mixMore,
    };
};

/**
 * A chain of refs, each token reading the one before it.
 */
const chain = (lib: LibraryModule, id: string, length: number): Fixture => {
    const { mix: recipe } = lib.recipes({ mix });
    const links: Record<string, unknown> = {
        c0: { $value: lib.hex("#808080") },
    };
    for (let i = 1; i < length; i++) {
        links[`c${i}`] = { $value: lib.ref<any>(`chain.c${i - 1}` as never) };
    }

    return {
        id,
        description: `a chain of ${length} refs`,
        tokens: length,
        root: "chain.c0",
        leaf: `chain.c${length - 1}`,
        config: { $type: "color", chain: links },
        recipe,
        override: mixMore,
    };
};

export const fixturesOf = (lib: LibraryModule): readonly Fixture[] => [
    layered(lib, "F1", 100, 10, 300),
    layered(lib, "F2", 200, 20, 400),
    hub(lib, "F3", 2000),
    chain(lib, "F4", 250),
];
