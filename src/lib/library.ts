import { COMPUTED, RECIPE, isComputed } from "./recipe.js";
import { REF, isRef } from "./ref.js";
import { DesignToken } from "./design-token.js";
import { Equality, isStandardType, standardEquality } from "./equality.js";
import { Graph } from "./graph.js";
import { IQueue, Queue } from "./queue.js";
import { empty, isObject, isToken } from "./utilities.js";

/**
 * The key of the phantom type of a ref: what it resolves to, in a library of
 * what shape. It's never set.
 */
declare const RESOLVES: unique symbol;

/**
 * The key of the phantom type of a computed value, apart from a ref's, so
 * that a ref's type is never inferred from a computed value's.
 */
declare const COMPUTES: unique symbol;

/**
 * The key of the phantom type that marks a token in
 * {@link (Library:namespace).TokenValues}. It's never set.
 */
declare const TOKEN: unique symbol;

/**
 * @public
 */
export namespace Library {
    export interface Library<T extends {}, R extends {} = T> {
        tokens: TokenLibrary<T, R>;
        /**
         * Adds a subscriber, which is told of each change made after it's
         * added.
         *
         * @remarks
         * A library with a subscriber resolves its tokens, and a `set()`
         * resolves again the tokens it reaches. An extension resolves its
         * own tokens, and its subscriber is told of them; with
         * `origin: "ancestor"` or `"all"`, it resolves its ancestor's tokens
         * too, and the subscriber is told of those whose values change.
         */
        subscribe(
            subscriber: Library.Subscriber<R>,
            options?: Library.SubscribeOptions,
        ): void;
        unsubscribe(subscriber: Library.Subscriber<R>): void;
        /**
         * Creates a library with the values of the tokens replaced, and
         * recipes overridden.
         *
         * @remarks
         * This has no tokens to add, so a value is checked against the type
         * of its token wherever the token is.
         *
         * A token of the extension is made when it is first read, and an
         * extension that nothing refers to is collected, along with its
         * subscribers.
         */
        extend(
            config: ExtendConfig<T, R>,
            ...options: ExtendArgs<{}, T>
        ): Library<T, R>;
        /**
         * Creates a library with the values of tokens replaced, new tokens,
         * and recipes overridden.
         *
         * @remarks
         * A token of the extension is made when it is first read, and an
         * extension that nothing refers to is collected, along with its
         * subscribers.
         */
        extend<K extends NoRoot<K> = {}>(
            config: ExtendConfig<T, R & NewTokens<K, T>> &
                Config<K, R & NewTokens<K, T>, never, T> &
                NoInfer<ConfigValueCheck<K, R & NewTokens<K, T>>> &
                (ConfigTypeHint | {}),
            ...options: ExtendArgs<NewTokens<K, T>, T>
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

    /**
     * Which entries of a library {@link (entriesOf:3)} lists: its tokens, its
     * groups, or both. Each is the `kind` of the entries it lists.
     *
     * @public
     */
    export type Show = "all" | "token" | "group";

    /**
     * A token of a library, with the path of keys that leads to it from the
     * root. The path of a group's own token ends with `$root`.
     *
     * @public
     */
    export interface TokenEntry<R extends {}> {
        readonly kind: "token";
        readonly path: readonly string[];
        readonly token: TokenRecord<R>;
    }

    /**
     * A group of a library, with the path of keys that leads to it from the
     * root. The group has the `$`-prefixed properties it was configured with.
     *
     * @public
     */
    export interface GroupEntry {
        readonly kind: "group";
        readonly path: readonly string[];
        readonly group: Readonly<DesignToken.Group>;
    }

    /**
     * The entries that {@link (entriesOf:3)} lists for `S`.
     *
     * @public
     */
    export type EntryOf<S extends Show, R extends {}> = S extends "token"
        ? TokenEntry<R>
        : S extends "group"
          ? GroupEntry
          : TokenEntry<R> | GroupEntry;

    /**
     * What a {@link (entriesOf:3)} filter returns for an entry: `true` lists it,
     * `false` leaves it out, and `"reject"` leaves it out along with
     * everything under it.
     *
     * @public
     */
    export type FilterResult = boolean | "reject";

    /**
     * @public
     */
    export interface EntriesOptions<S extends Show, R extends {}> {
        /**
         * The kind of entries to list. Groups are visited, and their tokens
         * listed, whichever it is. By default, all.
         */
        readonly whatToShow?: S;
        /**
         * Called with each entry of the kinds shown, before its children are
         * visited.
         */
        filter?(entry: EntryOf<S, R>): FilterResult;
    }

    /**
     * What changed of a token, in a batch.
     *
     * @public
     */
    export interface Change<R extends {}> {
        /**
         * The token, of the library subscribed to.
         */
        readonly token: TokenRecord<R>;
        /**
         * Its value changed.
         */
        readonly valueChanged: boolean;
        /**
         * Where its value comes from: an extension's own token, or one whose
         * value is its ancestor's. Always `"own"` in a library made by
         * `create()`.
         */
        readonly origin: "ancestor" | "own";
        /**
         * Its origin changed: an extension's token became its own.
         */
        readonly originChanged: boolean;
    }

    /**
     * @public
     */
    export interface SubscribeOptions {
        /**
         * Which tokens a subscriber is told of, by where their values come
         * from, as {@link (Library:namespace).Change.origin} says: the
         * library's own (the default), its ancestor's, or all. A library
         * made by `create()` has only its own.
         */
        readonly origin?: "own" | "ancestor" | "all";
    }

    /**
     * @public
     */
    export interface Subscriber<R extends {}> {
        /**
         * Called with what changed, once for the changes made before a
         * microtask runs. Each change has its value or its origin changed.
         */
        onChange(changes: ReadonlyArray<Library.Change<R>>): void;
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
            ? TokenValue<DesignToken.ValueByToken<T[K]>>
            : T[K] extends object
              ? TokenValues<T[K]>
              : never;
    };

    /**
     * A token with a value of type `V`, in
     * {@link (Library:namespace).TokenValues}. It's only a type: it marks
     * where a path ends at a token rather than going into its value.
     *
     * @public
     */
    export interface TokenValue<V> {
        readonly [TOKEN]: V;
    }

    /**
     * The dotted path of each token in `T`, the
     * {@link (Library:namespace).TokenValues} of a library, whose value is a
     * `V`. These are the paths {@link ref} takes where a `V` is expected.
     *
     * @public
     */
    export type TokenPath<T, V> = {
        [K in keyof T & string]: T[K] extends TokenValue<infer W>
            ? [W] extends [V]
                ? K
                : never
            : `${K}.${TokenPath<T[K], V>}`;
    }[keyof T & string];

    /**
     * A reference to a token whose value is of type `V`, in a library whose
     * token values are `T`. It's resolved to the token's value when the token
     * that has it is read. Made by {@link ref} and {@link refs}.
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
     * {@link (Library:namespace).TokenValues} are `T`. It's computed when the
     * token that has it is read.
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
        readonly [COMPUTES]?: (library: T) => V;
    }

    /**
     * A value of type `V` in a configuration: the value, a
     * {@link (Library:namespace).Ref}, a {@link (Library:namespace).Computed}
     * value, or, when `V` is an object or an array, `V` with any of its
     * properties and elements, at any depth, given as one of those.
     *
     * @remarks
     * Its objects and arrays may be readonly, as a token's value is, so a
     * token's value can be given where a config takes a value, as `set()`
     * takes it. A computed value may be readonly, as a recipe's function that
     * takes readonly arguments returns: the library copies and freezes a
     * recipe's result.
     *
     * @public
     */
    export type DeepValue<V, T> =
        | V
        | Ref<V, T>
        | Computed<DesignToken.DeepReadonly<V>, T>
        | (V extends object
              ? { readonly [K in keyof V]: DeepValue<V[K], T> }
              : never);

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
     * `T` is the token values of the library its arguments refer to.
     *
     * @remarks
     * A recipe has its name and its function, which a library that extends
     * another can override with {@link override}. The function gets each
     * argument as a token gets its value: a ref's value, and a copy of plain
     * data, which are frozen, and anything else as it is. So its parameters
     * are typed readonly, as in `DesignToken.Values.Readonly.Color`.
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
     * A function that replaces a recipe's in a library made by `extend()`.
     * Made by {@link override}.
     *
     * @public
     */
    export interface RecipeOverride {
        readonly recipe: Recipe<any, unknown>;
        readonly fn: (...args: any[]) => unknown;
    }

    /**
     * What a library knows of a custom type: how to tell whether two of its
     * values are equal.
     *
     * @public
     */
    export interface TypeOptions<V = unknown> {
        /**
         * Tells whether a value a token of the type resolved to is equal to
         * the one it had. When it is, the token keeps the value it had, so it
         * is the same object. It's called only by a library with a
         * subscriber, and not when a token resolves its first value.
         */
        isEqual(previous: V, next: V): boolean;
    }

    /**
     * The custom types a library registers, by name. A DTCG type has its own
     * equality, so it can't be registered.
     *
     * @public
     */
    export type Types = { readonly [name: string]: TypeOptions<any> };

    /**
     * Options of `create()`.
     *
     * @public
     */
    export interface CreateOptions {
        /**
         * The custom types of the library's tokens. Every custom type a token
         * has must be registered.
         */
        readonly types?: Types;
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
        /**
         * The custom types that the extension's new tokens have and the
         * library it extends doesn't register. A type the library registers
         * is inherited, and can't be registered again.
         */
        readonly types?: Types;
    }

    /**
     * The custom type names in a library of shape `T`: the `$type` of each
     * of its tokens and groups that isn't a DTCG type.
     *
     * @public
     */
    export type CustomTypeNamesOf<T> = 0 extends 1 & T
        ? never
        : T extends readonly unknown[] | Function
          ? never
          : T extends object
            ? {
                  [K in keyof T]-?: K extends "$type"
                      ? T[K] extends string
                          ? string extends T[K]
                              ? never
                              : Exclude<
                                    T[K],
                                    | DesignToken.Type
                                    | DesignToken.ReservedTypeName
                                >
                          : never
                      : K extends `$${string}`
                        ? never
                        : CustomTypeNamesOf<T[K]>;
              }[keyof T]
            : never;

    /**
     * The values of the tokens of type `N` in a library of shape `T`, as a
     * token gives them. `G` is the type inherited from ancestor groups.
     *
     * @public
     */
    export type ValueOfType<T, N extends string, G extends string = never> = {
        [K in keyof T]-?: K extends `$${string}`
            ? never
            : T[K] extends DesignToken.Shape
              ? DesignToken.TypeByToken<T[K], G> extends N
                  ? DesignToken.ReadonlyValueByToken<T[K]>
                  : never
              : T[K] extends object
                ? ValueOfType<T[K], N, GroupType<T[K], G>>
                : never;
    }[keyof T];

    /**
     * The `types` a library of shape `T` registers: each of the custom
     * types `N` that `I`, the types it inherits, leave out.
     *
     * @public
     */
    export type TypesOf<T, N extends string, I extends string = never> = {
        readonly [P in Exclude<N, I>]: TypeOptions<ValueOfType<T, P>>;
    } & {
        readonly [P in DesignToken.ReservedTypeName | I]?: never;
    } & Types;

    /**
     * The options of `create()` for a library of shape `T`: required, with
     * its custom types, when it has any.
     *
     * @public
     */
    export type CreateArgs<T> = [CustomTypeNamesOf<T>] extends [never]
        ? [options?: CreateOptions & { readonly types?: TypesOf<T, never> }]
        : [
              options: CreateOptions & {
                  readonly types: TypesOf<T, CustomTypeNamesOf<T>>;
              },
          ];

    /**
     * The options of `extend()` for new tokens of shape `K` in a library of
     * shape `T`: required, with the custom types `T` doesn't have, when they
     * have any.
     *
     * @public
     */
    export type ExtendArgs<K, T> = [
        Exclude<CustomTypeNamesOf<K>, CustomTypeNamesOf<T>>,
    ] extends [never]
        ? [
              options?: ExtendOptions & {
                  readonly types?: TypesOf<K, never, CustomTypeNamesOf<T>>;
              },
          ]
        : [
              options: ExtendOptions & {
                  readonly types: TypesOf<
                      K,
                      CustomTypeNamesOf<K>,
                      CustomTypeNamesOf<T>
                  >;
              },
          ];

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
        set(
            value: ConfigTokenValue<T, C> | DesignToken.ReadonlyValueByToken<T>,
        ): void;
        /**
         * A JSON representation of the token's name, type, resolved value,
         * description, extensions and deprecation.
         */
        toString(): string;
        readonly $type: DesignToken.TypeByToken<T, G>;
        readonly $extensions: Record<string, any>;
        readonly $value: DesignToken.ReadonlyValueByToken<T>;
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
     * A configuration object provided to {@link (Library:namespace).Library.(extend:1)}.
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
        ...options: NoInfer<CreateArgs<T>>
    ): Library.Library<T> => {
        // The runtime library is untyped; its shape is guaranteed by `config`.
        return LibraryImpl.create(
            config,
            options[0],
        ) as unknown as Library.Library<T>;
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
 * functions that replace recipes in it, and what is known of which tokens
 * depend on which.
 */
interface Scope {
    readonly tokens: RawLibrary;
    /**
     * The scope of the library this one extends: its tokens take their
     * configured values from that library's until they are set.
     */
    readonly source?: Scope;
    readonly recipes: ReadonlyMap<
        Library.Recipe<any, unknown>,
        (...args: any[]) => unknown
    >;
    /**
     * The equality of each custom type the library registers, or inherits
     * from the library it extends.
     */
    readonly types: ReadonlyMap<string, Equality>;
    readonly queue: IQueue<LibraryToken<any>, Library.Change<any>>;
    /**
     * What the queue delivers to for each subscriber: the subscriber, or, for
     * a default subscriber of an extension, a filter that leaves out the
     * tokens that are its ancestor's.
     */
    readonly subscribers: Map<
        Library.Subscriber<any>,
        { delivered: Library.Subscriber<any>; ancestral: boolean }
    >;
    /**
     * How many subscribers of an extension are told of the tokens that are
     * its ancestor's. With any, it resolves them and queues them.
     */
    ancestral: number;
    /**
     * The tokens of an extension that are made, by name: those that are read,
     * set, given a value by its config, or new in it. A library made by
     * `create()` makes all of its tokens, and finds them in its tokens.
     */
    readonly made: Map<string, LibraryToken<any>>;
    /**
     * The tokens of an extension that have a value of their own: one its
     * config gives, or one that is set, or a token that is new in it. The
     * others have their source token's value.
     */
    readonly own: Set<string>;
    /**
     * The scopes of the libraries that extend this one. They are held weakly,
     * so that an extension that nothing refers to is collected.
     */
    readonly extensions: Set<WeakRef<Scope>>;
    /**
     * Which tokens refer to which. A token's edges are added when it is
     * resolved, or when the graph is completed for `dependentsOf()`, in the
     * scope that has its configured value.
     */
    readonly graph: Graph;
    /**
     * Whether the graph has the edges of all of the library's own tokens,
     * and its source's graph of all of its.
     */
    complete: boolean;
    /**
     * For each token, the tokens whose values resolved a ref to it in the
     * result of a recipe, which their configured values don't show.
     */
    readonly found: Map<string, Set<string>>;
    /**
     * How many of the library's tokens hold a resolved value. With none, a
     * change has nothing to invalidate in the library.
     */
    cached: number;
    /**
     * The recipes an extension replaces the function of.
     */
    readonly overridden: ReadonlySet<Library.Recipe<any, unknown>>;
    /**
     * The tokens of an extension whose values are its own: those with a
     * value of their own, those that call a recipe it overrides, and those
     * that depend on one of them. The others are its ancestor's, the same
     * objects. It's found when the extension is first subscribed or its
     * own tokens are listed, and kept from then on; a token that is its own
     * never becomes its ancestor's again.
     */
    origin: Set<string> | null;
    /**
     * The tokens of a subscribed extension that aren't its own and whose
     * configured values call a recipe: what their recipes' results call and
     * refer to can make them its own. Found with `origin`.
     */
    callers: Set<string>;
    /**
     * Whether `callers` has been found, which waits until an extension can
     * have a token of its own.
     */
    discovered: boolean;
}

/**
 * Removes the scope of a collected extension from its source's.
 */
const extensionsOf = new FinalizationRegistry<{
    source: Scope;
    extension: WeakRef<Scope>;
}>(({ source, extension }) => source.extensions.delete(extension));

const scopeOf = (
    recipes: Scope["recipes"],
    types: Scope["types"],
    source?: Scope,
    overridden: Scope["overridden"] = new Set(),
): Scope => {
    const own = new Set<string>();
    const scope: Scope = {
        tokens: {},
        source,
        recipes,
        types,
        queue: new Queue(LibraryToken.reported),
        subscribers: new Map(),
        ancestral: 0,
        callers: new Set(),
        discovered: false,
        made: new Map(),
        own,
        extensions: new Set(),
        graph: source
            ? new Graph(source.graph, (name) => own.has(name))
            : new Graph(null, () => false),
        complete: false,
        found: new Map(),
        cached: 0,
        overridden,
        origin: null,
    };

    if (source) {
        const extension = new WeakRef(scope);
        source.extensions.add(extension);
        extensionsOf.register(scope, { source, extension });
    }

    return scope;
};

/**
 * Calls `visit` with the path of each ref in a value, searched as
 * {@link resolve} resolves them: in plain data and in the arguments of
 * computed values. `resolve` walks values on its own, as it copies them, so
 * the two must search the same values.
 */
const forEachRef = (
    value: unknown,
    visit: (path: readonly string[]) => void,
): void => {
    const seen = new Set<object>();

    const walk = (value: unknown): void => {
        if (!isObject(value) || seen.has(value)) {
            return;
        }
        seen.add(value);

        if (isRef(value)) {
            visit(value[REF]);
        } else if (isComputed(value)) {
            value[COMPUTED].args.forEach(walk);
        } else if (isPlain(value)) {
            for (const key of Reflect.ownKeys(value)) {
                walk(Reflect.get(value, key));
            }
        }
    };

    walk(value);
};

/**
 * The names of the tokens that the refs in a value are to.
 */
const refsOf = (value: unknown): Set<string> => {
    const names = new Set<string>();
    forEachRef(value, (path) => names.add(path.join(".")));
    return names;
};

const none: ReadonlySet<string> = new Set();

const noInputs: readonly unknown[] = Object.freeze([]);

/**
 * What a token that isn't queued for a batch has in place of the value to
 * compare with.
 */
const unqueued = Symbol();

/**
 * The custom types of a library: those it inherits, and those it registers,
 * which can be neither a DTCG type nor one it inherits.
 */
const typesOf = (
    types: Library.Types = {},
    inherited: Scope["types"] = new Map(),
): Scope["types"] => {
    const registered = new Map(inherited);
    for (const [name, options] of Object.entries(types)) {
        if (isStandardType(name)) {
            throw new Error(
                `"${name}" is a DTCG type, which has its own equality, so it can't be registered in 'types'.`,
            );
        }
        if (inherited.has(name)) {
            throw new Error(
                `The custom type "${name}" is registered by a library this one extends, so it can't be registered again.`,
            );
        }
        if (typeof options?.isEqual !== "function") {
            throw new Error(
                `The custom type "${name}" has no isEqual function.`,
            );
        }
        registered.set(name, (a, b) => options.isEqual(a, b));
    }
    return registered;
};

/**
 * The equality of a type in a library.
 */
const equalityOf = (scope: Scope, type: string): Equality =>
    isStandardType(type) ? standardEquality[type] : scope.types.get(type)!;

/**
 * The dependents of a token found last, with the version of its library's
 * graph they were found in.
 */
const dependentsOfToken = new WeakMap<
    LibraryToken<any>,
    { version: number; dependents: readonly LibraryToken<any>[] }
>();

/**
 * The scope that has the configured value of a token of a library: the
 * library's, or that of the library it extends that the token inherits it
 * from.
 */
const ownerOf = (scope: Scope, name: string): Scope => {
    let owner = scope;
    while (owner.source !== undefined && !owner.own.has(name)) {
        owner = owner.source;
    }
    return owner;
};

/**
 * The graph of a library with the edges of every token: of each token of a
 * library made by `create()`, and of each own token of an extension, on the
 * graph of its source.
 */
const completeGraphOf = (scope: Scope): Graph => {
    if (!scope.complete) {
        const { source, own, made } = scope;
        const add = (token: LibraryToken<any>) => {
            if (!scope.graph.has(token.name)) {
                scope.graph.add(
                    token.name,
                    refsOf(LibraryToken.configuredValue(token)),
                );
            }
        };

        if (source) {
            completeGraphOf(source);
            for (const name of own) {
                add(made.get(name)!);
            }
        } else {
            // Every token of a library made by `create()` is made, so its
            // getter makes nothing.
            forEachToken(scope.tokens, (_, descriptor) =>
                add(descriptor.get!()),
            );
        }
        scope.complete = true;
    }

    return scope.graph;
};

/**
 * The token of a library with a name, if it is made: an extension's token
 * that hasn't been read isn't.
 */
const madeToken = (
    scope: Scope,
    name: string,
): LibraryToken<any> | undefined =>
    scope.source ? scope.made.get(name) : tokenNamed(scope, name);

/**
 * The token of a library with a name, made if it is an extension's token
 * that hasn't been read.
 */
const tokenNamed = (scope: Scope, name: string): LibraryToken<any> =>
    tokenAt(scope.tokens, name.split("."));

/**
 * The place of each token in the order of its library, by name. The
 * library's shape doesn't change, so it is found once.
 */
const orders = new WeakMap<Scope, Map<string, number>>();

const orderOf = (scope: Scope): Map<string, number> => {
    let order = orders.get(scope);

    if (order === undefined) {
        const found = new Map<string, number>();
        forEachToken(scope.tokens, (name) => found.set(name, found.size));
        order = found;
        orders.set(scope, order);
    }

    return order;
};

/**
 * Calls `visit` with the name and the property of each token of a library,
 * in its order. A group is a data property and a token an accessor, so this
 * makes no token of an extension.
 */
const forEachToken = (
    tokens: RawLibrary,
    visit: (name: string, descriptor: PropertyDescriptor) => void,
): void => {
    const walk = (node: RawLibrary, name: string): void => {
        for (const key of Object.keys(node)) {
            if (!isChildKey(key)) {
                continue;
            }
            const path = name.length === 0 ? key : `${name}.${key}`;
            const descriptor = Reflect.getOwnPropertyDescriptor(node, key)!;
            if ("value" in descriptor) {
                walk(descriptor.value, path);
            } else {
                visit(path, descriptor);
            }
        }
    };
    walk(tokens, "");
};

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

/**
 * The code of a value that is running as a token resolves, a recipe's
 * function or a getter, if any. A token it reads other than by a ref isn't
 * followed, so reading one there throws.
 */
let reading: { token: string; within: string } | null = null;

const guarded = <R>(token: string, within: string, read: () => R): R => {
    const previous = reading;
    reading = { token, within };
    try {
        return read();
    } finally {
        reading = previous;
    }
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
    get: () => Library.Token<any, any>,
): void => {
    Reflect.defineProperty(library, key, { get, enumerable: true });
};

const createToken = (
    key: string,
    name: string,
    config: DesignToken.Any,
    scope: Scope,
    typeContext: string | null,
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
    if (!isStandardType(resolvedType) && !scope.types.has(resolvedType)) {
        throw new Error(
            `"${name}" has the custom type "${resolvedType}", which isn't registered. Register it, with its isEqual, in the 'types' option of create() or extend().`,
        );
    }

    const token = new LibraryToken(
        name,
        $value,
        resolvedType,
        scope,
        $description || "",
        $extensions || {},
        $deprecated ?? false,
    );
    // A token that is new in an extension has a value of its own.
    if (scope.source) {
        scope.made.set(name, token);
        scope.own.add(name);
    }

    return token;
};

const recurseCreate = (
    name: string,
    library: RawLibrary,
    config: RawConfig,
    scope: Scope,
    typeContext: string | null,
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
            recurseCreate(_name, group, config[key], scope, typeContext);
            Object.freeze(group);
        } else if (isToken(config[key])) {
            const token = createToken(
                key,
                _name,
                config[key],
                scope,
                typeContext,
            );
            defineToken(library, key, () => token);
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
): void => {
    // An extension can restate a group's type, or give one to a group that
    // has none, but can't change it, as for a token.
    const sourceType = Reflect.get(sourceTokens, "$type");
    if (
        sourceType &&
        config.$type !== undefined &&
        config.$type !== sourceType
    ) {
        throw new Error(
            `An override cannot change the '$type' of group '${name}' from '${sourceType}' to '${config.$type}'.`,
        );
    }
    const groupType = sourceType || config.$type;
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
        const source = Reflect.getOwnPropertyDescriptor(sourceTokens, key);
        const configValue = config[key];

        // A group of the source is a data property and a token an accessor,
        // so telling them apart doesn't make the token of an extension.
        if (source ? "value" in source : isGroup(configValue)) {
            const group = {};
            Reflect.defineProperty(extendedTokens, key, {
                value: group,
                enumerable: true,
            });

            if (source) {
                recurseExtend(
                    _name,
                    source.value as RawLibrary,
                    group,
                    configValue || {},
                    scope,
                    typeContext,
                );
            } else {
                recurseCreate(_name, group, configValue, scope, typeContext);
            }
            Object.freeze(group);
        } else if (source) {
            const token = new InheritedToken(
                () => sourceTokens[key],
                scope,
                configValue,
            );
            // An override has a value of its own.
            if (configValue !== undefined && "$value" in configValue) {
                scope.own.add(_name);
            }
            // A token the extension configures is made now, so its config
            // is checked when the library is.
            if (configValue !== undefined) {
                token.get();
            }
            defineToken(extendedTokens, key, () => token.get());
        } else if (isToken(configValue)) {
            const token = createToken(
                key,
                _name,
                configValue,
                scope,
                typeContext,
            );
            defineToken(extendedTokens, key, () => token);
        }
    }
};

/**
 * The token of an extension for a token of the library it extends. It is
 * made when it is first read, so an extension costs what it reads (#113).
 *
 * Until it is set, it has the configured value of its source token, through
 * its prototype. A change to the source's token reaches it through its
 * library, which its source holds weakly, so the library it extends doesn't
 * keep an extension alive that nothing else refers to.
 */
class InheritedToken {
    private token: LibraryToken<any> | null = null;

