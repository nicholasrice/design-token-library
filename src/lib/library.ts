import { DesignToken } from "./design-token.js";
import { INotifier, ISubscriber, getNotifier } from "./notifier.js";
import { IQueue, Queue } from "./queue.js";
import { empty, isToken } from "./utilities.js";
import { IWatcher, Watcher } from "./watcher.js";

/**
 * @public
 */
export namespace Library {
    export interface Library<T extends {}, R extends {} = T> {
        tokens: TokenLibrary<T, R>;
        subscribe(subscriber: Library.Subscriber<R>): void;
        unsubscribe(subscriber: Library.Subscriber<R>): void;
        extend<K extends NoRoot<K> = {}>(
            config: ExtendConfig<T, R & NewTokens<K, T>> &
                Config<K, R & NewTokens<K, T>, never, T>,
        ): Library<T & NewTokens<K, T>, R & NewTokens<K, T>>;
    }

    /**
     * The tokens and groups of `K` that are new relative to a source library
     * of shape `T`. Overrides of tokens in `T` are removed so that they keep
     * the source token's type.
     *
     * @public
     */
    export type NewTokens<K, T> = {
        [P in keyof K as P extends keyof T
            ? T[P] extends DesignToken.Shape
                ? never
                : P
            : P]: P extends keyof T ? NewTokens<K[P], T[P]> : K[P];
    };

    /**
     * `$root` is the token of a group, so a library cannot have one at its top
     * level, where there is no group to name it for.
     *
     * @public
     */
    export type NoRoot<T> = {
        [K in keyof T]: K extends "$root" ? never : T[K];
    };

    export interface Subscriber<R extends {}> {
        onChange(records: ReadonlyArray<Library.TokenRecord<R>>): void;
    }

    /**
     * A union of all tokens in a library of shape `T`.
     *
     * @public
     */
    export type TokensOf<T> = {
        [K in keyof T]-?: T[K] extends DesignToken.Shape
            ? T[K]
            : K extends keyof DesignToken.Group
              ? never
              : T[K] extends object
                ? TokensOf<T[K]>
                : never;
    }[keyof T];

    /**
     * A {@link (Library:namespace).Token} of any token in a library of shape `R`.
     * The union is discriminated by `type`.
     *
     * @public
     */
    export type TokenRecord<R extends {}> =
        TokensOf<R> extends infer T
            ? T extends DesignToken.Shape
                ? Token<T, R>
                : never
            : never;

    /**
     * Defines a token library that can be interacted with
     * to mutate token values.
     *
     * @remarks
     * `G` is the type inherited from ancestor groups.
     *
     * @public
     */
    export type TokenLibrary<
        T extends {},
        R extends {} = T,
        G extends string = never,
    > = TokenGroup<T, R, GroupType<T, G>>;

    type TokenGroup<T extends {}, R extends {}, G extends string> = {
        [K in keyof Readonly<T>]: T[K] extends DesignToken.Shape
            ? Token<T[K], R, G>
            : K extends keyof DesignToken.Group
              ? T[K]
              : T[K] extends {}
                ? TokenLibrary<T[K], R, G>
                : never;
    };

    /**
     * Any object with a `$value` of type `V`, such as a token.
     *
     * @public
     */
    export interface ValueSource<V> {
        readonly $value: V;
    }

    /**
     * A function that resolves to a value of type `V`, or to a token
     * with a value of type `V`.
     *
     * @public
     */
    export type ValueAlias<V, R> = (context: R) => V | ValueSource<V>;

    /**
     * A token value that serves as an alias to another token value
     *
     * @public
     */
    export type Alias<
        T extends DesignToken.Shape,
        R extends Context<any>,
    > = ValueAlias<DesignToken.ValueByToken<T>, R>;

    /**
     * A value whose properties and elements, at any depth, may be
     * static values or {@link (Library:namespace).ValueAlias | aliases}.
     * Supports complex token value types such as {@link DesignToken.Border}.
     *
     * @public
     */
    export type DeepAlias<V, T extends Context<any>> = V extends object
        ? {
              [K in keyof V]: V[K] | ValueAlias<V[K], T> | DeepAlias<V[K], T>;
          }
        : V;

    /**
     * Context object provided to {@link (Library:namespace).Alias} values at runtime
     *
     * @public
     */
    export type Context<T extends {}, R extends {} = T> = {
        [K in keyof Readonly<T>]: T[K] extends DesignToken.Shape
            ? Readonly<T[K]>
            : K extends keyof DesignToken.Group
              ? T[K]
              : T[K] extends {}
                ? Context<T[K], R>
                : never;
    };

