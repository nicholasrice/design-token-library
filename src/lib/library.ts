import { COMPUTED, RECIPE, isComputed } from "./recipe.js";
import { REF, isRef } from "./ref.js";
import { DesignToken } from "./design-token.js";
import { INotifier, ISubscriber, getNotifier } from "./notifier.js";
import { IQueue, Queue } from "./queue.js";
import { empty, isToken } from "./utilities.js";
import { IWatcher, Watcher } from "./watcher.js";

/**
 * The key of the phantom type of a ref and a computed value: what each
 * resolves to, in a library of what shape. It's never set.
 */
declare const RESOLVES: unique symbol;

/**
 * @public
 */
export namespace Library {
    export interface Library<T extends {}, R extends {} = T> {
        tokens: TokenLibrary<T, R>;
        subscribe(subscriber: Library.Subscriber<R>): void;
        unsubscribe(subscriber: Library.Subscriber<R>): void;
        /**
         * Creates a library with the values of the tokens replaced, and
         * recipes overridden.
         *
         * @remarks
         * This has no tokens to add, so a value is checked against the type
         * of its token wherever the token is.
         */
        extend(
            config: ExtendConfig<T, R>,
            options?: ExtendOptions,
        ): Library<T, R>;
        /**
         * Creates a library with the values of tokens replaced, new tokens,
         * and recipes overridden.
         */
        extend<K extends NoRoot<K> = {}>(
            config: ExtendConfig<T, R & NewTokens<K, T>> &
                Config<K, R & NewTokens<K, T>, never, T> &
                NoInfer<ConfigValueCheck<K, R & NewTokens<K, T>>> &
                (ConfigTypeHint | {}),
            options?: ExtendOptions,
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
     * The value type of each token of a library of shape `T`, by its path.
     * Refs and computed values are typed by it, so they're given only to a
     * library that has their tokens, with values of the same types, whether
     * its shape is declared or inferred from its config.
     *
     * @public
     */
    export type TokenValues<T> = {
        [K in keyof T as K extends keyof DesignToken.Group
            ? never
            : K]: T[K] extends DesignToken.Shape
            ? DesignToken.ValueByToken<T[K]>
            : T[K] extends object
              ? TokenValues<T[K]>
              : never;
    };

    /**
     * A reference to a token of a library whose token values are `T` and
     * whose value is of type `V`. It's resolved to the token's value when the token that has it is
     * read. Made by {@link refs}.
     *
     * @remarks
     * A ref is data: the path of its token. `T`, the
     * {@link (Library:namespace).TokenValues} of the library, is only in its
     * type, so that a ref can only be given to a library that has its token.
     *
     * @public
     */
    export interface Ref<V, T> {
        readonly [REF]: readonly string[];
        readonly [RESOLVES]?: (library: T) => V;
    }

    /**
     * A value of type `V` computed by a {@link (Library:namespace).Recipe}
     * from its arguments, which may refer to the tokens of a library whose
     * {@link (Library:namespace).TokenValues} are `T`. It's computed when the token that has it is read.
     *
     * @remarks
     * A computed value is data: the recipe and its arguments.
     *
     * @public
     */
    export interface Computed<V, T> {
        readonly [COMPUTED]: {
            readonly recipe: Recipe<any, unknown>;
            readonly args: readonly unknown[];
        };
        readonly [RESOLVES]?: (library: T) => V;
    }

    /**
     * A value of type `V` in a configuration: the value, a
     * {@link (Library:namespace).Ref}, a {@link (Library:namespace).Computed}
     * value, or, when `V` is an object or an array, `V` with any of its
     * properties and elements, at any depth, given as one of those.
     *
     * @public
     */
    export type DeepValue<V, T> =
        | V
        | Ref<V, T>
        | Computed<V, T>
        | (V extends object ? { [K in keyof V]: DeepValue<V[K], T> } : never);

    /**
     * The arguments of a {@link (Library:namespace).Recipe} whose function has
     * the parameters `A`. Each may be a ref, a computed value, or a value with
     * them in it.
     *
     * @public
     */
    export type RecipeArguments<A extends readonly unknown[], T> = {
        [K in keyof A]: DeepValue<A[K], T>;
    };

    /**
     * A function, made by {@link recipes}, that takes the arguments of a
     * function with parameters `A` and result `V`, any of which may refer to
     * tokens, and returns the {@link (Library:namespace).Computed} result.
     * `T` is the shape of the library its arguments refer to.
     *
     * @remarks
     * A recipe has its name and its function, which a library that extends
     * another can override with {@link override}.
     *
     * @public
     */
    export type Recipe<A extends readonly unknown[], V> = (<T extends {} = {}>(
        ...args: RecipeArguments<A, T>
    ) => Computed<V, T>) & {
        readonly [RECIPE]: {
            readonly name: string;
            readonly fn: (...args: A) => V;
        };
    };

    /**
     * The {@link (Library:namespace).Recipe | recipes} of the functions of `F`,
     * by the same keys. Made by {@link recipes}.
     *
     * @public
     */
    export type Recipes<F extends Record<string, (...args: any[]) => unknown>> =
        {
            readonly [K in keyof F]: Recipe<Parameters<F[K]>, ReturnType<F[K]>>;
        };

    /**
     * A function that replaces a recipe's in a library made by
     * `extend()`. Made by {@link override}.
     *
     * @public
     */
    export interface RecipeOverride {
        readonly recipe: Recipe<any, unknown>;
        readonly fn: (...args: any[]) => unknown;
    }

    /**
     * Options of `extend()`.
     *
     * @public
     */
    export interface ExtendOptions {
        /**
         * Recipes whose function is replaced in the new library, for every
         * token that computes its value with them, including the tokens it
         * doesn't restate.
         */
        readonly recipes?: readonly RecipeOverride[];
    }

    /**
     * A {@link (Library:namespace).Ref} to each token of a library of shape
     * `R`, at the path of the token in `T`, the shape of a group of it. Made by
     * {@link refs}.
     *
     * @public
     */
    export type Refs<T extends {}, R extends {} = T> = {
        readonly [K in keyof T as K extends keyof DesignToken.Group
            ? never
            : K]-?: T[K] extends DesignToken.Shape
            ? Ref<DesignToken.ValueByToken<T[K]>, TokenValues<R>>
            : T[K] extends {}
              ? Refs<T[K], R>
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
        set(value: ConfigTokenValue<T, C>): void;
        /**
         * A JSON representation of the token's name, type, resolved value,
         * description, extensions and deprecation.
         */
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
     * The value of a token in a configuration object, in a library of shape
     * `R`: a {@link (Library:namespace).DeepValue} of the token's value type.
     *
     * @public
     */
    export type ConfigTokenValue<
        T extends DesignToken.Shape,
        R extends {},
    > = DeepValue<DesignToken.ValueByToken<T>, TokenValues<R>>;

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
            : T[K] extends null | undefined
              ? T[K]
              : never;

    /**
     * Checks the `$value` of each token in a config of shape `T` against
     * its `$type`. It's needed when `T` is inferred from the config, because
     * the inferred `$value` is the config's own value, so
     * {@link (Library:namespace).Config} alone can't reject it.
     *
     * @remarks
     * Only the values of tokens that declare a {@link DesignToken.Type} are
     * checked. A token can't have a child (a key without a `$` prefix).
     *
     * Tokens are found by their keys rather than by `T[K] extends Shape`,
     * which TypeScript doesn't resolve for an inferred `T` with extra keys.
     * An `any` config, such as `Library.create<any>()`, isn't checked.
     *
     * @public
     */
    export type ConfigValueCheck<T, R extends {}> = 0 extends 1 & T
        ? unknown
        : {
              [K in keyof T]: 0 extends 1 & T[K]
                  ? unknown
                  : "$value" extends keyof T[K]
                    ? ("$type" extends keyof T[K]
                          ? TokenValueCheck<
                                T[K][Extract<"$type", keyof T[K]>],
                                R
                            >
                          : unknown) & {
                          [P in Exclude<keyof T[K], `$${string}`>]?: never;
                      }
                    : T[K] extends object
                      ? ConfigValueCheck<T[K], R>
                      : unknown;
          };

    type TokenValueCheck<Type, R extends {}> = [Type] extends [
        keyof DesignToken.ValueByType,
    ]
        ? {
              $value: ConfigTokenValue<
                  { $type: Type; $value: DesignToken.ValueByType[Type] },
                  R
              >;
          }
        : unknown;

    /**
     * Gives each `$type` in a config literal a contextual type, so that
     * TypeScript keeps an inferred `$type` literal, such as
     * `DesignToken.Type.Color`, instead of widening it to `DesignToken.Type`.
     * {@link (Library:namespace).ConfigValueCheck} needs the literal.
     *
     * @remarks
     * Configs are typed `ConfigTypeHint | {}`, so a config without an index
     * signature, such as a typed variable, is still accepted.
     *
     * @public
     */
    export type ConfigTypeHint = {
        readonly [key: string]:
            | ConfigTypeHint
            | DesignToken.Type
            | (string & {})
            | number
            | boolean
            | object
            | null
            | undefined;
    };

    /**
     * A configuration object provided to {@link (Library:namespace).Library.extend}.
     * All tokens and groups of the source library are optional, and token
     * values may be static values, refs or computed values. Token types are inherited
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
        config: Library.Config<T, T> &
            NoInfer<ConfigValueCheck<T, T>> &
            (ConfigTypeHint | {}),
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

/**
 * What the values of a library's tokens are resolved in: its tokens, and the
 * functions that replace recipes in it.
 */
interface Scope {
    readonly tokens: RawLibrary;
    readonly recipes: ReadonlyMap<
        Library.Recipe<any, unknown>,
        (...args: any[]) => unknown
    >;
}

/**
 * Thrown when reading a token whose value refers back to itself through
 * one or more refs or computed values.
 *
 * @public
 */
export class CircularReferenceError extends Error {
    public override readonly name = "CircularReferenceError";

    /**
     * The names of the tokens in the cycle, starting and ending with the
     * same token.
     */
    public readonly chain: string[];

    constructor(chain: string[]) {
        super(`Circular reference: ${chain.join(" → ")}`);
        this.chain = chain;
    }
}

/**
 * The tokens currently resolving their values, outermost first.
 */
const resolving: LibraryToken<any>[] = [];

const isObject = <T>(value: T): value is T & {} => {
    return typeof value === "object" && value !== null;
};

const isGroup = (
    value: DesignToken.Group | any,
): value is DesignToken.Group => {
    return isObject(value) && !Array.isArray(value) && !isToken(value);
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
            // Token access is tracked because a ref reads its token from
            // the library
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
    scope: Scope,
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
        scope,
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
    scope: Scope,
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
            recurseCreate(_name, group, config[key], scope, typeContext, queue);
            Object.freeze(group);
        } else if (isToken(config[key])) {
            defineToken(
                library,
                key,
                createToken(key, _name, config[key], scope, typeContext, queue),
            );
        }
    }
};

const recurseExtend = (
    name: string,
    sourceTokens: RawLibrary,
    extendedTokens: RawLibrary,
    config: RawConfig,
    scope: Scope,
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
                    scope,
                    typeContext,
                    queue,
                );
            } else {
                recurseCreate(
                    _name,
                    group,
                    configValue,
                    scope,
                    typeContext,
                    queue,
                );
            }
            Object.freeze(group);
        } else if (sourceHasKey ? isToken(sourceValue) : isToken(configValue)) {
            const token = sourceHasKey
                ? extendToken(
                      sourceValue as Library.Token<any, any>,
                      scope,
                      queue,
                      configValue,
                  )
                : createToken(
                      key,
                      _name,
                      configValue,
                      scope,
                      typeContext,
                      queue,
                  );
            defineToken(extendedTokens, key, token);
        }
    }
};

