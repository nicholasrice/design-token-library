import type { Library } from "./library.js";

// See docs/decisions/0001-refs-and-recipes.md.

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
 * of which may be refs or computed values, and returns the
 * {@link (Library:namespace).Computed} result. The function is called when
 * the token is read, with the values of the refs, and again when one of the
 * tokens it read changes.
 *
 * @remarks
 * Arguments are evaluated when a function is called, before the library
 * exists, so a function can't be given refs itself: its recipe defers it.
 * The function must be pure, because it's called only when the token's value
 * is resolved again. A generic function's recipe takes the arguments of its
 * constraint. Recipes are extended by spreading them into a new object, and a
 * recipe's function is replaced in an extended library with {@link override}.
 *
 * @example
 * ```ts
 * export const Recipes = recipes({ darken: darkenColor, lighten: lightenColor });
 * export const MyRecipes = { ...Recipes, ...recipes({ tint: tintColor }) };
 *
 * hover: { $type: DesignToken.Type.Color, $value: Recipes.darken($.colors.primary, 0.2) }
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
 * Replaces the function of a recipe, in a library made by
 * `extend()`, for every token that computes
 * its value with the recipe. `fn` takes the recipe's arguments and returns a
 * value of its result's type.
 *
 * @example
 * ```ts
 * const contrast = library.extend({}, { recipes: [override(Recipes.darken, darkenMore)] });
 * ```
 *
 * @public
 */
export const override = <A extends unknown[], V>(
    recipe: Library.Recipe<A, V>,
    fn: (...args: A) => V,
): Library.RecipeOverride => Object.freeze({ recipe, fn });

/**
 * Tests whether a value is a {@link (Library:namespace).Computed} value.
 *
 * @internal
 */
export const isComputed = (
    value: unknown,
): value is Library.Computed<unknown, {}> => {
    return typeof value === "object" && value !== null && COMPUTED in value;
};
