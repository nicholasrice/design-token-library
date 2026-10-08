import { DesignToken } from "./design-token.js";
import { INotifier, ISubscriber, getNotifier } from "./notifier.js";
import { IQueue, Queue } from "./queue.js";
import {
    RecipeRegistry,
    recipes as defaultRecipes,
    declarationOf,
    isRecipe,
    isRef,
    resolveProps,
    resolveRef,
    validateDeclaration,
    validateKeys,
    type Recipe,
    type RecipeDeclaration,
} from "./recipe.js";
import { DeepPartial, empty, isToken } from "./utilities.js";
import { IWatcher, Watcher } from "./watcher.js";

/**
 * @public
 */
export namespace Library {
    export interface Library<T extends {}, R extends {} = T> {
        tokens: TokenLibrary<T, R>;
        subscribe(subscriber: Library.Subscriber<R>): void;
        unsubscribe(subscriber: Library.Subscriber<R>): void;
        extend<K extends {} = any>(
            config: DeepPartial<T> & Config<K, R & K>,
        ): Library<T & K, R & K>; // TODO should not be any
    }

    export interface Subscriber<R extends {}> {
        onChange(
            records: ReadonlyArray<Library.Token<DesignToken.Any, R>>,
        ): void;
    }

    /**
     * Defines a token library that can be interacted with
     * to mutate token values.
     *
     * @public
     */
    export type TokenLibrary<T extends {}, R extends {} = T> = {
        [K in keyof Readonly<T>]: T[K] extends DesignToken.Any
            ? Token<T[K], R>
            : K extends `$${string}`
              ? T[K]
              : T[K] extends {}
                ? TokenLibrary<T[K], R>
                : never;
    };

    /**
     * A token value that serves as an alias to another token value
     *
     * @public
     */
    export type Alias<T extends DesignToken.Any, R extends Context<any>> = (
        context: R,
    ) => T | Token<T, any> | DesignToken.ValueByToken<T>;

    /**
     * A reference to another token by path, as in DTCG: `"{color.blue}"`.
     *
     * @public
     */
    export type Reference = `{${string}}`;

    /**
     * An {@link (Library:namespace).Alias} that supports complex token value types
     * such as {@link DesignToken.Border}
     *
     * @public
     */
    export type DeepAlias<V, T extends Context<any>> = {
        [K in keyof V]: V[K] extends DesignToken.Values.Any
            ?
                  | V[K]
                  | Reference
                  | Alias<DesignToken.TokenByValue<V[K]>, T>
                  | DeepAlias<V[K], T>
            : // Not a DTCG value by itself (a field of a custom type, or a list
              // of values): it cannot be an alias, but the values inside it can.
              V[K] extends object
              ? DeepAlias<V[K], T>
              : V[K];
    };

    /**
     * Context object provided to {@link (Library:namespace).Alias} values at runtime
     *
     * @public
     */
    export type Context<T extends {}, R extends {} = T> = {
        [K in keyof Readonly<T>]: T[K] extends DesignToken.Any
            ? Token<T[K], R>
            : K extends `$${string}`
              ? T[K]
              : T[K] extends {}
                ? Context<T[K], R>
                : never;
    };

    /**
     * A token in a {@link (Library:namespace).TokenLibrary}
     *
     * @public
     */
    export type Token<T extends DesignToken.Any, C extends {}> = {
        set(
            value:
                | DesignToken.ValueByToken<T>
                | Reference
                | Alias<T, Context<C>>,
        ): void;
        toString(): string;
        readonly $type: DesignToken.TypeByToken<T>;
        readonly $extensions: Record<string, any>;
        readonly $value: DesignToken.ValueByToken<T>;
        readonly $description: string;
        /**
         * `false`, `true`, or the explanation the token was deprecated with.
         */
        readonly $deprecated: boolean | string;
        readonly name: string;
    };

    /**
     * A configuration object provided to {@link Library.create}
     *
     * @public
     */
    export type Config<T extends {}, R extends {} = T> = {
        [K in keyof T]: T[K] extends DesignToken.Any
            ? ConfigValue<T[K], R>
            : K extends `$${string}`
              ? T[K]
              : T[K] extends {}
                ? Config<T[K], R> | RecipeDeclaration
                : never;
    };

