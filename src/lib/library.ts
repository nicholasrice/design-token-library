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
  }

  export interface Subscriber<R extends {}> {
    onChange(records: ReadonlyArray<Library.Token<DesignToken.Any, R>>): void;
  }

  export interface ChangeRecord {}

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
  export type DeepAlias<
    V extends DesignToken.Values.Any,
    T extends Context<any>,
  > = {
    [K in keyof V]: V[K] extends DesignToken.Values.Any
      ? V[K] | Alias<DesignToken.TokenByValue<V[K]>, T> | DeepAlias<V[K], T>
      : never;
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
        ? Config<T[K], R>
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
      });

  /**
   * @public
   */
  export const create = <T extends {} = any>(
    config: Library.Config<T, T>,
  ): Library.Library<T> => {
    return new LibraryImpl(config, LibraryToken as any); // TODO fix 'as any'
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

interface CreateConfig<T> {
  name: string;
  library: Library.TokenLibrary<any, any>;
  config: Library.Config<any>;
  context: Library.TokenLibrary<any, any>;
  typeContext: DesignToken.Type | null;
  queue: IQueue<Library.Token<DesignToken.Any, any>>;
  tokenCtor: ConstructableDesignToken<any>;
}
const recurseCreate = ({
  name,
  library,
  config,
  context,
  typeContext,
  queue,
}: CreateConfig<any>): void => {
  for (const key in config) {
    if (key === "type") {
      typeContext = config[key] as any;
      continue;
    }

    const _name = name.length === 0 ? key : `${name}.${key}`;

    if (isGroup(config[key])) {
      Reflect.defineProperty(library, key, {
        value: {},
        enumerable: true,
      });
      recurseCreate({
        name: _name,
        library: library[key] as any,
        config: config[key],
        context,
        typeContext: config[key].type || typeContext,
        queue,
        tokenCtor: LibraryToken,
      });
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

const recurseResolve = (value: any, context: Library.Context<any>) => {
  const resolved: any = Array.isArray(value) ? [] : {};
  for (const key in value) {
    let v = value[key];

    if (isAlias(v)) {
      v = v(context);
    }

    if (isToken(v)) {
      v = v.value;
    }

    if (isObject(v) || Array.isArray(v)) {
      resolved[key] = recurseResolve(v, context);
    } else {
      resolved[key] = v;
    }
  }

  return resolved;
};

class LibraryImpl<T extends {} = any> implements Library.Library<T> {
  private readonly queue: IQueue<Library.Token<DesignToken.Any, T>> =
    new Queue();
  constructor(
    config: Library.Config<T, T>,
    tokenCtor: ConstructableDesignToken<DesignToken.Any>,
  ) {
    const library: Library.TokenLibrary<any, any> = {};
    const conf: CreateConfig<T> = {
      name: "",
      library,
      config,
      context: library,
      typeContext: null,
      queue: this.queue,
      tokenCtor,
    };
    recurseCreate(conf);
    this.tokens = library;
  }
  public tokens: Library.TokenLibrary<T, T>;
  public subscribe(subscriber: Library.Subscriber<T>) {
    this.queue.subscribe(subscriber);
  }
  public unsubscribe(subscriber: Library.Subscriber<T>) {
    this.queue.unsubscribe(subscriber);
  }
}

interface ConstructableDesignToken<T extends DesignToken.Any> {
  new (...args: any[]): T;
}

/**
 * An individual token value in a library
 */
class LibraryToken<T extends DesignToken.Any>
  implements Library.Token<any, any>, ISubscriber<LibraryToken<T>>, IWatcher
{
  #raw: DesignToken.ValueByToken<T> | Library.Alias<T, any>;
  #context: Library.Context<any>;
  #cached: DesignToken.ValueByToken<T> | typeof empty = empty;
  #subscriptions: Set<INotifier<any>> = new Set();

  public get raw() {
    return this.#raw;
  }

  public set raw(value: any) {
    this.#raw = value;
    this.#cached = empty;
    this.queue.add(this);
    getNotifier(this).notify();
  }

  constructor(
    public readonly name: string,
    value: DesignToken.ValueByToken<T> | Library.Alias<T, any>,
    public readonly type: DesignToken.TypeByToken<T>,
    context: Library.Context<any>,
    public readonly description: string,
    public readonly extensions: Record<string, any>,
    private queue: IQueue<Library.Token<DesignToken.Any, any>>,
  ) {
    this.#raw = value;
    this.#context = context;
    Object.freeze(this);
  }

  /**
   * Gets the token value
   */
  public get value(): T["value"] {
    if (this.#cached !== empty) {
      return this.#cached;
    }

    this.disconnect();
    const stopWatching = Watcher.use(this);
    const raw = isAlias(this.#raw) ? this.#raw(this.#context) : this.#raw;
    const normalized = isToken(raw) ? raw.value : raw;

    const value = isObject(normalized)
      ? recurseResolve(normalized, this.#context)
      : normalized;

    this.#cached = value;
    stopWatching();

    return value;
  }

  public set(value: DesignToken.ValueByToken<T> | Library.Alias<T, any>) {
    this.raw = value;
  }

  public onChange(token: LibraryToken<T>): void {
    this.queue.add(this);
    // Only react if the token hasn't already been invalidated
    // This prevents the token notifying multiple times
    // if a combination of it's dependencies change before
    // the value is re-calculated
    if (this.#cached !== empty) {
      this.#cached = empty;
      getNotifier(this).notify();
    }
  }

  public watch(source: Object): void {
    const notifier = getNotifier(source);
    notifier.subscribe(this);
    this.#subscriptions.add(notifier);
  }

  /**
   * Disconnect the token from it's subscriptions
   */
  public disconnect() {
    for (const record of this.#subscriptions.values()) {
      record.unsubscribe(this);
      this.#subscriptions.delete(record);
    }
  }
}
