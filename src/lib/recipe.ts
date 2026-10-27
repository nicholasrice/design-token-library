import type { Library } from "./library.js";

/**
 * The key of a computed value's recipe and arguments.
 *
 * @internal
 */
export const COMPUTED: unique symbol = Symbol.for(
    "design-token-library.computed",
);

/**
 * The key of a recipe's name and function.
 *
 * @internal
 */
export const RECIPE: unique symbol = Symbol.for("design-token-library.recipe");

/**
 * Makes the {@link (Library:namespace).Recipe} of each function of
 * `functions`, named by its key. A recipe takes its function's arguments, any
 * of which may be refs, computed values, or values with them in it, and
 * returns the
 * {@link (Library:namespace).Computed} result. The function is called when
 * the token is read, with the values of the refs, and again when one of the
 * tokens it read changes.
 *
 * @remarks
 * Arguments are evaluated when a function is called, before the library
 * exists, so a function can't be given refs itself: its recipe defers it.
 * The function must be pure, because it's called only when the token's value
 * is resolved again. Its arguments are frozen, as token values are, so its
 * parameters are typed readonly, as in `DesignToken.Values.Readonly.Color`:
 * mutating one throws. A generic function's recipe takes the arguments of its
 * constraint. Recipes are extended by spreading them into a new object.
 *
 * @example
 * ```ts
 * // darkenColor(color: DesignToken.Values.Readonly.Color, amount: number)
 * export const Recipes = recipes({ darken: darkenColor, lighten: lightenColor });
 * export const MyRecipes = { ...Recipes, ...recipes({ tint: tintColor }) };
 *
 * hover: { $type: DesignToken.Type.Color, $value: Recipes.darken(ref("colors.primary"), 0.2) }
 * ```
 *
 * @public
 */
export const recipes = <F extends Record<string, (...args: any[]) => unknown>>(
    functions: F,
): Library.Recipes<F> => {
    const made: Record<string, unknown> = {};
    for (const name of Object.keys(functions)) {
        made[name] = recipeOf(name, functions[name]);
    }

    // An object built by key has the keys' types: those of `Recipes<F>`.
    return Object.freeze(made) as Library.Recipes<F>;
};

const recipeOf = <A extends unknown[], V>(
    name: string,
    fn: (...args: A) => V,
): Library.Recipe<A, V> => {
    const recipe: Library.Recipe<A, V> = Object.assign(
        <T extends {}>(
            ...args: Library.RecipeArguments<A, T>
        ): Library.Computed<V, T> =>
            Object.freeze({
                [COMPUTED]: Object.freeze({
                    recipe,
                    args: Object.freeze(args),
                }),
            }),
        { [RECIPE]: Object.freeze({ name, fn }) },
    );

    return Object.freeze(recipe);
};

/**
 * Tests whether a value is a {@link (Library:namespace).Computed} value.
 *
 * @internal
 */
export const isComputed = (
    value: unknown,
): value is Library.Computed<unknown, {}> => {
    return (
        typeof value === "object" &&
        value !== null &&
        Object.hasOwn(value, COMPUTED)
    );
};
