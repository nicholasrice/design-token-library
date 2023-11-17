import { DesignToken } from "./design-token.js";

export namespace Library {
  export type Library<T extends {}> = LibraryInternal<T, T>;

  interface LibraryInternal<T extends {}, R extends {}> {
    tokens: TokenLibrary<T, R>;
  }

  /**
   * Defines a token library that can be interacted with
   * to mutate token values.
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
   */
  export type Alias<T extends DesignToken.Any, R extends Context<any>> = (
    context: R
  ) => T | DesignToken.ValueByToken<T>;

  /**
   * An {@link Alias} that supports complex token value types
   * such as {@link DesignToken.Border}
   */
  export type DeepAlias<
    V extends DesignToken.Any,
    T extends Context<any>
  > = V extends {}
    ? {
        [K in keyof DesignToken.ValueByToken<V>]:
          | DesignToken.ValueByToken<V>[K]
          | Alias<DesignToken.TokenByValue<DesignToken.ValueByToken<V>[K]>, T>;
      }
    : never;

  /**
   * Context object provided to {@link Alias} values at runtime
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
   * A token in a {@link TokenLibrary.TokenLibrary}
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
   * A configuration object provided to {@link TokenLibrary.create}
   */
  export type Config<T extends {}, R extends {} = T> = {
    [K in keyof T]: T[K] extends DesignToken.Any
      ? ConfigValue<T[K], R>
      : T[K] extends {}
      ? Config<T[K], R>
      : never;
  };

  export type ConfigValue<T extends DesignToken.Any, R extends {}> =
    | T
    // There is an odd TypeScript type error that occurs if this is simply
    // assign Omit<T, "value"> & { value...} where if the type of the argument
    // in Library.create is untyped, it cannot be inferred, so use T | ...
    | (Omit<T, "value"> & {
        value: Library.Alias<T, Context<R>> | Library.DeepAlias<T, Context<R>>;
      });
}

/**
 * Library export containing library functions.
 */
export const Library = Object.freeze({
  /**
   * Creates a new {@link Library.TokenLibrary} form a {@link Library.Config}.
   */
  create,
  anonymousToken() {},
});

function create<T extends {} = any>(
  config: Library.Config<T, T>
): Library.Library<T> {
  const library: Library.TokenLibrary<any, any> = {};
  recurseCreate("", library, config, library, null);
  return {
    tokens: library,
  };
}

function isObject<T>(value: T): value is T & {} {
  return typeof value === "object" && value !== null;
}

function isToken<T extends DesignToken.Any>(
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
  typeContext: DesignToken.Type | null
) {
  for (const key in config) {
    if (key === "type") {
      typeContext = config[key] as any;
      continue;
    }

    name = name.length === 0 ? key : `${name}.${key}`;

    if (isGroup(config[key])) {
      Reflect.defineProperty(library, key, { value: {}, writable: false });
      recurseCreate(
        name,
        library[key] as any,
        config[key],
        context,
        config[key].type || typeContext
      );
      Object.freeze(library[key]);
    } else if (isToken(config[key])) {
      const { value, type, description, extensions } = config[key];
      if (!type && !typeContext) {
        throw new Error(
          `No 'type' found for token '${key}'. Types cannot be inferred, please add a type to the token or to a group ancestor.`
        );
      }
      Reflect.defineProperty(library, key, {
        value: new LibraryToken(
          name,
          value,
          type || typeContext,
          context,
          description || "",
          extensions || {}
        ),
      });
    }
  }
}

/**
 * An individual token value in a library
 */
class LibraryToken<T extends DesignToken.Any>
  implements Library.Token<any, any>
{
  #context: Library.Context<any>;
  #value: DesignToken.ValueByToken<T> | Library.Alias<T, any>;

  constructor(
    public readonly name: string,
    value: DesignToken.ValueByToken<T> | Library.Alias<T, any>,
    public readonly type: DesignToken.TypeByToken<T>,
    context: Library.Context<any>,
    public readonly description: string,
    public readonly extensions: Record<string, any>
  ) {
    this.#value = value;
    this.#context = context;
    Object.freeze(this);
  }

  /**
   * Gets the token value
   */
  public get value(): T["value"] {
    if (isAlias(this.#value)) {
      const value = this.#value(this.#context);

      if (isToken(value)) {
        return value.value;
      } else {
        return value;
      }
    } else {
      return this.#value;
    }
  }

  public set(value: DesignToken.ValueByToken<T> | Library.Alias<T, any>) {
    if (this.#value !== value) {
      this.#value = value;
    }
  }
}

/**
 *
 *
 * TODO:
 * 1. System of Notification
 */
