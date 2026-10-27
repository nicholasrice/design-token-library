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
 * with {@link refs}. Config to share between libraries is typed by the
 * shapes it needs, as in `Library.Config<Outline, Colors & Sizes>`, not by a
 * type parameter for the library, whose paths can't be checked.
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
 * @remarks
 * A ref is checked against the tokens of the library it's used in, so the
 * refs of a shape also work in a library that extends it, and the refs of
 * several shapes in one that has them all. Config to share between libraries
 * is typed by the shapes it needs, as in
 * `Library.Config<Outline, Colors & Sizes>`. The refs of a type parameter
 * for the library, `refs<Root>()`, can't be read, because TypeScript doesn't
 * resolve their types through its constraint.
 *
 * @example
 * ```ts
 * const theme = refs<Theme>();
 * const library = Library.create<Theme>({
 *     colors: {
 *         $type: DesignToken.Type.Color,
 *         primary: { $value: hex("#0000ff") },
 *         link: { $value: theme.colors.primary },
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