    /**
     * @public
     */
    export type ConfigValue<T extends DesignToken.Any, R extends {}> =
        | T
        // There is an odd TypeScript type error that occurs if this is simply
        // assign Omit<T, "$value"> & { $value...} where if the type of the argument
        // in Library.create is untyped, it cannot be inferred, so use T | ...
        | (Omit<T, "$value"> & {
              $value:
                  | Reference
                  | Library.Alias<T, Context<R>>
                  | Library.DeepAlias<DesignToken.ValueByToken<T>, Context<R>>;
          })
        // A value recipe produces this token's value (e.g. a palette).
        | (Omit<T, "$value"> & { $value: RecipeDeclaration });

    /**
     * Options accepted by {@link Library.create}.
     *
     * @public
     */
    export interface CreateOptions {
        /**
         * The {@link RecipeRegistry} used to resolve recipe declarations.
         * Defaults to the global {@link recipes} registry.
         */
        recipes?: RecipeRegistry;
    }

    /**
     * @public
     */
    export const create = <T extends {} = any>(
        config: Library.Config<T, T>,
        options: Library.CreateOptions = {},
    ): Library.Library<T> => {
        return LibraryImpl.create(config, options.recipes ?? defaultRecipes);
    };
}

const isObject = <T>(value: T): value is T & {} => {
    return typeof value === "object" && value !== null;
};

const isGroup = (
    value: DesignToken.Group | any,
): value is DesignToken.Group => {
    return isObject(value) && !isToken(value);
};

const isAlias = <T extends DesignToken.Any, K extends {}>(
    value: any,
): value is Library.Alias<T, K> => {
    return typeof value === "function";
};

const GROUP_METADATA = [
    "$type",
    "$description",
    "$extensions",
    "$deprecated",
] as const;

/**
 * Names beginning with `$` are for format properties, except `$root`: the
 * reserved name of a group's own token.
 */
const isChildKey = (key: string): boolean => {
    return !key.startsWith("$") || key === "$root";
};

/**
 * Records a group's own `$`-prefixed properties on it. They are not
 * enumerable, so they never appear as children when a group is walked.
 */
const defineGroupMetadata = (group: object, config: Record<string, any>) => {
    for (const property of GROUP_METADATA) {
        if (property in config) {
            Reflect.defineProperty(group, property, {
                value: config[property],
                enumerable: false,
            });
        }
    }
};

const createToken = (
    name: string,
    node: Record<string, any>,
    context: Library.TokenLibrary<any, any>,
    typeContext: DesignToken.Type | null,
    queue: IQueue<Library.Token<DesignToken.Any, any>>,
): LibraryToken<any> => {
    for (const key of Object.keys(node)) {
        if (!key.startsWith("$")) {
            throw new Error(
                `"${name}" has a $value, so it is a token and cannot have a child "${key}".`,
            );
        }
    }

    const type = node.$type || typeContext;

    if (!type) {
        throw new Error(
            `No '$type' found for token '${name}'. Types cannot be inferred, please add a $type to the token or to a group ancestor.`,
        );
    }

    return new LibraryToken(
        name,
        node.$value,
        type,
        context,
        node.$description || "",
        node.$extensions || {},
        node.$deprecated ?? false,
        queue,
    );
};

const defineToken = (
    library: Library.TokenLibrary<any, any>,
    key: string,
    token: object,
) => {
    Reflect.defineProperty(library, key, {
        get() {
            // Token access needs to be tracked because an alias token
            // is a function that returns a token
            Watcher.track(token);
            return token;
        },
        enumerable: true,
    });
};

const recurseCreate = (
    name: string,
    library: Library.TokenLibrary<any, any>,
    config: Library.Config<any>,
    context: Library.TokenLibrary<any, any>,
    typeContext: DesignToken.Type | null,
    registry: RecipeRegistry,
    queue: IQueue<Library.Token<DesignToken.Any, any>>,
): void => {
    typeContext = (config as any).$type ?? typeContext;

    for (const key in config) {
        if (!isChildKey(key)) {
            continue;
        }

        const _name = name.length === 0 ? key : `${name}.${key}`;
        const declaration = declarationOf(config[key], _name);

        if (declaration) {
            expandRecipe(
                _name,
                key,
                library,
                declaration,
                isToken(config[key]),
                context,
                registry,
                queue,
            );
        } else if (isGroup(config[key])) {
            const group = {};
            defineGroupMetadata(group, config[key]);
            Reflect.defineProperty(library, key, {
                value: group,
                enumerable: true,
            });
            recurseCreate(
                _name,
                group,
                config[key],
                context,
                typeContext,
                registry,
                queue,
            );
            Object.freeze(group);
        } else if (isToken(config[key])) {
            defineToken(
                library,
                key,
                createToken(_name, config[key], context, typeContext, queue),
            );
        }
    }
};

