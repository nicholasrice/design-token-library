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

/**
 * Type-level assertion helpers. `Expect<T>` fails to compile unless `T` is `true`.
 */
export type Expect<T extends true> = T;

/**
 * `true` if `A` and `B` are identical types, including `any` and `readonly` modifiers.
 */
export type Equal<A, B> =
    (<X>() => X extends A ? 1 : 2) extends <X>() => X extends B ? 1 : 2
        ? true
        : false;

export type IsAny<T> = 0 extends 1 & T ? true : false;

export type IsUnknown<T> = unknown extends T
    ? IsAny<T> extends true
        ? false
        : true
    : false;

/**
 * `true` if `T` is neither `any` nor `unknown`.
 */
export type IsKnown<T> =
    IsAny<T> extends true ? false : IsUnknown<T> extends true ? false : true;
