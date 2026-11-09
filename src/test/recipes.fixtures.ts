import { spy } from "sinon";
import { recipes } from "../lib/recipe.js";
import type { DesignToken } from "../lib/design-token.js";
import { ref } from "../lib/ref.js";
import { px } from "./values.js";

/**
 * Recipes for the equality, evaluation and origin specs. Each is pure, and the counting ones count their
 * calls, so that "resolved" and "not resolved" are counted, never inferred.
 */

/** A ref to any path, for untyped libraries. */
export const at = (path: string): any => ref<any, any>(path);

/**
 * A recipe `id(label, value)` that returns its value. `calls(label)` is how
 * many times it ran for the token labelled `label`.
 */
export const counter = () => {
    const fn = spy((label: string, value: unknown) => value);
    const { id } = recipes({ id: fn });
    return {
        id: (label: string, value: unknown): any => id(label, value),
        calls: (label: string): number =>
            fn.getCalls().filter((call) => call.args[0] === label).length,
        reset: (): void => fn.resetHistory(),
    };
};

/**
 * Recipes that clamp to 10, so that a change of their argument above 10
 * re-resolves to an equal value.
 */
export const Clamp = recipes({
    num: (n: number): number => Math.min(n, 10),
    px: (n: number) => px(Math.min(n, 10)),
});

type Dimension = DesignToken.Values.Readonly.Dimension;

/** Recipes of dimensions, which an extension may override. */
export const Shade = recipes({
    darken: (d: Dimension) => px(d.value - 1),
    mix: (a: Dimension, b: Dimension) => px(a.value + b.value),
});

/** A recipe whose result is a ref: to `a` when its argument is positive. */
export const Pick = recipes({
    pick: (n: number): any => (n > 0 ? at("a") : at("b")),
});

/** A ref chain of `length` tokens: `t0` a number, each next a ref to it. */
export const chain = (length: number): Record<string, unknown> => {
    const config: Record<string, unknown> = {
        t0: { $type: "number", $value: 0 },
    };
    for (let i = 1; i < length; i++) {
        config[`t${i}`] = { $type: "number", $value: at(`t${i - 1}`) };
    }
    return config;
};
