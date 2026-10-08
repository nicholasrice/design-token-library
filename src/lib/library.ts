import { DesignToken } from "./design-token.js";
import { INotifier, ISubscriber, getNotifier } from "./notifier.js";
import { IQueue, Queue } from "./queue.js";
import { empty } from "./utilities.js";
import { IWatcher, Watcher } from "./watcher.js";

/**
 * @public
 */
export namespace Library {
    export interface Library<T extends {}, R extends {} = T> {
        tokens: TokenLibrary<T, R>;
        subscribe(subscriber: Library.Subscriber<R>): void;
        unsubscribe(subscriber: Library.Subscriber<R>): void;
        extend<K extends {} = {}>(
            config: ExtendConfig<T, R & K> & Config<K, R & K, never, T>,
        ): Library<T & K, R & K>;
    }

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
            : K extends "type"
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
            : K extends "type"
              ? T[K]
              : T[K] extends {}
                ? TokenLibrary<T[K], R, G>
                : never;
    };

    /**
     * Any object with a `value` of type `V`, such as a token.
     *
     * @public
     */
    export interface ValueSource<V> {
        readonly value: V;
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
            : K extends "type"
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
     * `T` does not declare a `type`.
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
        readonly type: DesignToken.TypeByToken<T, G>;
        readonly extensions: Record<string, any>;
        readonly value: DesignToken.ValueByToken<T>;
        readonly description: string;
        readonly name: string;
    };

    type IsUnion<T, U = T> = T extends unknown
        ? [U] extends [T]
            ? false
            : true
        : never;

    /**
     * The type a group passes on to its descendant tokens, following
     * {@link https://tr.designtokens.org/format/#type-1 | DTWG group type inheritance}.
     *
     * @remarks
     * A group passes on its own `type` only when the group's shape declares a
     * required, single, literal `type`. A group with an optional or non-literal
     * `type` may set any type at runtime, so it passes on nothing. A group
     * without a `type` passes on its ancestor's type, `G`.
     *
     * @public
     */
    export type GroupType<T, G extends string = never> = "type" extends keyof T
        ? {} extends Pick<T, "type">
            ? never
            : T["type"] extends string
              ? string extends T["type"]
                  ? never
                  : true extends IsUnion<T["type"]>
                    ? never
                    : T["type"]
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
     * The token's `type` may only be omitted when it matches the type
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
        | (Omit<T, "type" | "value"> &
              ([G] extends [never]
                  ? { type: DesignToken.TypeByToken<T> }
                  : [DesignToken.TypeByToken<T, G>] extends [G]
                    ? { type?: DesignToken.TypeByToken<T, G> }
                    : { type: DesignToken.TypeByToken<T> }) & {
                  value: ConfigTokenValue<T, R>;
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

    type ConfigGroup<T extends {}, R extends {}, G extends string, S> = {
        [K in keyof T]: T[K] extends DesignToken.Shape
            ? ConfigValue<
                  T[K],
                  R,
                  K extends keyof S
                      ? S[K] extends DesignToken.Shape
                          ? DesignToken.TypeByToken<S[K], G>
                          : G
                      : G
              >
            : K extends "type"
              ? T[K]
              : T[K] extends {}
                ? Config<T[K], R, G, K extends keyof S ? S[K] : {}>
                : never;
    };

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
            ? Omit<T[K], "type" | "value"> & {
                  type?: DesignToken.TypeByToken<T[K]>;
                  value: ConfigTokenValue<T[K], R>;
              }
            : K extends "type"
              ? never
              : T[K] extends {}
                ? ExtendConfig<T[K], R>
                : never;
    };

    /**
     * @public
     */
    export const create = <T extends {} = any>(
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

/**
 * Stores a group's declared type on the library group so that extending
 * libraries can resolve inherited types. Non-enumerable so that group
 * iteration only visits tokens and child groups.
 */
const defineGroupType = (group: RawLibrary, type: string | undefined): void => {
    if (type !== undefined) {
        Reflect.defineProperty(group, "type", { value: type });
    }
};

const getGroupType = (group: object): string | undefined => {
    return Reflect.get(group, "type");
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
    const { value, type, description, extensions } = config;
    const resolvedType = type || typeContext;
    if (!resolvedType) {
        throw new Error(
            `No 'type' found for token '${key}'. Types cannot be inferred, please add a type to the token or to a group ancestor.`,
        );
    }

    return new LibraryToken(
        name,
        value,
        resolvedType,
        context,
        description || "",
        extensions || {},
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
    defineGroupType(library, config.type);
    typeContext = config.type || typeContext;

    for (const key in config) {
        if (key === "type") {
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
    // The source library's group type takes precedence; `type` cannot be changed by extension
    const groupType = getGroupType(sourceTokens) || config.type;
    defineGroupType(extendedTokens, groupType);
    typeContext = groupType || typeContext;

    const keys = new Set(Object.keys(sourceTokens).concat(Object.keys(config))); // Remove duplicate keys

    for (const key of keys) {
        if (key === "type") {
            continue;
        }

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
                      configValue?.value,
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

        // Only unwrap library tokens. Plain objects with a `value` key are
        // data, e.g. a custom token value.
        if (v instanceof LibraryToken) {
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
        const queue = new Queue();
        const tokens: RawLibrary = {};
        recurseExtend("", this.tokens, tokens, config, tokens, null, queue);

        return new LibraryImpl(tokens, queue);
    }

    public static create(config: RawConfig): LibraryImpl {
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
        const normalized = raw instanceof LibraryToken ? raw.value : raw;

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
