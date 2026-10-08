import { DesignToken } from "../lib/design-token.js";
import { Library } from "../lib/library.js";

/**
 * Resolves after microtasks queued before this call have run,
 * which flushes any pending library change batch.
 */
export function nextUpdate(): Promise<void> {
    return new Promise((resolve) => {
        queueMicrotask(resolve);
    });
}

/**
 * Library shapes shared across specs.
 */
export interface A {
    a: DesignToken.Color;
}

export interface AB {
    a: DesignToken.Color;
    b: DesignToken.Color;
}

export interface ABC {
    a: DesignToken.Color;
    b: DesignToken.Color;
    c: DesignToken.Color;
}

/**
 * A source library where `b` aliases `a`.
 */
export function aliasedPair() {
    return Library.create<AB>({
        a: { type: DesignToken.Type.Color, value: "#111111" },
        b: { type: DesignToken.Type.Color, value: (context) => context.a },
    });
}

/**
 * Resolves after a macrotask, so all pending microtasks
 * (including asynchronously reported errors) have run.
 */
export function settle(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Captures errors reported as uncaught exceptions instead of letting
 * them terminate the test process. Call `restore` when done.
 */
export function captureUncaughtErrors() {
    const process = Reflect.get(globalThis, "process");
    const errors: unknown[] = [];
    const listener = (error: unknown) => errors.push(error);
    process.on("uncaughtException", listener);

    return {
        errors,
        restore() {
            process.off("uncaughtException", listener);
        },
    };
}

/**
 * A subscriber that records the token names of each change batch.
 */
export function recorder() {
    const batches: string[][] = [];
    return {
        batches,
        onChange(records: ReadonlyArray<{ name: string }>) {
            batches.push(records.map((record) => record.name));
        },
    };
}
