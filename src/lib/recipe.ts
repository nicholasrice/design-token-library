import type { DesignToken } from "./design-token.js";
import type { Library } from "./library.js";
import { isToken } from "./utilities.js";

/**
 * A recipe is a coded "operator" that expands a single declarative config
 * node into a subtree of related design tokens (for example a perceptual
 * color ramp, or a set of interactive-state colors).
 *
 * A recipe is referenced from config declaratively by {@link Recipe.name}, so
 * the authoring form remains JSON-serializable; the algorithm itself lives in
 * code and is registered in a {@link RecipeRegistry}.
 *
 * @public
 */
export interface Recipe<Props extends {} = any, Output extends {} = any> {
    /**
     * The unique name used to reference this recipe from config
     * (the `$recipe` field of a {@link RecipeDeclaration}).
     */
    readonly name: string;

    /**
     * The type assigned to the token(s) the recipe produces. This is a
     * {@link DesignToken.Type | DTCG type} or the name of a custom type (e.g.
     * `"palette"`).
     */
    readonly type: DesignToken.Type | (string & {});

    /**
     * Declares the keys of a **group recipe**. When present, `create`
     * returns an object keyed by these names and each key becomes its own
     * token in a group (e.g. `rest`, `hover`, `active`, `focus`).
     *
     * When omitted the recipe is a **value recipe**: it produces a single token
     * whose value is whatever `create` returns (e.g. a palette).
     *
     * @remarks
     * The shape of a group recipe is fixed when the library is created, so keys
     * must derive from *literal* params only. A reference such as
     * `"{color.seed}"` cannot be resolved at that point.
     */
    keys?(props: Props): string[];

    /**
     * Computes the recipe's output. Receives params with all references already
     * resolved to their current values. Must be pure and deterministic so its
     * result can be cached.
     *
     * @remarks
     * The output should be plain data (objects, arrays, primitives) so it can
     * be cloned and serialized. Share behavior as exported helper functions that
     * take the data, rather than as methods on the value.
     */
    create(props: Props): Output;
}

/**
 * The declarative, JSON-serializable call that invokes a {@link Recipe}.
 *
 * @remarks
 * Every property is `$`-prefixed, as format properties are in DTCG. Token and
 * group names cannot begin with `$`, so a property can never collide with a
 * name, including the names a group recipe generates. A call accepts only the
 * properties below; any other key is an error.
 *
 * A **value recipe** is called from a token's `$value`, so the token keeps its
 * own `$type`, `$description` and `$extensions`:
 *
 * ```json
 * { "$type": "palette", "$value": { "$recipe": "createPalette", "$with": {} } }
 * ```
 *
 * A **group recipe** is called from a group node, which is a {@link RecipeDeclaration}.
 *
 * @public
 */
export interface RecipeCall<
    Name extends string = string,
    Props extends {} = any,
> {
    /**
     * The name of the registered {@link Recipe} to invoke.
     */
    $recipe: Name;

    /**
     * The recipe's params: plain data, where a `{a.b.c}` string references
     * another token. Defaults to `{}`.
     */
    $with?: Props;
}

/**
 * The declarative form of a **group recipe**: a group node that calls a
 * {@link Recipe} and carries the group's own properties.
 *
 * @public
 */
export interface RecipeDeclaration<
    Name extends string = string,
    Props extends {} = any,
> extends RecipeCall<Name, Props> {
    /**
     * The type of the tokens the recipe produces. The recipe decides the type,
     * so this is optional; when present it must match.
     */
    $type?: string;

    /**
     * Describes the group the recipe produces.
     */
    $description?: string;

    /**
     * Extensions on the group the recipe produces.
     */
    $extensions?: Record<string, any>;

    /**
     * Deprecates every token the recipe produces.
     */
    $deprecated?: boolean | string;
}

/**
 * A registry of {@link Recipe | recipes} keyed by name.
 *
 * @remarks
 * The registry is injectable (passed to {@link Library.create}) so test suites
 * and independent libraries do not share operator state. A default global
 * registry, {@link recipes}, is used when none is supplied.
 *
 * @public
 */
export class RecipeRegistry {
    private readonly registered: Map<string, Recipe> = new Map();

    public register(recipe: Recipe): void {
        if (this.registered.has(recipe.name)) {
            throw new Error(
                `A recipe named "${recipe.name}" is already registered.`,
            );
        }
        this.registered.set(recipe.name, recipe);
    }

    public get(name: string): Recipe | undefined {
        return this.registered.get(name);
    }

    public has(name: string): boolean {
        return this.registered.has(name);
    }

    /**
     * Every registered recipe, in registration order.
     */
    public list(): Recipe[] {
        return [...this.registered.values()];
    }
}

/**
 * The default global {@link RecipeRegistry} used when {@link Library.create}
 * is not given one explicitly.
 *
 * @public
 */
export const recipes = new RecipeRegistry();

const REF = /^\{([^}]+)\}$/;

const isObject = (value: unknown): value is Record<string, any> => {
    return typeof value === "object" && value !== null;
};

/**
 * Tests whether a value is a DTCG-style reference string, e.g. `"{color.seed}"`.
 *
 * @internal
 */
export const isRef = (value: unknown): value is string => {
    return typeof value === "string" && REF.test(value);
};

