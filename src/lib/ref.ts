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
 * Tests whether a value is a {@link (Library:namespace).Ref}, made by
 * {@link ref} or {@link refs}, also by another copy of this package.
 *
 * @remarks
 * The library resolves a ref anywhere in a value. An add-on that keeps a
 * ref, rather than its token's value, tells it from other values with
 * `isRef()`, and reads its path with {@link pathOf}.
 *
 * A ref is a `Ref<unknown, never>` whatever its token and library, so a
 * value typed as a ref of a library is narrowed to that ref.
 *
 * @example
 * ```ts
 * isRef(ref("colors.primary")); // true
 * isRef(hex("#0000ff")); // false
 * ```
 *
 * @public
 */
export const isRef = (value: unknown): value is Library.Ref<unknown, never> => {
    return (
        typeof value === "object" && value !== null && Object.hasOwn(value, REF)
    );
};

/**
 * The path of a {@link (Library:namespace).Ref}'s token, the name of each
 * group and of the token: `["colors", "primary"]` for
 * `ref("colors.primary")`.
 *
 * @remarks
 * The library resolves a ref anywhere in a value to its token's value. An
 * add-on that needs the token itself, such as one that writes a CSS custom
 * property for it, keeps the path instead, and finds the token in the
 * library when it needs the value.
 *
 * @example
 * ```ts
 * // An operand of an expression keeps its token's path, so that it's
 * // written as a `var()` and isn't resolved to the token's value.
 * const operand = <T>(arg: number | Library.Ref<number, T>) =>
 *     isRef(arg) ? { token: pathOf(arg).join(".") } : arg;
 * ```
 *
 * @public
 */
export const pathOf = (ref: Library.Ref<unknown, never>): readonly string[] =>
    ref[REF];