const recurseExtend = (
    name: string,
    sourceTokens: Library.TokenLibrary<any, any>,
    extendedTokens: Library.TokenLibrary<any, any>,
    config: Library.Config<any>, // TODO allow new config options
    context: Library.TokenLibrary<any, any>,
    typeContext: DesignToken.Type | null,
    registry: RecipeRegistry,
    queue: IQueue<Library.Token<DesignToken.Any, any>>,
): void => {
    typeContext =
        (config as any).$type ?? (sourceTokens as any).$type ?? typeContext;

    const keys = new Set(
        Object.keys(sourceTokens)
            .concat(Object.keys(config))
            .filter(isChildKey),
    ); // Remove duplicate keys

    for (const key of keys) {
        const sourceHasKey = key in sourceTokens;
        const configHasKey = key in config;
        const _name = name.length === 0 ? key : `${name}.${key}`;

        // Recipes are re-expanded in the extension so they resolve their
        // references against the extended library. An override layers its params
        // over the source declaration; a group recipe with no override is
        // re-expanded unchanged so it still follows inputs overridden in the
        // extension. (A value recipe's token already re-evaluates against the
        // extended context, so it takes the ordinary token path below.)
        const sourceValue = sourceTokens[key];
        const sourceDecl = isObject(sourceValue)
            ? recipeDeclarations.get(sourceValue)
            : undefined;
        const override = declarationOf(config[key], _name);
        const rebindsGroup =
            sourceDecl !== undefined && !override && !isToken(sourceValue);

        if (override || rebindsGroup) {
            const decl: RecipeDeclaration = sourceDecl
                ? {
                      ...sourceDecl,
                      ...override,
                      $with: { ...sourceDecl.$with, ...override?.$with },
                  }
                : override!;

            expandRecipe(
                _name,
                key,
                extendedTokens,
                decl,
                override !== undefined && isToken(config[key]),
                context,
                registry,
                queue,
            );
            continue;
        }

        const sourceIsGroup =
            isObject(sourceTokens[key]) && !isToken(sourceTokens[key]);
        const keyIsGroup = sourceIsGroup || isGroup(config[key]);
        const keyIsToken = isToken(sourceTokens[key]) || isToken(config[key]);

        if (keyIsGroup) {
            // Inherit the source group via the prototype chain so unconfigured
            // descendants resolve to the source, while overrides shadow them.
            const group = Object.create(sourceHasKey ? sourceTokens[key] : {});
            defineGroupMetadata(group, config[key] ?? {});
            Reflect.defineProperty(extendedTokens, key, {
                value: group,
                enumerable: true,
            });
            if (sourceHasKey) {
                recurseExtend(
                    _name,
                    sourceTokens[key] as any,
                    extendedTokens[key] as any,
                    config[key] || {},
                    context,
                    typeContext,
                    registry,
                    queue,
                );
            } else if (configHasKey) {
                // This will always be the case
                recurseCreate(
                    _name,
                    extendedTokens[key] as any,
                    config[key],
                    context,
                    typeContext,
                    registry,
                    queue,
                );
            }
        } else if (keyIsToken) {
            const token =
                sourceTokens[key] !== undefined
                    ? extendToken(
                          sourceTokens[key] as Library.Token<any, any>,
                          context,
                          queue,
                          config[key],
                      )
                    : createToken(
                          _name,
                          config[key],
                          context,
                          typeContext,
                          queue,
                      );
            defineToken(extendedTokens, key, token);
        }
    }
};

