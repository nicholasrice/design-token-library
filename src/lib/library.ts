import { DesignToken } from "./design-token.js";
import { ISubscriptionSubject, ISubscriber, getNotifier } from "./notifier.js";
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
    update(records: ReadonlyArray<Library.Token<DesignToken.Any, R>>): void;
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
    context: R
  ) => T | DesignToken.ValueByToken<T>;

  /**
   * An {@link (Library:namespace).Alias} that supports complex token value types
   * such as {@link DesignToken.Border}
   *
   * @public
   */
  export type DeepAlias<
    V extends DesignToken.Values.Any,
    T extends Context<any>
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
  export function create<T extends {} = any>(
    config: Library.Config<T, T>
  ): Library.Library<T> {
    return new LibraryImpl(config);
  }
}

function isObject<T>(value: T): value is T & {} {
  return typeof value === "object" && value !== null;
}

export function isToken<T extends DesignToken.Any>(
  value: T | any
): value is DesignToken.Any {
  return isObject(value) && "value" in value;
}

function isGroup(value: DesignToken.Group | any): value is DesignToken.Group {
  return isObject(value) && !isToken(value);
}

function isAlias<T extends DesignToken.Any, K extends {}>(
  value: any
): value is Library.Alias<T, K> {
  return typeof value === "function";
}

function recurseCreate(
  name: string,
  library: Library.TokenLibrary<any, any>,
  config: Library.Config<any>,
  context: Library.TokenLibrary<any, any>,
  typeContext: DesignToken.Type | null,
  queue: IQueue<Library.Token<DesignToken.Any, any>>
) {
  for (const key in config) {
    if (key === "type") {
      typeContext = config[key] as any;
      continue;
    }

    name = name.length === 0 ? key : `${name}.${key}`;

    if (isGroup(config[key])) {
      Reflect.defineProperty(library, key, {
        value: {},
        enumerable: true,
      });
      recurseCreate(
        name,
        library[key] as any,
        config[key],
        context,
        config[key].type || typeContext,
        queue
      );
      Object.freeze(library[key]);
    } else if (isToken(config[key])) {
      const { value, type, description, extensions } = config[key];
      if (!type && !typeContext) {
        throw new Error(
          `No 'type' found for token '${key}'. Types cannot be inferred, please add a type to the token or to a group ancestor.`
        );
      }
      const token = new LibraryToken(
        name,
        value,
        type || typeContext,
        context,
        description || "",
        extensions || {},
        queue
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
}

function recurseResolve(value: any, context: Library.Context<any>) {
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
}

class LibraryImpl<T extends {} = any> implements Library.Library<T> {
  private readonly queue: IQueue<Library.Token<DesignToken.Any, T>> =
    new Queue();
  constructor(config: Library.Config<T, T>) {
    const tokens: Library.TokenLibrary<any, any> = {};
    recurseCreate("", tokens, config, tokens, null, this.queue);
    this.tokens = tokens;
  }
  public tokens: Library.TokenLibrary<T, T>;
  public subscribe(subscriber: any) {
    this.queue.subscribe(subscriber);
  }
  public unsubscribe = this.queue.unsubscribe;
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
  #context: Library.Context<any>;
  #raw: DesignToken.ValueByToken<T> | Library.Alias<T, any>;
  #cached: DesignToken.ValueByToken<T> | typeof empty = empty;
  #subscriptions: Set<ISubscriptionSubject<any>> = new Set();

  constructor(
    public readonly name: string,
    value: DesignToken.ValueByToken<T> | Library.Alias<T, any>,
    public readonly type: DesignToken.TypeByToken<T>,
    context: Library.Context<any>,
    public readonly description: string,
    public readonly extensions: Record<string, any>,
    private queue: IQueue<Library.Token<DesignToken.Any, any>>
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
    const unregister = Watcher.use(this);
    const raw = isAlias(this.#raw) ? this.#raw(this.#context) : this.#raw;
    const normalized = isToken(raw) ? raw.value : raw;

    const value = isObject(normalized)
      ? recurseResolve(normalized, this.#context)
      : normalized;

    this.#cached = value;
    unregister();

    return value;
  }

  public set(value: DesignToken.ValueByToken<T> | Library.Alias<T, any>) {
    this.#raw = value;
    this.update();
  }

  public update(): void {
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
    const subs = this.#subscriptions;
    for (const record of subs.values()) {
      record.unsubscribe(this);
      subs.delete(record);
    }
  }
}
