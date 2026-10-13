export const empty = Symbol();

/**
 * Tests whether a value is a token: it has a `$value`. This is the same rule for
 * a token in config and for a token in a library's token tree. It cannot mistake
 * a value for a token because a name cannot begin with `$` (except `$root`).
 *
 * @internal
 */
export const isToken = <T>(value: T): value is T & { $value: any } => {
    return typeof value === "object" && value !== null && "$value" in value;
};

/**
 * Copies plain objects and arrays at any depth. Other values, such as
 * functions and class instances, are kept by reference.
 *
 * @internal
 */
export const copyPlain = <T>(value: T): T => {
    if (Array.isArray(value)) {
        return value.map(copyPlain) as T;
    }

    if (typeof value === "object" && value !== null) {
        const prototype = Object.getPrototypeOf(value);
        if (prototype === Object.prototype || prototype === null) {
            const copy: Record<string, unknown> = Object.create(prototype);
            for (const key of Object.keys(value)) {
                copy[key] = copyPlain((value as any)[key]);
            }

            return copy as T;
        }
    }

    return value;
};
