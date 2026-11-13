import * as Package from "../lib/index.js";
import { Library } from "../lib/library.js";

/**
 * The API the equality, evaluation and origin specs need, before it exists.
 * Tests reach it only through this module, typed loosely, and each
 * implementation PR tightens what it ships.
 */

/** `Library.create(config, { types })`, for an untyped config. */
export const create = (config: any, options?: Library.CreateOptions): any =>
    Library.create<any>(config, options);

/** `library.extend(config, { recipes, types })`, for an untyped config. */
export const extend = (
    library: Library.Library<any>,
    config: any,
    options?: Library.ExtendOptions,
): any => library.extend(config, options);

/** `library.subscribe(subscriber, { inherited })`: C. */
export const subscribe = (
    library: any,
    subscriber: { onChange(batch: ReadonlyArray<any>): void },
    options?: { readonly inherited?: boolean },
): void => library.subscribe(subscriber, options);

/** A `Change` of a batch: C. */
export interface Change {
    readonly token: any;
    readonly valueChanged: boolean;
    readonly origin: "ancestor" | "own";
    readonly originChanged: boolean;
}

/** The entries of a batch as `Change`s: C. */
export const entriesOfBatch = (batch: ReadonlyArray<any>): readonly Change[] =>
    batch;

/** The token of an entry of a batch, a token before C and a `Change` after. */
export const tokenOfEntry = (entry: any): any =>
    "token" in entry ? entry.token : entry;

/** The sorted token names of a batch, of either shape. */
export const namesOfBatch = (batch: ReadonlyArray<any>): string[] =>
    batch.map((entry) => tokenOfEntry(entry).name).sort();

/** The first-render query, `ownTokensOf(library)`: C. */
export const ownTokensOf = (library: any): ReadonlyArray<any> =>
    Reflect.get(Package, "ownTokensOf")(library);

/**
 * A subscriber that keeps each batch as it was given, for its entries'
 * fields, and its sorted token names.
 */
export const changeRecorder = () => {
    const batches: ReadonlyArray<any>[] = [];
    return {
        batches,
        /** The sorted token names of each batch. */
        get names(): string[][] {
            return batches.map(namesOfBatch);
        },
        onChange(batch: ReadonlyArray<any>) {
            batches.push(batch);
        },
    };
};
