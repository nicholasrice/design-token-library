import { DesignToken } from "./design-token.js";

export namespace Library {
  export type Library<T extends {}, R extends {} = T> = {
    [K in keyof T]: T[K] extends DesignToken.Any
      ? Token<T[K]>
      : K extends "type"
      ? DesignToken.Type
      : T[K] extends {}
      ? Library<T[K], R>
      : never;
  };

  export type Context<T extends Config<any>> = {
    // TODO: This should be provided to Alias
  };

  export type Token<T extends DesignToken.Any> = {
    set(value: DesignToken.ValueByToken<T>): void;
    readonly type: T["type"];
  } & Readonly<T>;

  export type Config<T extends {}, R extends {} = T> = {
    [K in keyof T]: T[K] extends DesignToken.Any
      ? ConfigValue<T[K]>
      : K extends "type"
      ? DesignToken.Type
      : T[K] extends {}
      ? Config<T[K], R>
      : never;
  };

  export type ConfigValue<T extends DesignToken.Any> = T & {
    value: T["value"];
  };
}

export const Library = Object.freeze({
  create,
});

function isDesignToken<T extends DesignToken.Any>(
  value: T | any
): value is DesignToken.Any {
  return "value" in value;
}

function isDesignTokenGroup(
  value: DesignToken.Group | any
): value is DesignToken.Group {
  return typeof value === "object" && value !== null && !isDesignToken(value);
}

function create<T extends {}>(
  config: Library.Config<T>
): Library.Library<T, T> {
  const library: Library.Library<any, any> = {};
  recurseCreate(library, config, library);
  return library;
}

function recurseCreate(
  library: Library.Library<any, any>,
  config: Library.Config<any>,
  context: Library.Library<any, any>,
  typeContext?: DesignToken.Type
) {
  for (const key in config) {
    if (key === "type") {
      typeContext = config[key];
      continue;
    }
    if (isDesignTokenGroup(config[key])) {
      Reflect.defineProperty(library, key, { value: {}, writable: false });
      recurseCreate(
        library[key],
        config[key],
        context,
        config[key].type || typeContext
      );
      Object.freeze(library[key]);
    } else if (isDesignToken(config[key])) {
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
class LibraryToken<T extends DesignToken.Any> implements Library.Token<any> {
  #context: Library.Library<any, any>;
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