function extendToken(
    token: Library.Token<any, any>,
    context: Library.Context<any>,
    queue: IQueue<any>,
    node?: Record<string, any>,
) {
    const extendingToken = Object.create(token);
    extendingToken.context = context;
    extendingToken.cached = empty;
    extendingToken.watchContext = extendingToken;
    extendingToken.queue = queue;

    // An extension can restate the token's metadata along with its value.
    if (node?.$description !== undefined) {
        extendingToken._description = node.$description;
    }
    if (node?.$extensions !== undefined) {
        extendingToken._extensions = node.$extensions;
    }
    if (node?.$deprecated !== undefined) {
        extendingToken._deprecated = node.$deprecated;
    }

    if (node !== undefined && "$value" in node) {
        extendingToken.raw = node.$value;
    } else {
        // Subscribe to changes
        // spy on set, unsubscribe when set
        const subscriber: ISubscriber<Library.Token<any, any>> = {
            onChange() {
                extendingToken.onChange();
            },
        };
        // token.$value;
        getNotifier(token).subscribe(subscriber);
        const set = extendingToken.set;
        extendingToken.set = (value: any) => {
            getNotifier(token).unsubscribe(subscriber);
            set.call(extendingToken, value);
            extendingToken.set = set;
        };
    }

    return extendingToken;
}

const recurseResolve = (
    value: any,
    context: Library.Context<any>,
    owner: string,
) => {
    const r: any = Array.isArray(value) ? [] : {};
    for (const key in value) {
        let v = value[key];

        if (isAlias(v)) {
            v = v(context);
        } else if (isRef(v)) {
            v = resolveRef(v, context, owner, false);
        }

        if (isToken(v)) {
            v = v.$value;
        }

        if (isObject(v)) {
            r[key] = recurseResolve(v, context, owner);
        } else {
            r[key] = v;
        }
    }

    return r;
};

/**
 * The declaration each recipe-produced node (a generated group, or a value
 * recipe's token) was created from, so that
 * {@link (Library:namespace).Library.extend} can layer override params on top
 * of the source recipe's params.
 */
const recipeDeclarations = new WeakMap<object, RecipeDeclaration>();

/**
 * Expands a {@link RecipeDeclaration} into a frozen group of generated
 * {@link RecipeToken | tokens} and attaches it to the token tree.
 */
const expandRecipe = (
    name: string,
    key: string,
    library: Library.TokenLibrary<any, any>,
    decl: RecipeDeclaration,
    asToken: boolean,
    context: Library.Context<any>,
    registry: RecipeRegistry,
    queue: IQueue<Library.Token<DesignToken.Any, any>>,
): void => {
    const recipe = registry.get(decl.$recipe);

    if (!recipe) {
        throw new Error(
            `No recipe named "${decl.$recipe}" is registered. Register it before creating the library.`,
        );
    }

    validateDeclaration(decl, name, recipe);

    if (asToken && recipe.keys) {
        throw new Error(
            `Recipe "${recipe.name}" is a group recipe, so "${name}" must be a group that calls it, not a token.`,
        );
    }

    if (!asToken && !recipe.keys) {
        throw new Error(
            `Recipe "${recipe.name}" is a value recipe, so "${name}" must be a token that calls it from its $value.`,
        );
    }

    const props = decl.$with ?? {};

    if (!recipe.keys) {
        // A value recipe produces one token. It is an ordinary LibraryToken
        // whose value is an alias over the recipe, so caching, dependency
        // tracking, aliasing, set() and extend() all behave as for any token.
        const token = new LibraryToken<any>(
            name,
            ((ctx: Library.Context<any>) =>
                recipe.create(resolveProps(props, ctx, recipe.name))) as any,
            recipe.type as any,
            context,
            decl.$description ?? "",
            decl.$extensions ?? {},
            decl.$deprecated ?? false,
            queue,
        );
        recipeDeclarations.set(token, decl);
        defineToken(library, key, token);
        return;
    }

    // The shape of a group recipe is fixed at creation time, derived from
    // literal params. A single node computes the full output; one facade per key
    // reads its slice and recomputes reactively when the recipe's inputs change.
    const keys = recipe.keys(props);

    if (keys.length === 0) {
        throw new Error(
            `Recipe "${recipe.name}" produced no keys for "${name}". Keys must derive from literal params, not references.`,
        );
    }

    validateKeys(keys, name, recipe);
    const node = new RecipeNode(recipe, props, context);
    const group: Record<string, any> = {};
    defineGroupMetadata(group, { ...decl, $type: recipe.type });

    for (const genKey of keys) {
        const token = new RecipeToken(
            `${name}.${genKey}`,
            node,
            genKey,
            recipe.type,
            decl.$deprecated ?? false,
            queue,
        );
        Reflect.defineProperty(group, genKey, {
            get() {
                // Mirror LibraryToken: token access must be tracked so a token
                // that aliases a generated token subscribes to it.
                Watcher.track(token);
                return token;
            },
            enumerable: true,
        });
    }

    recipeDeclarations.set(group, decl);
    Reflect.defineProperty(library, key, {
        value: group,
        enumerable: true,
    });
    Object.freeze(group);
};

