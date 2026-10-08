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
 * Creates a library without static config typing. Used by tests that
 * exercise runtime behavior rather than the public type surface.
 */
export function createUntyped(config: any): any {
    return Library.create(config);
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