    /**
     * A token in a {@link (Library:namespace).TokenLibrary}
     *
     * @remarks
     * `G` is the type inherited from ancestor groups, used when
     * `T` does not declare a `$type`.
     *
     * @public
     */
    export type Token<
        T extends DesignToken.Shape,
        C extends {},
        G extends string = never,
    > = {
        set(value: DesignToken.ValueByToken<T> | Alias<T, C>): void;
        toString(): string;
        readonly $type: DesignToken.TypeByToken<T, G>;
        readonly $extensions: Record<string, any>;
        readonly $value: DesignToken.ValueByToken<T>;
        readonly $description: string;
        /**
         * `false`, `true`, or the explanation the token was deprecated with.
         */
        readonly $deprecated: boolean | string;
        readonly name: string;
    };

    type IsUnion<T, U = T> = T extends unknown
        ? [U] extends [T]
            ? false
            : true
        : never;

    /**
     * The type a group passes on to its descendant tokens, following
     * {@link https://www.designtokens.org/tr/2025.10/format/#type-1 | DTCG group type inheritance}.
     *
     * @remarks
     * A group passes on its own `$type` only when the group's shape declares a
     * required, single, literal `$type`. A group with an optional or non-literal
     * `$type` may set any type at runtime, so it passes on nothing. A group
     * without a `$type` passes on its ancestor's type, `G`.
     *
     * @public
     */
    export type GroupType<T, G extends string = never> = "$type" extends keyof T
        ? {} extends Pick<T, "$type">
            ? never
            : T["$type"] extends string
              ? string extends T["$type"]
                  ? never
                  : true extends IsUnion<T["$type"]>
                    ? never
                    : T["$type"]
              : never
        : G;

    /**
     * The value of a token in a configuration object: a static value,
     * an {@link (Library:namespace).Alias}, or a {@link (Library:namespace).DeepAlias}.
     *
     * @public
     */
    export type ConfigTokenValue<T extends DesignToken.Shape, R extends {}> =
        | DesignToken.ValueByToken<T>
        | Library.Alias<T, Context<R>>
        | Library.DeepAlias<DesignToken.ValueByToken<T>, Context<R>>;

    /**
     * A token in a configuration object.
     *
     * @remarks
     * The token's `$type` may only be omitted when it matches the type
     * inherited from ancestor groups, `G`.
     *
     * @public
     */
    export type ConfigValue<
        T extends DesignToken.Shape,
        R extends {},
        G extends string = never,
    > =
        // `T` is included so that `T` can be inferred when `Library.create`
        // is called without a type argument.
        | T
        | (Omit<T, "$type" | "$value"> &
              ([G] extends [never]
                  ? { $type: DesignToken.TypeByToken<T> }
                  : [DesignToken.TypeByToken<T, G>] extends [G]
                    ? { $type?: DesignToken.TypeByToken<T, G> }
                    : { $type: DesignToken.TypeByToken<T> }) & {
                  $value: ConfigTokenValue<T, R>;
              });

    /**
     * A configuration object provided to {@link Library.create}
     *
     * @remarks
     * `G` is the type inherited from ancestor groups. `S` is the shape of a
     * source library being extended: its group types are inherited, and its
     * tokens may be overridden without restating their type.
     *
     * @public
     */
    export type Config<
        T extends {},
        R extends {} = T,
        G extends string = never,
        S = {},
    > = ConfigGroup<T, R, GroupType<T, GroupType<S, G>>, S>;

    // Overrides of source tokens map to `unknown` so they are validated only
    // by `ExtendConfig` and are not inferred as new tokens by `extend`.
    type ConfigGroup<T extends {}, R extends {}, G extends string, S> = {
        [K in keyof T]: K extends keyof S
            ? S[K] extends DesignToken.Shape
                ? unknown
                : ConfigEntry<T, R, G, S, K>
            : ConfigEntry<T, R, G, S, K>;
    };

    type ConfigEntry<
        T extends {},
        R extends {},
        G extends string,
        S,
        K extends keyof T,
    > = T[K] extends DesignToken.Shape
        ? ConfigValue<T[K], R, G>
        : K extends keyof DesignToken.Group
          ? T[K]
          : T[K] extends {}
            ? Config<T[K], R, G, K extends keyof S ? S[K] : {}>
            : never;