/**
 * A single reactive cell that computes a recipe's full output once per
 * invalidation and caches it. It is not addressable in the token tree (it is
 * never added to the change queue); the generated {@link RecipeToken} facades
 * read slices of its output.
 */
class RecipeNode implements IWatcher, ISubscriber<any> {
    private cached: any = empty;
    private subscriptions: Set<INotifier<any>> = new Set();

    constructor(
        private readonly recipe: Recipe,
        private readonly rawProps: any,
        private readonly context: Library.Context<any>,
    ) {}

    /**
     * The recipe's full output object, memoized. References in the params are
     * resolved against the context tree inside this node's watcher scope, so
     * the node subscribes to every input token it reads.
     */
    public get output(): any {
        if (this.cached !== empty) {
            return this.cached;
        }

        this.disconnect();
        const stopWatching = Watcher.use(this);
        const props = resolveProps(
            this.rawProps,
            this.context,
            this.recipe.name,
        );
        const raw = this.recipe.create(props);
        // Allow operator output leaves to themselves be aliases/tokens.
        const value = isObject(raw)
            ? recurseResolve(raw, this.context, `Recipe "${this.recipe.name}"`)
            : raw;
        this.cached = value;
        stopWatching();

        return value;
    }

    public get(key: string): any {
        // Subscribe the active watcher (a reading facade) to this node.
        Watcher.track(this);
        return this.output[key];
    }

    public onChange(): void {
        this.cached = empty;
        getNotifier(this).notify();
    }

    public watch(source: Object): void {
        const notifier = getNotifier(source);
        notifier.subscribe(this);
        this.subscriptions.add(notifier);
    }

    public disconnect(): void {
        for (const record of this.subscriptions.values()) {
            record.unsubscribe(this);
            this.subscriptions.delete(record);
        }
    }
}

/**
 * A generated token produced by a recipe. It is a real, addressable token in
 * the tree: it can be aliased, flows through CSS reflection, and participates
 * in change notification. Its value is a slice of its {@link RecipeNode}'s
 * output and is read-only (override via {@link (Library:namespace).Library.extend}).
 */
class RecipeToken
    implements Library.Token<any, any>, ISubscriber<any>, IWatcher
{
    private cached: any = empty;
    private subscriptions: Set<INotifier<any>> = new Set();

    constructor(
        public readonly name: string,
        private readonly node: RecipeNode,
        private readonly key: string,
        private readonly _type: string,
        private readonly _deprecated: boolean | string,
        private readonly queue: IQueue<Library.Token<DesignToken.Any, any>>,
    ) {}

    public get $type(): any {
        return this._type;
    }

    public get $description(): string {
        return "";
    }

    public get $deprecated(): boolean | string {
        return this._deprecated;
    }

    public get $extensions(): Record<string, any> {
        return {};
    }

    public get $value(): any {
        if (this.cached !== empty) {
            return this.cached;
        }

        this.disconnect();
        const stopWatching = Watcher.use(this);
        const value = this.node.get(this.key);
        this.cached = value;
        stopWatching();

        return value;
    }

    public set(): void {
        throw new Error(
            `Token "${this.name}" is generated by a recipe and is read-only. Override the recipe's params via Library.extend() instead.`,
        );
    }

    public toString(): string {
        return String(this.$value);
    }

    public onChange(): void {
        this.queue.add(this);
        this.cached = empty;
        getNotifier(this).notify();
    }

    public watch(source: Object): void {
        const notifier = getNotifier(source);
        notifier.subscribe(this);
        this.subscriptions.add(notifier);
    }

    public disconnect(): void {
        for (const record of this.subscriptions.values()) {
            record.unsubscribe(this);
            this.subscriptions.delete(record);
        }
    }
}

