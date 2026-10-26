import type { Library } from "./library.js";

/**
 * The key of a ref's path. A registered symbol, so that a ref made by another
 * copy of this package is still a ref.
 *
 * @internal
 */
export const REF: unique symbol = Symbol.for("design-token-library.ref");

/**
 * Makes a {@link (Library:namespace).Ref} to the token at a dotted path. Its
 * type comes from where it's used: the library must have a token at the path
 * whose value has the type expected there.
 *
 * @remarks
 * Where the shape of the library is inferred, as in `Library.create({ ... })`
 * without a type argument, or for a new token in `extend()`, the path can't
 * be checked, so the shape is given as a type argument, or the ref is made
 * with {@link refs}.
 *
 * @example
 * ```ts
 * link: { $type: DesignToken.Type.Color, $value: ref("colors.primary") }
 * ```
 *
 * @public
 */
export const ref = <V, T extends {} = {}>(
    path: NoInfer<Library.TokenPath<T, V>>,
): Library.Ref<V, T> =>
    Object.freeze({ [REF]: Object.freeze(path.split(".")) });

/**
 * Makes a {@link (Library:namespace).Ref} to each token of a library of shape
 * `T`, at the token's path: `refs<Theme>().colors.primary` is the same ref as
 * `ref("colors.primary")`. It needs no library, so the refs are made once,
 * before the library's config, and serve every library of the shape.
 *
 * @example
 * ```ts
 * const $ = refs<Theme>();
 * const library = Library.create<Theme>({
 *     colors: {
 *         $type: DesignToken.Type.Color,
 *         primary: { $value: hex("#0000ff") },
 *         link: { $value: $.colors.primary },
 *     },
 * });
 * ```
 *
 * @public
 */
export const refs = <T extends {}>(): Library.Refs<T> =>
    // A proxy makes the ref for any path, which a type can't describe: the
    // type of the path is `Refs<T>`.
    refAt([]) as unknown as Library.Refs<T>;

const refAt = (path: readonly string[]): object => {
    const ref = Object.freeze({ [REF]: Object.freeze(path) });
    // So that a path is always the same ref.
    const children = new Map<string, object>();

    return new Proxy(ref, {
        get(target, key) {
            if (typeof key !== "string") {
                return Reflect.get(target, key);
            }

            let child = children.get(key);
            if (child === undefined) {
                child = refAt([...path, key]);
                children.set(key, child);
            }

            return child;
        },
    });
};

/**
 * Tests whether a value is a {@link (Library:namespace).Ref}.
 *
 * @internal
 */
export const isRef = (value: unknown): value is Library.Ref<unknown, {}> => {
    return (
        typeof value === "object" && value !== null && Object.hasOwn(value, REF)
    );
};