    /**
     * A configuration object provided to {@link (Library:namespace).Library.extend}.
     * All tokens and groups of the source library are optional, and token
     * values may be static values or aliases. Token types are inherited
     * from the source library.
     *
     * @public
     */
    export type ExtendConfig<T extends {}, R extends {} = T> = {
        [K in keyof T]?: T[K] extends DesignToken.Shape
            ? Omit<T[K], "$type" | "$value"> & {
                  $type?: DesignToken.TypeByToken<T[K]>;
                  $value: ConfigTokenValue<T[K], R>;
              }
            : K extends "$type"
              ? never
              : K extends keyof DesignToken.Group
                ? T[K]
                : T[K] extends {}
                  ? ExtendConfig<T[K], R>
                  : never;
    };

    /**
     * @public
     */
    export const create = <T extends NoRoot<T> = any>(
        config: Library.Config<T, T>,
    ): Library.Library<T> => {
        // The runtime library is untyped; its shape is guaranteed by `config`.
        return LibraryImpl.create(config) as unknown as Library.Library<T>;
    };
}

/**
 * A configuration object as processed at runtime, after type checking.
 */
type RawConfig = { readonly [key: string]: any };

/**
 * A token library or group as built at runtime.
 */
type RawLibrary = { [key: string]: any };

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
 * enumerable, so they never appear as children when a group is walked, and
 * they let extending libraries resolve inherited types.
 */
const defineGroupMetadata = (
    group: RawLibrary,
    ...sources: RawConfig[]
): void => {
    for (const property of GROUP_METADATA) {
        for (const source of sources) {
            if (source[property] !== undefined) {
                Reflect.defineProperty(group, property, {
                    value: source[property],
                });
                break;
            }
        }
    }
};

const defineToken = (
    library: RawLibrary,
    key: string,
    token: Library.Token<any, any>,
): void => {
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

const createToken = (
    key: string,
    name: string,
    config: DesignToken.Any,
    context: RawLibrary,
    typeContext: string | null,
    queue: IQueue<Library.Token<DesignToken.Any, any>>,
): LibraryToken<any> => {
    for (const property of Object.keys(config)) {
        if (!property.startsWith("$")) {
            throw new Error(
                `"${name}" has a $value, so it is a token and cannot have a child "${property}".`,
            );
        }
    }

    const { $value, $type, $description, $extensions, $deprecated } = config;
    const resolvedType = $type || typeContext;
    if (!resolvedType) {
        throw new Error(
            `No '$type' found for token '${key}'. Types cannot be inferred, please add a $type to the token or to a group ancestor.`,
        );
    }

    return new LibraryToken(
        name,
        $value,
        resolvedType,
        context,
        $description || "",
        $extensions || {},
        $deprecated ?? false,
        queue,
    );
};

const recurseCreate = (
    name: string,
    library: RawLibrary,
    config: RawConfig,
    context: RawLibrary,
    typeContext: string | null,
    queue: IQueue<Library.Token<DesignToken.Any, any>>,
): void => {
    defineGroupMetadata(library, config);
    typeContext = config.$type || typeContext;

    for (const key in config) {
        if (!isChildKey(key)) {
            continue;
        }

        const _name = name.length === 0 ? key : `${name}.${key}`;

        if (isGroup(config[key])) {
            const group = {};
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
                queue,
            );
            Object.freeze(group);
        } else if (isToken(config[key])) {
            defineToken(
                library,
                key,
                createToken(
                    key,
                    _name,
                    config[key],
                    context,
                    typeContext,
                    queue,
                ),
            );
        }
    }
};