class LibraryImpl<T extends {} = any> implements Library.Library<T> {
    constructor(
        public readonly tokens: Library.TokenLibrary<T>,
        private readonly registry: RecipeRegistry,
        private readonly queue: IQueue<Library.Token<DesignToken.Any, T>>,
    ) {}
    public subscribe(subscriber: Library.Subscriber<T>) {
        this.queue.subscribe(subscriber);
    }
    public unsubscribe(subscriber: Library.Subscriber<T>) {
        this.queue.unsubscribe(subscriber);
    }

    public extend(config: Library.Config<any>) {
        // TODO should not type Library.Config<any>
        const queue = new Queue();
        const tokens: Library.TokenLibrary<any> = {};
        const inherited: Record<string, any> = {};
        for (const property of GROUP_METADATA) {
            if (property in this.tokens) {
                inherited[property] = (this.tokens as any)[property];
            }
        }
        defineGroupMetadata(tokens, { ...inherited, ...config });
        recurseExtend(
            "",
            this.tokens,
            tokens,
            config,
            tokens,
            null,
            this.registry,
            queue,
        );

        return new LibraryImpl(tokens, this.registry, queue);
    }

    public static create<T extends {}>(
        config: Library.Config<T, T>,
        registry: RecipeRegistry,
    ) {
        const queue = new Queue();
        const tokens: Library.TokenLibrary<any> = {};
        defineGroupMetadata(tokens, config);
        recurseCreate("", tokens, config, tokens, null, registry, queue);

        return new LibraryImpl(tokens, registry, queue);
    }
}

/**
 * An individual token value in a library
 */
class LibraryToken<T extends DesignToken.Any>
    implements
        Library.Token<any, any>,
        ISubscriber<Library.Alias<T, any>>,
        IWatcher
{
    private raw:
        | DesignToken.ValueByToken<T>
        | Library.Reference
        | Library.Alias<T, any>;
    private cached: DesignToken.ValueByToken<T> | typeof empty = empty;
    private resolving = false;
    private subscriptions: Set<INotifier<any>> = new Set();

    constructor(
        public readonly name: string,
        value:
            | DesignToken.ValueByToken<T>
            | Library.Reference
            | Library.Alias<T, any>,
        private readonly _type: DesignToken.TypeByToken<T>,
        private readonly context: Library.Context<any>,
        private readonly _description: string,
        private readonly _extensions: Record<string, any>,
        private readonly _deprecated: boolean | string,
        private queue: IQueue<Library.Token<DesignToken.Any, any>>,
    ) {
        this.raw = value;
        this.context = context;
    }

    public get $deprecated() {
        return this._deprecated;
    }

    public get $type() {
        return this._type;
    }

    public get $description() {
        return this._description;
    }

    public get $extensions() {
        return this._extensions;
    }

    /**
     * Gets the token value
     */
    public get $value(): DesignToken.ValueByToken<T> {
        if (this.cached !== empty) {
            return this.cached;
        }

        if (this.resolving) {
            throw new Error(
                `Circular reference: the value of "${this.name}" depends on itself.`,
            );
        }

        this.disconnect();
        this.resolving = true;
        const stopWatching = Watcher.use(this);

        try {
            const owner = `Token "${this.name}"`;
            const raw = isAlias(this.raw)
                ? this.raw(this.context)
                : isRef(this.raw)
                  ? resolveRef(this.raw, this.context, owner, false)
                  : this.raw;
            const normalized = isToken(raw) ? raw.$value : raw;

            const value = isObject(normalized)
                ? recurseResolve(normalized, this.context, owner)
                : normalized;

            this.cached = value;

            return value;
        } finally {
            this.resolving = false;
            stopWatching();
        }
    }

    public set(
        value:
            | DesignToken.ValueByToken<T>
            | Library.Reference
            | Library.Alias<T, any>,
    ) {
        this.raw = value;
        this.onChange();
    }

    public onChange(): void {
        this.queue.add(this);

        this.cached = empty;
        getNotifier(this).notify();
    }

    public watch(source: Object): void {
        const notifier = getNotifier(source);
        notifier.subscribe(this);
        this.subscriptions.add(notifier);
    }

    /**
     * Disconnect the token from it's subscriptions
     */
    public disconnect() {
        for (const record of this.subscriptions.values()) {
            record.unsubscribe(this);
            this.subscriptions.delete(record);
        }
    }
}
