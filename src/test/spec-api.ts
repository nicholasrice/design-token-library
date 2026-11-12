import { Library, ownTokensOf as ownTokensOfLibrary } from "../lib/library.js";

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

/** `library.subscribe(subscriber, { origin })`. */
export const subscribe = (
    library: Library.Library<any>,
    subscriber: Library.Subscriber<any>,
    options?: Library.SubscribeOptions,
): void => library.subscribe(subscriber, options);

/** A `Change` of a batch. */
export type Change = Library.Change<any>;

/** The entries of a batch as `Change`s. */
export const entriesOfBatch = (
    batch: ReadonlyArray<Change>,
): readonly Change[] => batch;

/** The token of an entry of a batch, a token before C and a `Change` after. */
export const tokenOfEntry = (entry: any): any =>
    "token" in entry ? entry.token : entry;

/** The sorted token names of a batch, of either shape. */
export const namesOfBatch = (batch: ReadonlyArray<any>): string[] =>
    batch.map((entry) => tokenOfEntry(entry).name).sort();

/** The first-render query, `ownTokensOf(library)`. */
export const ownTokensOf = (
    library: Library.Library<any>,
): ReadonlyArray<Library.TokenRecord<any>> => ownTokensOfLibrary(library);

/**
 * A subscriber that keeps each batch as it was given, for its entries'
 * fields, and its sorted token names.
 */
export const changeRecorder = () => {
    const batches: ReadonlyArray<Change>[] = [];
    return {
        batches,
        /** The sorted token names of each batch. */
        get names(): string[][] {
            return batches.map(namesOfBatch);
        },
        onChange(batch: ReadonlyArray<Change>) {
            batches.push(batch);
        },
    };
};