function extendToken(
    token: Library.Token<any, any>,
    scope: Scope,
    queue: IQueue<any>,
    node?: Record<string, any>,
) {
    const extendingToken = Object.create(token);
    extendingToken.scope = scope;
    extendingToken.cached = empty;
    extendingToken.resolving = false;
    extendingToken.notifying = false;
    // Its own dependencies; sharing the source's set would let either token
    // drop the other's subscriptions.
    extendingToken.subscriptions = new Set();
    extendingToken.previousSubscriptions = null;
    extendingToken.watchContext = extendingToken;
    extendingToken.queue = queue;

    // An extension can restate the token's metadata along with its value.
    if (node?.$description !== undefined) {
        extendingToken._description = node.$description;
    }
    // A new object, so mutating it can't leak to the source or the override.
    extendingToken._extensions = { ...token.$extensions, ...node?.$extensions };
    if (node?.$deprecated !== undefined) {
        extendingToken._deprecated = node.$deprecated;
    }

    if (node !== undefined && "$value" in node) {
        assertNotFunction(token.name, node.$value);
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

/**
 * Tests whether a value is plain data that may contain refs and computed values: an object
 * literal (or one without a prototype). Any other object, such as a class
 * instance, a `Date` or a `Map`, is a value as it is.
 */
const isPlainObject = (value: unknown): value is Record<string, unknown> => {
    if (typeof value !== "object" || value === null) {
        return false;
    }

    const prototype = Object.getPrototypeOf(value);

    return prototype === Object.prototype || prototype === null;
};

/**
 * The token at a path of a library. Each group and the token are read from
 * the library, so the token that reads it depends on it.
 */
const tokenAt = (
    tokens: RawLibrary,
    path: readonly string[],
): LibraryToken<any> => {
    let node: unknown = tokens;
    for (const key of path) {
        node = isObject(node) ? Reflect.get(node, key) : undefined;
    }

    if (!(node instanceof LibraryToken)) {
        throw new Error(`The library has no token "${path.join(".")}".`);
    }

    return node;
};

/**
 * Resolves a value: a ref is replaced by its token's value, and a computed
 * value by the result of its recipe's function, or of the function that
 * overrides it in the scope. Arrays and plain objects are copied with their
 * refs and computed values resolved, at any depth. Anything else is returned
 * as it is.
 */
const resolve = (value: unknown, scope: Scope): unknown => {
    if (isRef(value)) {
        return resolve(tokenAt(scope.tokens, value[REF]).$value, scope);
    }

    if (isComputed(value)) {
        const { recipe, args } = value[COMPUTED];
        const fn = scope.recipes.get(recipe) ?? recipe[RECIPE].fn;

        return resolve(fn(...args.map((arg) => resolve(arg, scope))), scope);
    }

    if (Array.isArray(value)) {
        const resolved = new Array(value.length);
        for (let i = 0; i < value.length; i++) {
            resolved[i] = resolve(value[i], scope);
        }
        return resolved;
    }

    if (isPlainObject(value)) {
        const resolved: Record<string, unknown> = {};
        for (const key of Object.keys(value)) {
            resolved[key] = resolve(value[key], scope);
        }
        return resolved;
    }

    return value;
};

/**
 * A function is never a token value. One given as a value is probably an
 * alias in the form that came before refs and recipes.
 */
const assertNotFunction = (name: string, value: unknown): void => {
    if (typeof value === "function") {
        throw new TypeError(
            `The value of "${name}" is a function. A reference to a token is a ref, as in refs<Theme>().colors.primary, and a computed value is a recipe's.`,
        );
    }
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
    public readonly tokens: RawLibrary;

    constructor(
        private readonly scope: Scope,
        private readonly queue: IQueue<Library.Token<any, any>>,
    ) {
        this.tokens = scope.tokens;
        // Groups are frozen as they are built; the root is frozen here.
        Object.freeze(this.tokens);
    }
    public subscribe(subscriber: Library.Subscriber<any>) {
        this.queue.subscribe(subscriber);
    }
    public unsubscribe(subscriber: Library.Subscriber<any>) {
        this.queue.unsubscribe(subscriber);
    }

    public extend(
        config: RawConfig,
        options: Library.ExtendOptions = {},
    ): LibraryImpl {
        assertNoRoot(config);
        const queue = new Queue();
        const recipes = new Map(this.scope.recipes);
        for (const { recipe, fn } of options.recipes ?? []) {
            recipes.set(recipe, fn);
        }
        const scope: Scope = { tokens: {}, recipes };
        recurseExtend(
            "",
            this.tokens,
            scope.tokens,
            config,
            scope,
            null,
            queue,
        );

        return new LibraryImpl(scope, queue);
    }

    public static create(config: RawConfig): LibraryImpl {
        assertNoRoot(config);
        const queue = new Queue();
        const scope: Scope = { tokens: {}, recipes: new Map() };
        recurseCreate("", scope.tokens, config, scope, null, queue);

        return new LibraryImpl(scope, queue);
    }
}

/**
 * An individual token value in a library
 */
class LibraryToken<T extends DesignToken.Any>
    implements Library.Token<any, any>, ISubscriber<unknown>, IWatcher
{
    private raw: Library.ConfigTokenValue<T, any>;
    private cached: DesignToken.ValueByToken<T> | typeof empty = empty;
    private resolving = false;
    private notifying = false;
    private subscriptions: Set<INotifier<any>> = new Set();
    /**
     * While resolving, the subscriptions from the previous resolution. Sources
     * watched again keep their subscription instead of re-subscribing.
     */
    private previousSubscriptions: Set<INotifier<any>> | null = null;
    private readonly _extensions: Record<string, any>;

    constructor(
        public readonly name: string,
        value: Library.ConfigTokenValue<T, any>,
        private readonly _type: DesignToken.TypeByToken<T>,
        private readonly scope: Scope,
        private readonly _description: string,
        extensions: Record<string, any>,
        private readonly _deprecated: boolean | string,
        private queue: IQueue<Library.Token<DesignToken.Any, any>>,
    ) {
        assertNotFunction(name, value);
        this.raw = value;
        // A copy, so changing the config's top-level keys can't change the token.
        this._extensions = { ...extensions };
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
            const chain = resolving
                .slice(resolving.indexOf(this))
                .map((token) => token.name);

            throw new CircularReferenceError([...chain, this.name]);
        }

        const previous = this.subscriptions;
        this.previousSubscriptions = previous;
        this.subscriptions = new Set();
        this.resolving = true;
        resolving.push(this);
        const stopWatching = Watcher.use(this);

        try {
            // The config's types guarantee what the raw value resolves to.
            const value = resolve(
                this.raw,
                this.scope,
            ) as DesignToken.ValueByToken<T>;

            this.cached = value;

            return value;
        } finally {
            this.resolving = false;
            resolving.pop();
            stopWatching();
            this.previousSubscriptions = null;

            // Unsubscribe from sources that were not watched this time.
            for (const notifier of previous) {
                if (!this.subscriptions.has(notifier)) {
                    notifier.unsubscribe(this);
                }
            }
        }
    }

    public toString(): string {
        return JSON.stringify({
            name: this.name,
            $type: this.$type,
            $value: this.$value,
            $description: this.$description,
            $extensions: this.$extensions,
            $deprecated: this.$deprecated,
        });
    }

    public set(value: Library.ConfigTokenValue<T, any>) {
        assertNotFunction(this.name, value);
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

        if (this.subscriptions.has(notifier)) {
            return;
        }

        this.subscriptions.add(notifier);

        if (!this.previousSubscriptions?.has(notifier)) {
            notifier.subscribe(this);
        }
    }
}
