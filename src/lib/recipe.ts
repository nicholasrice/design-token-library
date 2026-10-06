import type { DesignToken } from "./design-token.js";
import type { Library } from "./library.js";

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
 * The declarative, JSON-serializable form used to invoke a {@link Recipe} from
 * config.
 *
 * @remarks
 * Every property is `$`-prefixed, as format properties are in DTCG. Token and
 * group names cannot begin with `$`, so a node property can never collide with
 * a name, including the names a group recipe generates. A recipe node accepts
 * only the properties below; any other key is an error.
 *
 * @public
 */
export interface RecipeDeclaration<
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

    /**
     * The type of the token(s) the recipe produces. The recipe decides the type,
     * so this is optional; when present it must match.
     */
    $type?: string;

    /**
     * Describes the token a value recipe produces. A group recipe produces a
     * group, and groups cannot carry a description yet.
     */
    $description?: string;

    /**
     * Extensions on the token a value recipe produces. A group recipe produces a
     * group, and groups cannot carry extensions yet.
     */
    $extensions?: Record<string, any>;
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
 * @internal
 */
export const resolveRef = (
    ref: string,
    context: Library.Context<any>,
    recipeName: string,
): any => {
    const match = REF.exec(ref);
    const path = match![1].split(".");

    let node: any = context;
    for (const segment of path) {
        if (!isObject(node) || !(segment in node)) {
            throw new Error(
                `Recipe "${recipeName}" could not resolve reference "${ref}".`,
            );
        }
        node = node[segment];
    }

    // A reference should resolve to a token; return its value. If it resolves
    // to a group (no "value"), hand back the node as-is.
    return isObject(node) && "value" in node ? node.value : node;
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
            return resolveRef(value, context, recipeName);
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
 * Tests whether a config node is a {@link RecipeDeclaration}.
 *
 * @internal
 */
export const isRecipe = (value: unknown): value is RecipeDeclaration => {
    return isObject(value) && "$recipe" in value;
};

const NODE_PROPERTIES = [
    "$recipe",
    "$with",
    "$type",
    "$description",
    "$extensions",
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

    if (
        recipe.keys &&
        (decl.$description !== undefined || decl.$extensions !== undefined)
    ) {
        throw new Error(
            `Recipe node "${path}" invokes the group recipe "${recipe.name}". A group cannot carry $description or $extensions yet.`,
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