    constructor(
        private readonly source: () => LibraryToken<any>,
        private readonly scope: Scope,
        private readonly node: RawConfig | undefined,
    ) {}

    public get(): LibraryToken<any> {
        if (this.token !== null) {
            return this.token;
        }

        const token = extendToken(this.source(), this.scope, this.node);
        this.token = token;
        this.scope.made.set(token.name, token);

        return token;
    }
}

function extendToken(
    token: Library.Token<any, any>,
    scope: Scope,
    node: Record<string, any> | undefined,
) {
    if (node?.$type !== undefined && node.$type !== token.$type) {
        throw new Error(
            `An override cannot change the '$type' of token '${token.name}' from '${token.$type}' to '${node.$type}'.`,
        );
    }

    const extendingToken = Object.create(token);
    extendingToken.state = new TokenState(scope);

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
        extendingToken.raw = node.$value;
    } else {
        // Not extendingToken.set: when the extended token is an extension
        // that hasn't been set, that is the extended token's own wrapper,
        // which sets the extended token.
        const set = LibraryToken.prototype.set;
        extendingToken.set = (value: any) => {
            // Own the inherited value first, so set() detaches even when the
            // new value is identical and doesn't notify.
            LibraryToken.detach(extendingToken);
            set.call(extendingToken, value);
            extendingToken.set = set;
        };
    }