const recurseExtend = (
    name: string,
    sourceTokens: RawLibrary,
    extendedTokens: RawLibrary,
    config: RawConfig,
    context: RawLibrary,
    typeContext: string | null,
    queue: IQueue<Library.Token<DesignToken.Any, any>>,
): void => {
    // The source library's group type takes precedence; `$type` cannot be changed by extension
    const groupType = Reflect.get(sourceTokens, "$type") || config.$type;
    defineGroupMetadata(
        extendedTokens,
        { $type: groupType },
        // An extension may restate the group's other metadata.
        { ...config, $type: undefined },
        sourceTokens,
    );
    typeContext = groupType || typeContext;

    const keys = new Set(
        Object.keys(sourceTokens)
            .concat(Object.keys(config))
            .filter(isChildKey),
    ); // Remove duplicate keys

    for (const key of keys) {
        const _name = name.length === 0 ? key : `${name}.${key}`;
        const sourceHasKey = key in sourceTokens;
        const sourceValue = sourceTokens[key];
        const configValue = config[key];

        if (sourceHasKey ? isGroup(sourceValue) : isGroup(configValue)) {
            const group = {};
            Reflect.defineProperty(extendedTokens, key, {
                value: group,
                enumerable: true,
            });

            if (sourceHasKey) {
                recurseExtend(
                    _name,
                    sourceValue as RawLibrary,
                    group,
                    configValue || {},
                    context,
                    typeContext,
                    queue,
                );
            } else {
                recurseCreate(
                    _name,
                    group,
                    configValue,
                    context,
                    typeContext,
                    queue,
                );
            }
            Object.freeze(group);
        } else if (sourceHasKey ? isToken(sourceValue) : isToken(configValue)) {
            const token = sourceHasKey
                ? extendToken(
                      sourceValue as Library.Token<any, any>,
                      context,
                      queue,
                      configValue,
                  )
                : createToken(
                      key,
                      _name,
                      configValue,
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
    extendingToken.resolving = false;
    extendingToken.notifying = false;
    // Its own dependencies; sharing the source's set would let either token
    // drop the other's subscriptions.
    extendingToken.subscriptions = new Set();
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

const recurseResolve = (value: any, context: Library.Context<any>): any => {
    if (Array.isArray(value)) {
        const r = new Array(value.length);
        for (let i = 0; i < value.length; i++) {
            let v = value[i];

            if (isAlias(v)) {
                v = v(context);
            }

            if (v instanceof LibraryToken) {
                v = v.$value;
            }

            r[i] = isObject(v) ? recurseResolve(v, context) : v;
        }
        return r;
    }

    const r: any = {};
    for (const key in value) {
        let v = value[key];

        if (isAlias(v)) {
            v = v(context);
        }

        // Only unwrap library tokens. Plain objects with a `value` key are
        // data, e.g. a custom token value.
        if (v instanceof LibraryToken) {
            v = v.$value;
        }

        if (isObject(v)) {
            r[key] = recurseResolve(v, context);
        } else {
            r[key] = v;
        }
    }

    return r;
};

const assertNoRoot = (config: RawConfig): void => {
    if ("$root" in config) {
        throw new Error(
            `"$root" is the token of a group, so it cannot be at the top level of a library.`,
        );
    }
};

/**
 * The runtime library. It is untyped internally; {@link Library.create}
 * exposes it through the typed {@link (Library:namespace).Library} interface.
 */
class LibraryImpl implements Library.Library<any> {
    constructor(
        public readonly tokens: RawLibrary,
        private readonly queue: IQueue<Library.Token<any, any>>,
    ) {}
    public subscribe(subscriber: Library.Subscriber<any>) {
        this.queue.subscribe(subscriber);
    }
    public unsubscribe(subscriber: Library.Subscriber<any>) {
        this.queue.unsubscribe(subscriber);
    }

    public extend(config: RawConfig): LibraryImpl {
        assertNoRoot(config);
        const queue = new Queue();
        const tokens: RawLibrary = {};
        recurseExtend("", this.tokens, tokens, config, tokens, null, queue);

        return new LibraryImpl(tokens, queue);
    }

    public static create(config: RawConfig): LibraryImpl {
        assertNoRoot(config);
        const queue = new Queue();
        const tokens: RawLibrary = {};
        recurseCreate("", tokens, config, tokens, null, queue);

        return new LibraryImpl(tokens, queue);
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
    private resolving = false;
    private notifying = false;
    private subscriptions: Set<INotifier<any>> = new Set();

    constructor(
        public readonly name: string,
        value: DesignToken.ValueByToken<T> | Library.Alias<T, any>,
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
            const raw = isAlias(this.raw) ? this.raw(this.context) : this.raw;
            const normalized = raw instanceof LibraryToken ? raw.$value : raw;

            const value = isObject(normalized)
                ? recurseResolve(normalized, this.context)
                : normalized;

            this.cached = value;

            return value;
        } finally {
            this.resolving = false;
            stopWatching();
        }
    }

    public set(value: DesignToken.ValueByToken<T> | Library.Alias<T, any>) {
        this.raw = value;
        this.onChange();
    }

    public onChange(): void {
        // A circular reference that threw while resolving still leaves the
        // tokens subscribed to each other, so don't notify re-entrantly.
        if (this.notifying) {
            return;
        }

        this.notifying = true;

        try {
            this.queue.add(this);

            this.cached = empty;
            getNotifier(this).notify();
        } finally {
            this.notifying = false;
        }
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
