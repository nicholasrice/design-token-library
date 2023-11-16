import { DesignToken } from "./design-token.js";

export namespace Library {
  /**
   * Defines a token library that can be interacted with
   * to mutate token values.
   */
  export type Library<T extends {}, R extends {} = T> = {
    [K in keyof T]: T[K] extends DesignToken.Any
      ? Token<T[K], R>
      : K extends "type"
      ? DesignToken.Type
      : T[K] extends {}
      ? Library<T[K], R>
      : never;
  };

  /**
   * A token value that serves as an alias to another token value
   */
  export type Alias<T extends DesignToken.Any, R extends Context<any>> = (
    context: R
  ) => T;

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
    [K in keyof T]: T[K] extends DesignToken.Any
      ? Readonly<Omit<Token<T[K], R>, "set">>
      : K extends "type"
      ? DesignToken.Type
      : T[K] extends {}
      ? Context<T[K], R>
      : never;
  };

  /**
   * A token in a {@link Library.Library}
   */
  export type Token<T extends DesignToken.Any, C extends {}> = {
    set(value: DesignToken.ValueByToken<T> | Alias<T, C>): void;
    readonly type: T["type"];
  } & Readonly<T>;

  /**
   * A configuration object provided to {@link Library.create}
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
   * Creates a new {@link Library.Library} form a {@link Library.Config}.
   */
  create,
});

function create<T extends {} = any>(
  config: Library.Config<T, T>
): Library.Library<T, T> {
  const library: Library.Library<any, any> = {};
  recurseCreate(library, config, library);
  return library;
}

function isToken<T extends DesignToken.Any>(
  value: T | any
): value is DesignToken.Any {
  return "value" in value;
}

function isGroup(value: DesignToken.Group | any): value is DesignToken.Group {
  return typeof value === "object" && value !== null && !isToken(value);
}

function recurseCreate(
  library: Library.Library<any, any>,
  config: Library.Config<any>,
  context: Library.Library<any, any>,
  typeContext?: DesignToken.Type
) {
  for (const key in config) {
    if (key === "type") {
      typeContext = config[key] as any;
      continue;
    }
    if (isGroup(config[key])) {
      Reflect.defineProperty(library, key, { value: {}, writable: false });
      recurseCreate(
        library[key],
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
          value,
          type || typeContext,
          context,
          description,
          extensions
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
  #context: Library.Library<any, any>; // TODO: This should be Library.Context
  #value: T["value"];
  public readonly description?: string;
  public extensions: Record<string, unknown>;
  public type: Required<T>["type"];

  constructor(
    value: T["value"],
    type: Required<T>["type"],
    context: Library.Library<any, any>,
    description: T["description"] = undefined,
    extensions: T["extensions"] = {}
  ) {
    this.description = description;
    this.extensions = extensions;
    this.type = type;
    this.#value = value;
    this.#context = context;
  }
  /**
   * Gets the token value
   */
  public get value(): T["value"] {
    return this.#value;
  }

  public set(value: T["value"]) {
    if (this.#value !== value) {
      this.#value = value;
    }
  }
}