/**
 * Resolves a single reference string against the token tree, returning the
 * referenced token's current value.
 *
 * @remarks
 * Must be called inside the resolving node's watcher scope so that walking the
 * tree subscribes the node to the referenced token (reactivity).
 *
 * A reference names a whole token. A recipe may also reference a group (it is
 * handed back as-is); a token's value may not.
 *
 * @param owner - what is resolving the reference, for error messages
 *
 * @internal
 */
export const resolveRef = (
    ref: string,
    context: Library.Context<any>,
    owner: string,
    allowGroup: boolean = true,
): any => {
    const match = REF.exec(ref);
    const path = match![1].split(".");

    let node: any = context;
    for (const segment of path) {
        if (!isObject(node) || isToken(node) || !(segment in node)) {
            throw new Error(`${owner} could not resolve reference "${ref}".`);
        }
        node = node[segment];
    }

    if (isToken(node)) {
        return node.$value;
    }

    if (!allowGroup) {
        throw new Error(
            `${owner} references "${ref}", which is a group. A reference must name a token.`,
        );
    }

    return node;
};

/**
 * Deep-clones a params object, replacing every reference string with the
 * current value of the token it references. References nested inside arrays and
 * objects are resolved too; all other values pass through unchanged.
 *
 * @internal
 */
export const resolveProps = <T extends {}>(
    props: T,
    context: Library.Context<any>,
    recipeName: string,
): T => {
    const resolve = (value: any): any => {
        if (isRef(value)) {
            return resolveRef(value, context, `Recipe "${recipeName}"`);
        }

        if (Array.isArray(value)) {
            return value.map(resolve);
        }

        if (isObject(value)) {
            const result: Record<string, any> = {};
            for (const key in value) {
                result[key] = resolve(value[key]);
            }
            return result;
        }

        return value;
    };

    return resolve(props);
};

/**
 * Tests whether a config node is a {@link RecipeDeclaration} or a
 * {@link RecipeCall}.
 *
 * @internal
 */
export const isRecipe = (value: unknown): value is RecipeDeclaration => {
    return isObject(value) && "$recipe" in value;
};

/**
 * Gets the recipe a config node invokes, if any: a group node that has
 * `$recipe`, or a token whose `$value` has `$recipe`. A token's own properties
 * are carried over so both forms read alike.
 *
 * @internal
 */
export const declarationOf = (
    node: unknown,
    path: string,
): RecipeDeclaration | undefined => {
    if (isRecipe(node)) {
        return node;
    }

    if (!isObject(node) || !isRecipe(node.$value)) {
        return undefined;
    }

    const call: Record<string, any> = node.$value;

    for (const key of Object.keys(call)) {
        if (!CALL_PROPERTIES.includes(key)) {
            const hint = key === "with" ? ` Did you mean "$with"?` : "";

            throw new Error(
                `The $value of "${path}" has an unsupported key "${key}". A recipe call accepts only ${CALL_PROPERTIES.join(", ")}.${hint}`,
            );
        }
    }

    const declaration: Record<string, any> = { ...call };

    for (const key of ["$type", "$description", "$extensions", "$deprecated"]) {
        if (node[key] !== undefined) {
            declaration[key] = node[key];
        }
    }

    return declaration as RecipeDeclaration;
};

const CALL_PROPERTIES = ["$recipe", "$with"];

const NODE_PROPERTIES = [
    ...CALL_PROPERTIES,
    "$type",
    "$description",
    "$extensions",
    "$deprecated",
];

/**
 * Checks a {@link RecipeDeclaration} against its {@link Recipe}, so a mistake is
 * an error instead of being silently ignored.
 *
 * @internal
 */
export const validateDeclaration = (
    decl: RecipeDeclaration,
    path: string,
    recipe: Recipe,
): void => {
    for (const key of Object.keys(decl)) {
        if (!NODE_PROPERTIES.includes(key)) {
            const hint = key === "with" ? ` Did you mean "$with"?` : "";

            throw new Error(
                `Recipe node "${path}" has an unsupported key "${key}". A recipe node accepts only ${NODE_PROPERTIES.join(", ")}.${hint}`,
            );
        }
    }

    if (
        decl.$with !== undefined &&
        (!isObject(decl.$with) || Array.isArray(decl.$with))
    ) {
        throw new Error(`Recipe node "${path}" must give $with as an object.`);
    }

    if (decl.$type !== undefined && decl.$type !== recipe.type) {
        throw new Error(
            `Recipe "${recipe.name}" produces type "${recipe.type}", but "${path}" declares $type "${decl.$type}".`,
        );
    }
};

/**
 * Checks the keys a group recipe generates. Each becomes a token name, and a
 * name cannot be empty, begin with `$`, or contain `.`, `{` or `}`: `$` is for
 * format properties and the others delimit references.
 *
 * @internal
 */
export const validateKeys = (
    keys: string[],
    path: string,
    recipe: Recipe,
): void => {
    const seen = new Set<string>();

    for (const key of keys) {
        if (
            typeof key !== "string" ||
            key.length === 0 ||
            /^\$|[.{}]/.test(key)
        ) {
            throw new Error(
                `Recipe "${recipe.name}" produced the key ${JSON.stringify(key)} for "${path}". Keys become token names, which cannot be empty, begin with "$", or contain ".", "{" or "}".`,
            );
        }

        if (seen.has(key)) {
            throw new Error(
                `Recipe "${recipe.name}" produced the key "${key}" more than once for "${path}".`,
            );
        }

        seen.add(key);
    }
};