    return extendingToken;
}

/**
 * The number of links in an object's prototype chain.
 */
const prototypeDepth = (value: object): number => {
    let depth = 0;
    for (
        let prototype = Object.getPrototypeOf(value);
        prototype !== null;
        prototype = Object.getPrototypeOf(prototype)
    ) {
        depth++;
    }
    return depth;
};

/**
 * Tests whether an object is plain data, which may hold refs: an array that
 * isn't a subclass of `Array`, or an object whose prototype chain has at most
 * one link, such as an object literal from any realm or `Object.create(null)`.
 * Any other object, such as a class instance, a `Date` or a `Map`, is a value
 * as it is.
 */
const isPlain = (value: object): boolean => {
    return Array.isArray(value)
        ? prototypeDepth(value) === 2
        : prototypeDepth(value) <= 1;
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
 * Resolves a value in a library's scope. A ref is replaced by its token's
 * value, as it is: the value is resolved and frozen already, so it isn't
 * copied again. A computed value is replaced by the result of its recipe's
 * function, or of the function that overrides it in the scope, called with
 * its arguments resolved. Plain data is copied from its own properties, including
 * symbol-keyed and non-enumerable ones, with its refs resolved, and the copy
 * is frozen, so the config isn't. A getter is read once, into a data
 * property. An object that is in the value twice, or in itself, has one copy.
 * Anything else, such as a class instance or a function, is returned as it
 * is: it can't be rebuilt, so it isn't copied, searched or frozen. A token
 * read by a recipe's function or a getter, rather than by a ref, throws.
 */
const resolve = (
    value: unknown,
    token: string,
    scope: Scope,
    found: {
        refs: Set<string> | null;
        results: Set<string> | null;
        calls: Set<Library.Recipe<any, unknown>> | null;
        inputs: unknown[] | null;
    },
): unknown => {
    const copies = new Map<object, unknown>();
    // Within the result of a recipe, whose refs the configured value doesn't
    // show.
    let inResult = 0;

    const walk = (value: unknown): unknown => {
        if (!isObject(value)) {
            return value;
        }

        if (isRef(value)) {
            const name = value[REF].join(".");
            if (inResult > 0) {
                (found.results ??= new Set()).add(name);
            } else {
                (found.refs ??= new Set()).add(name);
            }
            const token = tokenAt(scope.tokens, value[REF]);
            const resolved = token.$value;
            found.inputs?.push(token, resolved);
            return resolved;
        }

        if (isComputed(value)) {
            const { recipe, args } = value[COMPUTED];
            if (inResult > 0) {
                (found.calls ??= new Set()).add(recipe);
            }
            const fn = scope.recipes.get(recipe) ?? recipe[RECIPE].fn;
            const resolved = args.map(walk);
            const result = guarded(
                token,
                `the recipe "${recipe[RECIPE].name}"`,
                () => fn(...resolved),
            );

            inResult++;
            try {
                return walk(result);
            } finally {
                inResult--;
            }
        }

        if (copies.has(value)) {
            return copies.get(value);
        }

        if (!isPlain(value)) {
            return value;
        }

        if (Array.isArray(value)) {
            const copy = new Array(value.length);
            copies.set(value, copy);
            for (let i = 0; i < value.length; i++) {
                copy[i] = walk(value[i]);
            }
            return Object.freeze(copy);
        }

        const copy = Object.create(Object.getPrototypeOf(value));
        copies.set(value, copy);
        for (const key of Reflect.ownKeys(value)) {
            const descriptor = Reflect.getOwnPropertyDescriptor(value, key)!;
            Reflect.defineProperty(
                copy,
                key,
                "value" in descriptor
                    ? { ...descriptor, value: walk(descriptor.value) }
                    : {
                          value: walk(
                              guarded(token, "a getter of its value", () =>
                                  Reflect.get(value, key),
                              ),
                          ),
                          enumerable: descriptor.enumerable,
                          writable: true,
                          configurable: true,
                      },
            );
        }
        return Object.freeze(copy);
    };

    return walk(value);
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

    constructor(private readonly scope: Scope) {
        this.tokens = scope.tokens;
        // Groups are frozen as they are built; the root is frozen here.
        Object.freeze(this.tokens);
    }
    public subscribe(
        subscriber: Library.Subscriber<any>,
        options: Library.SubscribeOptions = {},
    ) {
        const { scope } = this;
        this.unsubscribe(subscriber);
        const { origin = "own" } = options;
        // A library made by `create()` has only its own tokens.
        const ancestral = scope.source !== undefined && origin !== "own";
        const delivered =
            origin === "all" || (origin === "own" && scope.source === undefined)
                ? subscriber
                : changesFrom(origin, subscriber);
        const subscribed = scope.queue.subscribed;
        scope.subscribers.set(subscriber, { delivered, ancestral });
        scope.queue.subscribe(delivered);
        if (ancestral) {
            scope.ancestral++;
        }
        if (!subscribed) {
            resolveOwn(scope);
        }
        if (ancestral && scope.ancestral === 1) {
            resolveAncestors(scope);
        }
    }
    public unsubscribe(subscriber: Library.Subscriber<any>) {
        const { scope } = this;
        const subscribed = scope.subscribers.get(subscriber);
        if (subscribed === undefined) {
            return;
        }
        scope.subscribers.delete(subscriber);
        scope.queue.unsubscribe(subscribed.delivered);
        if (subscribed.ancestral) {
            scope.ancestral--;
        }
        if (!scope.queue.subscribed) {
            LibraryToken.dropPrevious(scope);
        }
    }

    /**
     * The tokens of a library that are its own, in the order of the library.
     */
    public static ownTokens(library: unknown): LibraryToken<any>[] {
        if (!(library instanceof LibraryImpl)) {
            throw new Error("Not a library.");
        }
        const { scope } = library;
        const origin = scope.source === undefined ? null : originOf(scope);
        const tokens: LibraryToken<any>[] = [];
        forEachToken(scope.tokens, (name, descriptor) => {
            if (origin === null || origin.has(name)) {
                tokens.push(descriptor.get!());
            }
        });
        return tokens;
    }

    public extend(
        config: RawConfig,
        options: Library.ExtendOptions = {},
    ): LibraryImpl {
        assertNoRoot(config);
        const recipes = new Map(this.scope.recipes);
        const overridden = new Set<Library.Recipe<any, unknown>>();
        for (const { recipe, fn } of options.recipes ?? []) {
            recipes.set(recipe, fn);
            overridden.add(recipe);
        }
        const types = typesOf(options.types, this.scope.types);
        const scope = scopeOf(recipes, types, this.scope, overridden);
        recurseExtend("", this.tokens, scope.tokens, config, scope, null);

        return new LibraryImpl(scope);
    }

    public static create(
        config: RawConfig,
        options: Library.CreateOptions = {},
    ): LibraryImpl {
        assertNoRoot(config);
        const scope = scopeOf(new Map(), typesOf(options.types));
        recurseCreate("", scope.tokens, config, scope, null);

        return new LibraryImpl(scope);
    }
}

/**
 * The state of a token of a library.
 */
class TokenState<V> {
    constructor(public readonly scope: Scope) {}
    public cached: V | typeof empty = empty;
    /**
     * The value that was dropped, kept by a library with a subscriber until
     * the token resolves again: a value equal to it is replaced by it, so
     * it's the same object.
     */
    public previous: V | typeof empty = empty;
    public resolving = false;
    /**
     * The tokens that refs in the results of recipes were to, the last time
     * the value was resolved.
     */
    public found: ReadonlySet<string> | null = null;
    /**
     * The recipes that the results of recipes called, the last time the
     * value was resolved, which the configured value doesn't show.
     */
    public called: ReadonlySet<Library.Recipe<any, unknown>> | null = null;
    /**
     * Each token whose value the value was resolved from, followed by that
     * value, the last time it was resolved; `null` when its library had no
     * subscriber then, which doesn't check them.
     */
    public inputs: readonly unknown[] | null = null;
    /**
     * The cached value, unless a token it depends on may have changed since
     * it was resolved: then it's checked against its inputs when it's read.
     * It's the only field the getter reads for a cached value.
     */
    public current: V | typeof empty = empty;
    /**
     * The value it had when a subscribed library queued it, which the batch
     * compares with the one it has then.
     */
    public before: unknown = unqueued;
    /**
     * For a token whose value is its ancestor's, the value it last had for a
     * subscriber told of those.
     */
    public seen: V | typeof empty = empty;
    /**
     * Whether it became its extension's own since its library's last batch.
     */
    public originChanged = false;
}

/**
 * An individual token value in a library
 */
class LibraryToken<T extends DesignToken.Any>
    implements Library.Token<any, any>
{
    private raw:
        | Library.ConfigTokenValue<T, any>
        | DesignToken.ReadonlyValueByToken<T>;
    /**
     * What changes as the token resolves, in an object of one shape. A token
     * of an extension has a shape of its own, since its prototype is its
     * source's token, so its own fields are slow to read and to add.
     */
    private readonly state: TokenState<DesignToken.ReadonlyValueByToken<T>>;
    private readonly _extensions: Record<string, any>;

    constructor(
        public readonly name: string,
        value: Library.ConfigTokenValue<T, any>,
        private readonly _type: DesignToken.TypeByToken<T>,
        scope: Scope,
        private readonly _description: string,
        extensions: Record<string, any>,
        private readonly _deprecated: boolean | string,
    ) {
        this.raw = value;
        this.state = new TokenState(scope);
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
    public get $value(): DesignToken.ReadonlyValueByToken<T> {
        // Before the cache, so a token that was read is caught too.
        if (reading !== null) {
            throw new Error(
                `"${reading.token}" read the token "${this.name}" in ${reading.within}. A token read there isn't followed, so the value would not change with it. Pass the token to it as a ref instead.`,
            );
        }

        // A token whose value is its ancestor's holds none.
        const { current } = this.state;
        return current !== empty ? current : this.value();
    }

    /**
     * Whether the value is its ancestor's: the token is a subscribed
     * extension's and isn't its own.
     */
    private isAncestors(): boolean {
        const { origin, queue } = this.state.scope;
        return origin !== null && queue.subscribed && !origin.has(this.name);
    }

    /**
     * The value, resolved if it isn't cached or may have changed.
     */
    private value(): DesignToken.ReadonlyValueByToken<T> {
        const { scope } = this.state;
        if (this.isAncestors()) {
            // The ancestor token has the same type.
            const value =
                LibraryToken.ancestorValue<DesignToken.ReadonlyValueByToken<T>>(
                    this,
                );
            if (scope.ancestral > 0) {
                this.state.seen = value;
            }
            return value;
        }

        if (this.state.cached !== empty) {
            if (this.inputsAreCurrent()) {
                return (this.state.current = this.state.cached);
            }
            this.uncache();
        }

        if (this.state.resolving) {
            const chain = resolving
                .slice(resolving.indexOf(this))
                .map((token) => token.name);

            throw new CircularReferenceError([...chain, this.name]);
        }

        this.state.resolving = true;
        resolving.push(this);

        try {
            const found = {
                refs: null as Set<string> | null,
                results: null as Set<string> | null,
                calls: null as Set<Library.Recipe<any, unknown>> | null,
                // Only a library with a subscriber checks them.
                inputs: scope.queue.subscribed ? ([] as unknown[]) : null,
            };
            // The config's types guarantee what the raw value resolves to.
            let value = resolve(
                this.raw,
                this.name,
                this.state.scope,
                found,
            ) as DesignToken.ReadonlyValueByToken<T>;

            // Resolving found every ref of the configured value, so the
            // graph has the token's edges before any token depends on its
            // value.
            ownerOf(this.state.scope, this.name).graph.add(
                this.name,
                found.refs ?? none,
            );
            this.setFound(found.results);
            this.state.called = found.calls;
            this.state.inputs =
                found.inputs?.length === 0 ? noInputs : found.inputs;

            const { previous } = this.state;
            if (previous !== empty) {
                this.state.previous = empty;
                if (
                    scope.queue.subscribed &&
                    equalityOf(scope, this._type)(previous, value)
                ) {
                    value = previous;
                }
            }

            this.state.cached = value;
            this.state.current = value;
            this.state.scope.cached++;

            return value;
        } finally {
            this.state.resolving = false;
            resolving.pop();
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

    public set(
        value:
            | Library.ConfigTokenValue<T, any>
            | DesignToken.ReadonlyValueByToken<T>,
    ) {
        if (Object.is(this.raw, value)) {
            return;
        }

        this.raw = value;
        // A token that is set has a value of its own, so its edges are its
        // library's. Until the graph is complete, they are added again when
        // the token is resolved.
        const { graph, complete } = this.state.scope;
        if (graph.remove(this.name) && complete) {
            graph.add(this.name, refsOf(value));
        }
        LibraryToken.changed(this.state.scope, this.name, this);
    }

    /**
     * Drops the resolved value, and says whether there was one.
     */
    private uncache(): boolean {
        if (this.state.cached === empty) {
            return false;
        }

        if (this.state.scope.queue.subscribed) {
            this.state.previous = this.state.cached;
        }
        this.state.cached = empty;
        this.state.current = empty;
        this.state.scope.cached--;
        return true;
    }

    /**
     * Drops the value of each token of a subscribed extension that is its
     * ancestor's, which it reads from its ancestor from then on.
     */
    public static dropAncestors(scope: Scope): void {
        const origin = scope.origin!;
        for (const [name, token] of scope.made) {
            if (!origin.has(name) && token.state.cached !== empty) {
                token.state.cached = empty;
                token.state.current = empty;
                token.state.previous = empty;
                scope.cached--;
            }
        }
    }

    /**
     * Whether each token the value was resolved from has the value it had,
     * as far as is known.
     */
    private inputsAreCurrent(): boolean {
        const { inputs } = this.state;
        if (inputs === null) {
            return false;
        }
        for (let i = 0; i < inputs.length; i += 2) {
            try {
                if (
                    !Object.is(
                        (inputs[i] as LibraryToken<any>).$value,
                        inputs[i + 1],
                    )
                ) {
                    return false;
                }
            } catch {
                return false;
            }
        }
        return true;
    }

    /**
     * Queues the token for its library's next batch, with the value it has
     * now to compare with.
     */
    private queue(): void {
        const { state } = this;
        if (state.before === unqueued) {
            // A token that was dropped and not resolved since had the value
            // it keeps to compare with, and one that is its ancestor's the
            // value its subscribers were last told of.
            // Only a subscriber told of its ancestor's tokens queues those.
            state.before =
                state.scope.ancestral > 0 && this.isAncestors()
                    ? state.seen
                    : state.cached !== empty
                      ? state.cached
                      : state.previous;
        }
        this.state.scope.queue.add(this);
    }

    /**
     * The value of a token of a subscribed extension that is its ancestor's:
     * its ancestor's, the same object. Which tokens are its own is found when
     * it's first subscribed, and again as changes reach it, so none that
     * should be is read here.
     */
    private static ancestorValue<V>(token: LibraryToken<any>): V {
        const source: LibraryToken<any> = Object.getPrototypeOf(token);
        return source.$value;
    }

    /**
     * Whether a token of a subscribed extension that isn't its own yet, and
     * whose configured value calls a recipe, must be: it calls a recipe the
     * extension overrides, or a recipe's result does, or refers to a token
     * that is the extension's own. It's resolved in the source to find out
     * what its results do.
     */
    public static discover(scope: Scope, name: string): boolean {
        const { overridden } = scope;
        if (
            overridden.size > 0 &&
            callsAny(
                LibraryToken.configuredValue(tokenNamed(scope.source!, name)),
                overridden,
            )
        ) {
            return true;
        }

        const resolver = resolverOf(scope, name);
        LibraryToken.tryResolve(resolver);
        const { called, found } = resolver.state;
        const origin = scope.origin!;
        for (const recipe of called ?? []) {
            if (overridden.has(recipe)) {
                return true;
            }
        }
        for (const name of found ?? none) {
            if (origin.has(name)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Finds the tokens of a subscribed extension that a change to the token
     * named `name` makes its own: a recipe's result that the change reaches
     * may now call a recipe the extension overrides, or refer to one of its
     * own tokens.
     */
    private static rediscover(scope: Scope, name: string): void {
        const origin = scope.origin!;
        const { callers } = scope;
        for (const caller of callers) {
            if (origin.has(caller)) {
                callers.delete(caller);
            }
        }
        if (callers.size === 0) {
            return;
        }
        const visited = new Set([name]);
        const pending = [name];
        const visit = (dependent: string): void => {
            if (!visited.has(dependent)) {
                visited.add(dependent);
                pending.push(dependent);
            }
        };
        for (let i = 0; i < pending.length; i++) {
            scope.graph.dependentsOf(pending[i], visit);
            foundDependentsOf(scope, pending[i], visit);
        }
        for (const reached of pending) {
            if (
                callers.has(reached) &&
                !origin.has(reached) &&
                LibraryToken.discover(scope, reached)
            ) {
                addOrigin(scope, reached);
            }
        }
    }

    /**
     * Queues a token that becomes a subscribed extension's own, as its
     * origin changed. It's compared with the value it had as its ancestor's,
     * which it keeps when its own is equal.
     */
    public static inherit(scope: Scope, name: string): void {
        if (scope.source === undefined || !scope.queue.subscribed) {
            return;
        }
        const token = tokenNamed(scope, name);
        if (token.state.cached === empty) {
            try {
                token.state.previous = tokenNamed(scope.source, name).$value;
            } catch {
                // It throws as its ancestor's, so any value of its own is new.
            }
        }
        token.state.originChanged = true;
        token.queue();
    }

    /**
     * Delivers what a batch of a subscribed library reports: each token it
     * queued whose value isn't the one it had, which reading it brings up to
     * date, or whose origin changed. A token that starts or stops throwing
     * has changed. A token that is its ancestor's is compared by its type's
     * equality, since its ancestor may not keep equal values' objects.
     */
    public static reported(
        tokens: ReadonlySet<LibraryToken<any>>,
    ): Library.Change<any>[] {
        const reported: Library.Change<any>[] = [];
        for (const token of tokens) {
            const { state } = token;
            const { scope } = state;
            const { before, originChanged } = state;
            state.originChanged = false;
            if (before === unqueued) {
                reported.push(changeOf(token, true, "own", originChanged));
                continue;
            }
            state.before = unqueued;
            if (!scope.queue.subscribed) {
                continue;
            }

            let after: unknown;
            try {
                after = token.$value;
            } catch {
                after = empty;
            }
            // Only a subscriber told of its ancestor's tokens queues those.
            const ancestors = scope.ancestral > 0 && token.isAncestors();
            const valueChanged =
                !Object.is(before, after) &&
                !(
                    ancestors &&
                    before !== empty &&
                    after !== empty &&
                    equalityOf(scope, token._type)(before, after)
                );
            if (valueChanged || originChanged) {
                reported.push(
                    changeOf(
                        token,
                        valueChanged,
                        ancestors ? "ancestor" : "own",
                        originChanged,
                    ),
                );
            }
        }
        return reported;
    }

    /**
     * Resolves a token, if it doesn't throw.
     */
    public static tryResolve(token: LibraryToken<any>): void {
        try {
            token.$value;
        } catch {
            // It throws again when it's read.
        }
    }

    /**
     * Resolves a token of a library that is first subscribed, if it doesn't
     * throw. A value it resolved before has no inputs, which are the values
     * the tokens it depends on have now, as its library dropped it when one
     * of them changed.
     */
    public static resolveForSubscriber(token: LibraryToken<any>): void {
        LibraryToken.tryResolve(token);
        const { state } = token;
        if (state.inputs !== null || state.cached === empty) {
            return;
        }
        const { scope } = state;
        const inputs: unknown[] = [];
        const add = (name: string) => {
            const dependency = tokenNamed(scope, name);
            try {
                inputs.push(dependency, dependency.$value);
            } catch {
                inputs.push(dependency, empty);
            }
        };
        ownerOf(scope, token.name)
            .graph.dependenciesOf(token.name)
            ?.forEach(add);
        state.found?.forEach(add);
        state.inputs = inputs.length === 0 ? noInputs : inputs;
    }

    /**
     * Drops the value each token of a library kept to compare with, once the
     * library has no subscriber, which compares values.
     */
    public static dropPrevious(scope: Scope): void {
        const drop = (token: LibraryToken<any>) => {
            token.state.previous = empty;
        };
        if (scope.source) {
            // The tokens an extension hasn't made have no value.
            scope.made.forEach(drop);
        } else {
            forEachToken(scope.tokens, (_, descriptor) =>
                drop(descriptor.get!()),
            );
        }
    }

    private setFound(names: Set<string> | null): void {
        if (this.state.found === null && names === null) {
            return;
        }

        const { found } = this.state.scope;
        for (const name of this.state.found ?? []) {
            found.get(name)?.delete(this.name);
        }
        for (const name of names ?? []) {
            let dependents = found.get(name);
            if (dependents === undefined) {
                dependents = new Set();
                found.set(name, dependents);
            }
            dependents.add(this.name);
        }
        this.state.found = names;
    }

    /**
     * Makes an extension's token have a value of its own: the one it
     * inherits, until it is set.
     */
    public static detach(token: LibraryToken<any>): void {
        token.raw = token.raw;
        token.state.scope.own.add(token.name);
        token.state.scope.graph.add(token.name, refsOf(token.raw));
        if (token.state.scope.origin !== null) {
            addOrigin(token.state.scope, token.name);
        }
    }

    /**
     * Invalidates what a change to the token named `name` in a library
     * changes: its value, the values that depend on it, and the same in the
     * libraries that extend it and inherit the token. Each token whose value
     * is dropped is queued for its library's subscribers, and so is the token
     * itself, which a library with a subscriber makes if it hasn't.
     *
     * A token without a resolved value is not followed: a token that has one
     * read the tokens it depends on as it resolved, and they have one too.
     */
    public static changed(
        scope: Scope,
        name: string,
        token?: LibraryToken<any>,
    ): void {
        if (scope.queue.subscribed) {
            LibraryToken.reach(scope, name, token);
        } else {
            LibraryToken.invalidate(scope, name, token);
        }

        for (const reference of scope.extensions) {
            const extension = reference.deref();
            if (extension !== undefined && !extension.own.has(name)) {
                LibraryToken.changed(extension, name);
            }
        }
    }

    /**
     * Marks what a change to the token named `name` reaches in a subscribed
     * library, and queues it: the token, and each token that depends on it,
     * however far, whether it was read or not. A token is resolved again
     * when the batch is delivered, or when it's read first, and it's checked
     * against the values it was resolved from first. An extension queues
     * only its own tokens: its ancestor's are its ancestor's values, which it
     * doesn't hold.
     */
    private static reach(
        scope: Scope,
        name: string,
        token?: LibraryToken<any>,
    ): void {
        const { origin } = scope;
        if (origin !== null) {
            LibraryToken.rediscover(scope, name);
        }
        const ancestral = scope.ancestral > 0;
        if (!ancestral && origin !== null && origin.size === 0) {
            // Its values are all its ancestor's, and it holds none of them.
            return;
        }
        const isOwn = (name: string) => origin === null || origin.has(name);
        // The tokens queued: its own, and with a subscriber told of its
        // ancestor's, those too.
        const isQueued = (name: string) => ancestral || isOwn(name);

        const changed =
            token ??
            madeToken(scope, name) ??
            (isQueued(name) ? tokenNamed(scope, name) : undefined);
        if (changed !== undefined) {
            if (isQueued(name)) {
                changed.queue();
            }
            changed.uncache();
        }

        const visited = new Set([name]);
        const pending = [name];
        const visit = (dependent: string): void => {
            if (visited.has(dependent)) {
                return;
            }
            visited.add(dependent);
            pending.push(dependent);

            if (isOwn(dependent)) {
                const token = tokenNamed(scope, dependent);
                token.queue();
                token.state.current = empty;
            } else if (ancestral) {
                tokenNamed(scope, dependent).queue();
            } else {
                madeToken(scope, dependent)?.uncache();
            }
        };

        // In the order they're reached, so that each is resolved after the
        // tokens it depends on, and not through them.
        for (let i = 0; i < pending.length; i++) {
            scope.graph.dependentsOf(pending[i], visit);
            foundDependentsOf(scope, pending[i], visit);
        }
    }

    /**
     * Drops what a change to the token named `name` changes in a library
     * with no subscriber: its value, and the values that depend on it.
     *
     * A token without a resolved value is not followed: a token that has one
     * read the tokens it depends on as it resolved, and they have one too.
     * An extension's ancestor's tokens are followed whatever they hold,
     * since its own tokens may have read their ancestor's values while it was
     * subscribed.
     */
    private static invalidate(
        scope: Scope,
        name: string,
        token?: LibraryToken<any>,
    ): void {
        const changed =
            token ??
            madeToken(scope, name) ??
            (scope.queue.subscribed ? tokenNamed(scope, name) : undefined);
        if (changed !== undefined) {
            changed.uncache();
            scope.queue.add(changed);
        }

        if (scope.cached > 0) {
            const { graph, origin } = scope;
            const visited = new Set([name]);
            const pending = [name];
            const visit = (dependent: string): void => {
                if (visited.has(dependent)) {
                    return;
                }
                visited.add(dependent);

                const token = madeToken(scope, dependent);
                if (token?.uncache()) {
                    scope.queue.add(token);
                    pending.push(dependent);
                } else if (origin !== null && !origin.has(dependent)) {
                    pending.push(dependent);
                }
            };

            while (pending.length > 0) {
                const next = pending.pop()!;
                graph.dependentsOf(next, visit);
                scope.found.get(next)?.forEach(visit);
            }
        }
    }

    /**
     * The value a token was configured or last set with. An extension's
     * token that has no value of its own inherits its source's.
     */
    public static configuredValue<T extends DesignToken.Any>(
        token: LibraryToken<T>,
    ): Library.ConfigTokenValue<T, any> | DesignToken.ReadonlyValueByToken<T> {
        return token.raw;
    }

    /**
     * The tokens that the refs in a token's configured value are to, in the
     * token's library.
     */
    public static dependencies(
        token: LibraryToken<any>,
    ): ReadonlySet<LibraryToken<any>> {
        const dependencies = new Set<LibraryToken<any>>();
        forEachRef(token.raw, (path) =>
            dependencies.add(tokenAt(token.state.scope.tokens, path)),
        );
        return dependencies;
    }

    /**
     * The tokens of the token's library whose configured values refer to it,
     * in the order of the library.
     */
    public static dependents(
        token: LibraryToken<any>,
    ): readonly LibraryToken<any>[] {
        const { scope } = token.state;
        const version = completeGraphOf(scope).version;
        const kept = dependentsOfToken.get(token);
        if (kept?.version === version) {
            return kept.dependents;
        }

        const names: string[] = [];
        completeGraphOf(scope).dependentsOf(token.name, (name) =>
            names.push(name),
        );

        if (names.length > 1) {
            const order = orderOf(scope);
            names.sort((a, b) => order.get(a)! - order.get(b)!);
        }

        const dependents = names.map((name) => tokenNamed(scope, name));
        dependentsOfToken.set(token, { version, dependents });
        return dependents;
    }
}

/**
 * Calls `visit` with each token of a library whose value resolved a ref to
 * the token named `name` in a recipe's result. An extension's are its own
 * and those of its ancestors' tokens it doesn't give a value.
 */
function foundDependentsOf(
    scope: Scope,
    name: string,
    visit: (dependent: string) => void,
): void {
    if (scope.source !== undefined) {
        foundDependentsOf(scope.source, name, (dependent) => {
            if (!scope.own.has(dependent)) {
                visit(dependent);
            }
        });
    }
    scope.found.get(name)?.forEach(visit);
}

/**
 * Makes a token of a subscribed extension its own, and each token that
 * depends on it. With `inherit`, each is compared next with the value it had
 * as its ancestor's.
 */
function addOrigin(scope: Scope, name: string, inherit = true): void {
    const origin = scope.origin!;
    if (origin.has(name)) {
        return;
    }
    // Completed when an extension first has a token of its own.
    completeGraphOf(scope);
    const add = (name: string): void => {
        origin.add(name);
        pending.push(name);
        if (inherit) {
            LibraryToken.inherit(scope, name);
        }
    };
    const pending: string[] = [];
    add(name);

    const visit = (dependent: string): void => {
        if (!origin.has(dependent)) {
            add(dependent);
        }
    };
    for (let i = 0; i < pending.length; i++) {
        scope.graph.dependentsOf(pending[i], visit);
        foundDependentsOf(scope, pending[i], visit);
    }
    if (!scope.discovered && scope.queue.subscribed) {
        discoverAll(scope, inherit);
    }
}

/**
 * Finds the tokens of an extension that recipes' results make its own.
 * What a result calls and refers to is known only once it has resolved, so
 * each token of the source that calls a recipe is resolved: the
 * extension's own tokens are then the same whatever the source has read.
 */
function discoverAll(scope: Scope, inherit: boolean): void {
    scope.discovered = true;
    const origin = scope.origin!;
    for (const name of callersOf(scope.source!)) {
        if (!origin.has(name)) {
            scope.callers.add(name);
        }
    }
    for (const name of scope.callers) {
        if (!origin.has(name) && LibraryToken.discover(scope, name)) {
            addOrigin(scope, name, inherit);
        }
    }
}

/**
 * The token of an extension's source that resolves the value the
 * extension's token named `name` has as its ancestor's: the source's, or,
 * when that is its own ancestor's too, the nearest that isn't.
 */
const resolverOf = (scope: Scope, name: string): LibraryToken<any> => {
    let source = scope.source!;
    while (
        source.source !== undefined &&
        source.origin !== null &&
        source.queue.subscribed &&
        !source.origin.has(name)
    ) {
        source = source.source;
    }
    return tokenNamed(source, name);
};

/**
 * Whether a value calls one of `recipes`, or with `null` any recipe, in plain
 * data or in the arguments of a computed value.
 */
const callsAny = (
    value: unknown,
    recipes: ReadonlySet<Library.Recipe<any, unknown>> | null,
    seen = new Set<object>(),
): boolean => {
    if (!isObject(value) || seen.has(value)) {
        return false;
    }
    seen.add(value);

    if (isComputed(value)) {
        const { recipe, args } = value[COMPUTED];
        return (
            recipes === null ||
            recipes.has(recipe) ||
            args.some((arg) => callsAny(arg, recipes, seen))
        );
    }
    return (
        isPlain(value) &&
        Reflect.ownKeys(value).some((key) =>
            callsAny(Reflect.get(value, key), recipes, seen),
        )
    );
};

/**
 * Resolves the tokens of a library that is first subscribed, so a change
 * is compared with the values they have: every token of a library made by
 * `create()`, and an extension's own tokens, which it finds then.
 */
function resolveOwn(scope: Scope): void {
    if (scope.source === undefined) {
        forEachToken(scope.tokens, (_, descriptor) =>
            LibraryToken.resolveForSubscriber(descriptor.get!()),
        );
        return;
    }

    const origin = originOf(scope);
    LibraryToken.dropAncestors(scope);
    for (const name of origin) {
        LibraryToken.resolveForSubscriber(tokenNamed(scope, name));
    }
}

/**
 * Resolves the tokens of a subscribed extension that are its ancestor's,
 * for a subscriber told of them, which is told of a change to each from the
 * value it has then.
 */
function resolveAncestors(scope: Scope): void {
    const origin = originOf(scope);
    completeGraphOf(scope);
    forEachToken(scope.tokens, (name, descriptor) => {
        if (!origin.has(name)) {
            LibraryToken.tryResolve(descriptor.get!());
        }
    });
}

/**
 * The names of the tokens of a library whose configured values call a
 * recipe.
 */
const callersOf = (scope: Scope): string[] => {
    const { source, own, made } = scope;
    if (source === undefined) {
        const names: string[] = [];
        forEachToken(scope.tokens, (name, descriptor) => {
            if (
                callsAny(LibraryToken.configuredValue(descriptor.get!()), null)
            ) {
                names.push(name);
            }
        });
        return names;
    }

    const names = callersOf(source).filter((name) => !own.has(name));
    for (const name of own) {
        if (callsAny(LibraryToken.configuredValue(made.get(name)!), null)) {
            names.push(name);
        }
    }
    return names;
};

/**
 * The tokens of an extension that are its own, found the first time they're
 * needed: those it gives a value, and those that recipes' results make its
 * own, which {@link discoverAll} finds once it can have any.
 */
function originOf(scope: Scope): Set<string> {
    let { origin } = scope;
    if (origin === null) {
        origin = scope.origin = new Set();
        for (const name of scope.own) {
            addOrigin(scope, name, false);
        }
    }
    // With no token of its own and no recipe overridden, none can be, until
    // it has one.
    if (!scope.discovered && (origin.size > 0 || scope.overridden.size > 0)) {
        discoverAll(scope, false);
    }
    return origin;
}

/**
 * A change of a batch.
 */
const changeOf = (
    token: LibraryToken<any>,
    valueChanged: boolean,
    origin: Library.Change<any>["origin"],
    originChanged: boolean,
): Library.Change<any> =>
    Object.freeze({ token, valueChanged, origin, originChanged });

/**
 * A subscriber of an extension's batches that's told only of the changes to
 * its own tokens.
 */
const changesFrom = (
    origin: "own" | "ancestor",
    subscriber: Library.Subscriber<any>,
): Library.Subscriber<any> => ({
    onChange(changes) {
        const told = changes.filter((change) => change.origin === origin);
        if (told.length > 0) {
            subscriber.onChange(
                told.length === changes.length ? changes : Object.freeze(told),
            );
        }
    },
});

const libraryTokenOf = (token: Library.Token<any, any, any>) => {
    if (!(token instanceof LibraryToken)) {
        throw new Error(`"${token.name}" is not a token of a library.`);
    }

    return token;
};

/**
 * A token's value as it was configured, or last given to `set()`, with its
 * refs and computed values unresolved. A token of a library made by
 * `extend()` that isn't given a value has its source token's.
 *
 * @remarks
 * A token's `$value` is resolved, so it can't tell a value that is given from
 * one that is derived from other tokens, or say where in a value a ref is. A
 * tool that reads how a library is configured finds the refs in this value
 * with {@link isRef} and the computed values with {@link isComputed}: a value
 * with neither, at any depth, is given. A converter that writes a ref as a
 * CSS `var()`, rather than its token's value, reads the ref here and its
 * path with {@link pathOf}.
 *
 * It's the value the token holds, not a copy, so it isn't frozen. Changing it
 * doesn't change the token: give a new value to `set()`. Refs and computed
 * values are searched for in plain data, as the library resolves them, and
 * not in a class instance or a function.
 *
 * @example
 * ```ts
 * const isGiven = (value: unknown): boolean =>
 *     !isRef(value) &&
 *     !isComputed(value) &&
 *     (typeof value !== "object" || value === null ||
 *         Object.values(value).every(isGiven));
 *
 * isGiven(configuredValueOf(library.tokens.colors.primary)); // true
 * isGiven(configuredValueOf(library.tokens.colors.hover)); // false: a recipe
 * ```
 *
 * @public
 */
export const configuredValueOf = <
    T extends DesignToken.Shape,
    R extends {},
    G extends string = never,
>(
    token: Library.Token<T, R, G>,
): Library.ConfigTokenValue<T, R> | DesignToken.ReadonlyValueByToken<T> =>
    LibraryToken.configuredValue(libraryTokenOf(token));

/**
 * The tokens that a token's value refers to, through refs anywhere in its
 * configured value, including the arguments of the recipes it's computed
 * with, in the token's library. Each token is listed once, in the order its
 * first ref is in the value.
 *
 * @remarks
 * These are the tokens the value is made from, and not theirs in turn: a
 * tool follows each with `dependenciesOf()` for the whole chain. A value
 * computed by a recipe from literal arguments only has no dependencies,
 * though it's derived: {@link configuredValueOf} tells that apart.
 *
 * It throws when a ref's path isn't a token of the library, as reading the
 * token's `$value` does.
 *
 * @example
 * ```ts
 * // hover: { $value: Recipes.darken(theme.colors.primary, 0.2) }
 * dependenciesOf(library.tokens.colors.hover).map((token) => token.name);
 * // ["colors.primary"]
 * ```
 *
 * @public
 */
export const dependenciesOf = <
    T extends DesignToken.Shape,
    R extends {},
    G extends string = never,
>(
    token: Library.Token<T, R, G>,
): ReadonlyArray<Library.TokenRecord<R>> =>
    // The token at a ref's path is a token of the library, of shape `R`: the
    // config's types guarantee it.
    Object.freeze([
        ...LibraryToken.dependencies(libraryTokenOf(token)),
    ]) as ReadonlyArray<Library.TokenRecord<R>>;

/**
 * The tokens and groups of a library, each with its path, in the order of
 * the config. A group is listed before the tokens and groups in it.
 *
 * @remarks
 * This is the library's own rule for what is a token and what is a group, and
 * for which keys are children, so a tool that visits every token (an index, a
 * report, a list of the tokens to offer for a property) doesn't walk
 * `library.tokens` and restate it. It walks as a DOM `TreeWalker` does: an
 * entry that `whatToShow` leaves out is not passed to `filter`, but what is
 * under it is still visited, and `filter` can return `"reject"` to leave out
 * a group and everything under it.
 *
 * The library itself isn't listed, as a `TreeWalker`'s root isn't, so its own
 * `$`-prefixed properties are not visited. A group's own token is listed with
 * the path of its group and `$root`.
 *
 * The order is the order of the keys in a JavaScript object, so a name that
 * is an array index (`"0"`, `"123"`) is listed before the other names of its
 * group, in ascending order, whatever its place in the config.
 *
 * The listing is lazy and reads the
 * library as it goes; a token's `$value` is not read.
 *
 * @example
 * ```ts
 * // The names of every token that isn't deprecated, in a group that isn't
 * for (const { token } of entriesOf(library, {
 *     whatToShow: "token",
 *     filter: ({ token }) => !token.$deprecated,
 * })) {
 *     names.push(token.name);
 * }
 *
 * // Everything, leaving out the deprecated groups
 * const entries = [
 *     ...entriesOf(library, {
 *         filter: (entry) =>
 *             entry.kind === "group" && entry.group.$deprecated
 *                 ? "reject"
 *                 : true,
 *     }),
 * ];
 * ```
 *
 * @public
 */
export function entriesOf<T extends {}, R extends {}>(
    library: Library.Library<T, R>,
    options: Library.EntriesOptions<"token", R> & { whatToShow: "token" },
): Generator<Library.TokenEntry<R>, void, undefined>;
/** @public */
export function entriesOf<T extends {}, R extends {}>(
    library: Library.Library<T, R>,
    options: Library.EntriesOptions<"group", R> & { whatToShow: "group" },
): Generator<Library.GroupEntry, void, undefined>;
/** @public */
export function entriesOf<T extends {}, R extends {}>(
    library: Library.Library<T, R>,
    options?: Library.EntriesOptions<"all", R>,
): Generator<Library.EntryOf<"all", R>, void, undefined>;
export function entriesOf<T extends {}, R extends {}>(
    library: Library.Library<T, R>,
    options: Library.EntriesOptions<Library.Show, R> = {},
): Generator<Library.EntryOf<"all", R>, void, undefined> {
    return walkEntries(library.tokens, [], options);
}

function walkEntries<R extends {}>(
    node: RawLibrary,
    path: readonly string[],
    options: Library.EntriesOptions<"token", R> & { whatToShow: "token" },
): Generator<Library.TokenEntry<R>, void, undefined>;
function walkEntries<R extends {}>(
    node: RawLibrary,
    path: readonly string[],
    options: Library.EntriesOptions<"group", R> & { whatToShow: "group" },
): Generator<Library.GroupEntry, void, undefined>;
function walkEntries<R extends {}>(
    node: RawLibrary,
    path: readonly string[],
    options: Library.EntriesOptions<Library.Show, R>,
): Generator<Library.EntryOf<"all", R>, void, undefined>;
function* walkEntries<R extends {}>(
    node: RawLibrary,
    path: readonly string[],
    options: Library.EntriesOptions<Library.Show, R>,
): Generator<Library.EntryOf<"all", R>, void, undefined> {
    const { whatToShow = "all", filter } = options;

    for (const key of Object.keys(node)) {
        if (!isChildKey(key)) {
            continue;
        }

        const child = node[key];
        const childPath = [...path, key];
        const entry: Library.EntryOf<"all", R> = isToken(child)
            ? { kind: "token", path: childPath, token: child }
            : { kind: "group", path: childPath, group: child };
        let result: Library.FilterResult = true;

        if (whatToShow === "all" || whatToShow === entry.kind) {
            result = filter?.(entry) ?? true;

            if (result === true) {
                yield entry;
            }
        }

        if (entry.kind === "group" && result !== "reject") {
            yield* walkEntries(child, childPath, options);
        }
    }
}

/**
 * The tokens whose values refer to a token, through refs anywhere in their
 * configured values, including the arguments of their recipes, in the
 * token's library. It is the reverse of {@link dependenciesOf}: each token is
 * listed once, in the order of the library.
 *
 * @remarks
 * These are the tokens that refer to the token directly. A token whose value
 * may change when this one is set is also one that refers to one of those: a
 * tool follows each with `dependentsOf()` for the whole set, as it follows
 * {@link dependenciesOf} for the chain the other way.
 *
 * This reads the configured values and not the values, so it resolves no
 * token, and so it is known of a library whose tokens have not been read. It
 * is found for the whole library once, kept as tokens are set, and shared
 * with the libraries that extend it, so each call after the first is a
 * lookup, and an extension makes only the tokens it lists. A value a recipe
 * reads other than through its arguments is not seen, as for
 * {@link dependenciesOf}.
 *
 * @example
 * ```ts
 * // hover: { $value: Recipes.darken(theme.colors.primary, 0.2) }
 * dependentsOf(library.tokens.colors.primary).map((token) => token.name);
 * // ["colors.hover"]
 *
 * // Every token that may change when a token is set
 * const affected = new Set<Library.Token<any, any>>();
 * const visit = (token: Library.Token<any, any>) => {
 *     for (const dependent of dependentsOf(token)) {
 *         if (!affected.has(dependent)) {
 *             affected.add(dependent);
 *             visit(dependent);
 *         }
 *     }
 * };
 * visit(extension.tokens.color.context);
 * ```
 *
 * @public
 */
export const dependentsOf = <
    T extends DesignToken.Shape,
    R extends {},
    G extends string = never,
>(
    token: Library.Token<T, R, G>,
): ReadonlyArray<Library.TokenRecord<R>> =>
    // The tokens that refer to a token are of its library, of shape `R`: the
    // config's types guarantee it.
    Object.freeze([
        ...LibraryToken.dependents(libraryTokenOf(token)),
    ]) as ReadonlyArray<Library.TokenRecord<R>>;

/**
 * The tokens of a library whose values are its own, in the order of the
 * library: every token of a library made by `create()`, and an extension's
 * tokens that don't come from its ancestors.
 *
 * @remarks
 * An extension's token is its own when it has a value of its own (one its
 * config gives, one that is set, or a token new in it), when it calls a
 * recipe the extension overrides, or when a token it depends on is its own.
 * A token depends on the tokens its configured value refers to, and on
 * those a ref in a recipe's result is to, so tokens of its ancestors that
 * call recipes may be resolved to find them.
 *
 * It's what a first render of an extension writes, such as with
 * {@link toCSS}'s `filter`.
 *
 * @example
 * ```ts
 * const own = new Set(ownTokensOf(extension));
 * toCSS(extension, { filter: (token) => own.has(token) });
 * ```
 *
 * @public
 */
export const ownTokensOf = <R extends {}>(
    library: Library.Library<any, R>,
): ReadonlyArray<Library.TokenRecord<R>> =>
    // The tokens of a library of shape `R`.
    Object.freeze(LibraryImpl.ownTokens(library)) as ReadonlyArray<
        Library.TokenRecord<R>
    >;
