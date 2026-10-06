import { DesignToken } from "./design-token.js";
import { INotifier, ISubscriber, getNotifier } from "./notifier.js";
import { IQueue, Queue } from "./queue.js";
import {
    RecipeRegistry,
    recipes as defaultRecipes,
    isRecipe,
    resolveProps,
    validateDeclaration,
    validateKeys,
    type Recipe,
    type RecipeDeclaration,
} from "./recipe.js";
import { DeepPartial, empty } from "./utilities.js";
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
            : K extends "type"
              ? DesignToken.Type
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
    ) => T | DesignToken.ValueByToken<T>;

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
                  | Alias<DesignToken.TokenByValue<V[K]>, T>
                  | DeepAlias<V[K], T>
            : // Not a DTCG value (e.g. a field of a custom type): it cannot be
              // an alias, but it must remain assignable.
              V[K];
    };

    /**
     * Context object provided to {@link (Library:namespace).Alias} values at runtime
     *
     * @public
     */
    export type Context<T extends {}, R extends {} = T> = {
        [K in keyof Readonly<T>]: T[K] extends DesignToken.Any
            ? Readonly<T[K]>
            : K extends "type"
              ? DesignToken.Type
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
        set(value: DesignToken.ValueByToken<T> | Alias<T, C>): void;
        toString(): string;
        readonly type: DesignToken.TypeByToken<T>;
        readonly extensions: Record<string, any>;
        readonly value: DesignToken.ValueByToken<T>;
        readonly description: string;
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
        // assign Omit<T, "value"> & { value...} where if the type of the argument
        // in Library.create is untyped, it cannot be inferred, so use T | ...
        | (Omit<T, "value"> & {
              value:
                  | Library.Alias<T, Context<R>>
                  | Library.DeepAlias<DesignToken.ValueByToken<T>, Context<R>>;
          })
        // A value recipe produces this token (e.g. a palette) declaratively.
        | RecipeDeclaration;

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

/**
 * @internal
 */
const isToken = <T extends DesignToken.Any>(
    value: T | any,
): value is DesignToken.Any => {
    return isObject(value) && "value" in value;
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

const recurseCreate = (
    name: string,
    library: Library.TokenLibrary<any, any>,
    config: Library.Config<any>,
    context: Library.TokenLibrary<any, any>,
    typeContext: DesignToken.Type | null,
    registry: RecipeRegistry,
    queue: IQueue<Library.Token<DesignToken.Any, any>>,
): void => {
    for (const key in config) {
        if (key === "type") {
            typeContext = config[key] as any;
            continue;
        }

        const _name = name.length === 0 ? key : `${name}.${key}`;

        if (isRecipe(config[key])) {
            expandRecipe(
                _name,
                key,
                library,
                config[key] as any,
                context,
                registry,
                queue,
            );
        } else if (isGroup(config[key])) {
            Reflect.defineProperty(library, key, {
                value: {},
                enumerable: true,
            });
            recurseCreate(
                _name,
                library[key] as any,
                config[key],
                context,
                config[key].type || typeContext,
                registry,
                queue,
            );
            Object.freeze(library[key]);
        } else if (isToken(config[key])) {
            const { value, type, description, extensions } = config[key];
            if (!type && !typeContext) {
                throw new Error(
                    `No 'type' found for token '${key}'. Types cannot be inferred, please add a type to the token or to a group ancestor.`,
                );
            }
            const token = new LibraryToken(
                _name,
                value,
                type || typeContext,
                context,
                description || "",
                extensions || {},
                queue,
            );
            Reflect.defineProperty(library, key, {
                get() {
                    // Token access needs to be tracked because an alias token
                    // is a function that returns a token
                    Watcher.track(token);
                    return token;
                },
                enumerable: true,
            });
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
    const keys = new Set(Object.keys(sourceTokens).concat(Object.keys(config))); // Remove duplicate keys

    for (const key of keys) {
        const sourceHasKey = key in sourceTokens;
        const configHasKey = key in config;
        const _name = name.length === 0 ? key : `${name}.${key}`;

        if (key === "type") {
            typeContext = sourceTokens[key] as any;
            continue;
        }

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
        const override = isRecipe(config[key])
            ? (config[key] as RecipeDeclaration)
            : undefined;
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
                context,
                registry,
                queue,
            );
            continue;
        }

        const keyIsGroup = isGroup(sourceTokens[key]) || isGroup(config[key]);
        const keyIsToken = isToken(sourceTokens[key]) || isToken(config[key]);

        if (keyIsGroup) {
            // Inherit the source group via the prototype chain so unconfigured
            // descendants resolve to the source, while overrides shadow them.
            Reflect.defineProperty(extendedTokens, key, {
                value: Object.create(sourceHasKey ? sourceTokens[key] : {}),
                enumerable: true,
            });
            if (sourceHasKey) {
                recurseExtend(
                    _name,
                    sourceTokens[key] as any,
                    extendedTokens[key] as any,
                    config[key] || {},
                    context,
                    (sourceTokens.type || typeContext) as any,
                    registry,
                    queue,
                );
            } else if (configHasKey) {
                // This will always be the case
                recurseCreate(
                    _name,
                    sourceTokens[key] as any,
                    extendedTokens[key],
                    context,
                    (sourceTokens.type || typeContext) as any,
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
                    : new LibraryToken(
                          _name,
                          config[key].value,
                          config[key].type || typeContext,
                          context,
                          config[key].description || "",
                          config[key].extensions || {},
                          queue,
                      );
            Reflect.defineProperty(extendedTokens, key, {
                get() {
                    // Token access needs to be tracked because an alias token
                    // is a function that returns a token
                    Watcher.track(token);
                    return token;
                },
                enumerable: true,
            });
        }
    }
};

function extendToken(
    token: Library.Token<any, any>,
    context: Library.Context<any>,
    queue: IQueue<any>,
    value?: any,
) {
    const extendingToken = Object.create(token);
    extendingToken.context = context;
    extendingToken.cached = empty;
    extendingToken.watchContext = extendingToken;
    extendingToken.queue = queue;

    if (value !== undefined) {
        extendingToken.raw = value;
    } else {
        // Subscribe to changes
        // spy on set, unsubscribe when set
        const subscriber: ISubscriber<Library.Token<any, any>> = {
            onChange() {
                extendingToken.onChange();
            },
        };
        // token.value;
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

const recurseResolve = (value: any, context: Library.Context<any>) => {
    const r: any = Array.isArray(value) ? [] : {};
    for (const key in value) {
        let v = value[key];

        if (isAlias(v)) {
            v = v(context);
        }

        if (isToken(v)) {
            v = v.value;
        }

        if (isObject(v)) {
            r[key] = recurseResolve(v, context);
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
            queue,
        );
        recipeDeclarations.set(token, decl);
        Reflect.defineProperty(library, key, {
            get() {
                Watcher.track(token);
                return token;
            },
            enumerable: true,
        });
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

    for (const genKey of keys) {
        const token = new RecipeToken(
            `${name}.${genKey}`,
            node,
            genKey,
            recipe.type,
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
        const value = isObject(raw) ? recurseResolve(raw, this.context) : raw;
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
        private readonly queue: IQueue<Library.Token<DesignToken.Any, any>>,
    ) {}

    public get type(): any {
        return this._type;
    }

    public get description(): string {
        return "";
    }

    public get extensions(): Record<string, any> {
        return {};
    }

    public get value(): any {
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
        return String(this.value);
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
    private raw: DesignToken.ValueByToken<T> | Library.Alias<T, any>;
    private cached: DesignToken.ValueByToken<T> | typeof empty = empty;
    private subscriptions: Set<INotifier<any>> = new Set();

    constructor(
        public readonly name: string,
        value: DesignToken.ValueByToken<T> | Library.Alias<T, any>,
        private readonly _type: DesignToken.TypeByToken<T>,
        private readonly context: Library.Context<any>,
        private readonly _description: string,
        private readonly _extensions: Record<string, any>,
        private queue: IQueue<Library.Token<DesignToken.Any, any>>,
    ) {
        this.raw = value;
        this.context = context;
    }

    public get type() {
        return this._type;
    }

    public get description() {
        return this._description;
    }

    public get extensions() {
        return this._extensions;
    }

    /**
     * Gets the token value
     */
    public get value(): T["value"] {
        if (this.cached !== empty) {
            return this.cached;
        }

        this.disconnect();
        const stopWatching = Watcher.use(this);
        const raw = isAlias(this.raw) ? this.raw(this.context) : this.raw;
        const normalized = isToken(raw) ? raw.value : raw;

        const value = isObject(normalized)
            ? recurseResolve(normalized, this.context)
            : normalized;

        this.cached = value;
        stopWatching();

        return value;
    }

    public set(value: DesignToken.ValueByToken<T> | Library.Alias<T, any>) {
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
