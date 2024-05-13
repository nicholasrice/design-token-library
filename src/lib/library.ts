import { DesignToken } from "./design-token.js";
import { INotifier, ISubscriber, getNotifier } from "./notifier.js";
import { IQueue, Queue } from "./queue.js";
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
      config: DeepPartial<T> & Config<K, R & K>
    ): Library<T & K, R & K>; // TODO should not be any
  }

  export interface Subscriber<R extends {}> {
    onChange(records: ReadonlyArray<Library.Token<DesignToken.Any, R>>): void;
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
    config: Library.Config<T, T>
  ): Library.Library<T> => {
    return LibraryImpl.create(config);
  };
}

const isObject = <T>(value: T): value is T & {} => {
  return typeof value === "object" && value !== null;
};

/**
 * @internal
 */
const isToken = <T extends DesignToken.Any>(
  value: T | any
): value is DesignToken.Any => {
  return isObject(value) && "value" in value;
};

const isGroup = (
  value: DesignToken.Group | any
): value is DesignToken.Group => {
  return isObject(value) && !isToken(value);
};

const isAlias = <T extends DesignToken.Any, K extends {}>(
  value: any
): value is Library.Alias<T, K> => {
  return typeof value === "function";
};

const recurseCreate = (
  name: string,
  library: Library.TokenLibrary<any, any>,
  config: Library.Config<any>,
  context: Library.TokenLibrary<any, any>,
  typeContext: DesignToken.Type | null,
  queue: IQueue<Library.Token<DesignToken.Any, any>>
): void => {
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
      recurseCreate(
        _name,
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
        _name,
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
};

const recurseExtend = (
  name: string,
  sourceTokens: Library.TokenLibrary<any, any>,
  extendedTokens: Library.TokenLibrary<any, any>,
  config: Library.Config<any>, // TODO allow new config options
  context: Library.TokenLibrary<any, any>,
  typeContext: DesignToken.Type | null,
  queue: IQueue<Library.Token<DesignToken.Any, any>>
): void => {
  const keys = new Set(Object.keys(sourceTokens).concat(Object.keys(config))); // Remove duplicate keys

  for (const key of keys) {
    const sourceHasKey = key in sourceTokens;
    const configHasKey = key in config;
    const _name = name.length === 0 ? key : `${name}.${key}`;
    const keyIsGroup = isGroup(sourceTokens[key]) || isGroup(config[key]);
    const keyIsToken = isToken(sourceTokens[key]) || isToken(config[key]);

    if (key === "type") {
      typeContext = sourceTokens[key] as any;
      continue;
    }

    if (keyIsGroup) {
      Reflect.defineProperty(
        extendedTokens,
        key,
        Object.create(sourceTokens[key])
      );
      if (sourceHasKey) {
        recurseExtend(
          _name,
          sourceTokens[key] as any,
          extendedTokens[key] as any,
          config[key] || {},
          context,
          (sourceTokens.type || typeContext) as any,
          queue
        );
      } else if (configHasKey) {
        // This will always be the case
        recurseCreate(
          _name,
          sourceTokens[key] as any,
          extendedTokens[key],
          context,
          (sourceTokens.type || typeContext) as any,
          queue
        );
      }
    } else if (keyIsToken) {
      const token =
        sourceTokens[key] !== undefined
          ? extendToken(
              sourceTokens[key] as Library.Token<any, any>,
              context,
              queue,
              config[key]
            )
          : new LibraryToken(
              _name,
              config[key].value,
              config[key].type || typeContext,
              context,
              config[key].description || "",
              config[key].extensions || {},
              queue
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
  value?: any
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

class LibraryImpl<T extends {} = any> implements Library.Library<T> {
  constructor(
    public readonly tokens: Library.TokenLibrary<T>,
    private readonly queue: IQueue<Library.Token<DesignToken.Any, T>>
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
    recurseExtend("", this.tokens, tokens, config, tokens, null, queue);

    return new LibraryImpl(tokens, queue);
  }

  public static create<T extends {}>(config: Library.Config<T, T>) {
    const queue = new Queue();
    const tokens: Library.TokenLibrary<any> = {};
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
    private queue: IQueue<Library.Token<DesignToken.Any, any>>
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
