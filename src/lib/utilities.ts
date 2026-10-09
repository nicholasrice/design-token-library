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
