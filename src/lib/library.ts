import { Observable } from "@microsoft/fast-element";
/**
 * const library = DesignTokenLibrary.create({
 * .. //
 * })
 */

import { DesignToken } from "./design-token.js";

/**
 * Describes
 * library.tokenName.value // readonly, the current token value
 * library.tokenName.set(value) // Sets the token value. value arg can be fn or value
 */
export type IDesignTokenLibrary<T extends {}, R extends {} = T> = {
  [K in keyof T]: T[K] extends DesignToken.Any
    ? IDesignTokenLibraryValue<T[K]>
    : K extends "type"
    ? DesignToken.Type
    : T[K] extends {}
    ? IDesignTokenLibrary<T[K], R>
    : never;
};

export type IDesignTokenLibraryValue<T extends DesignToken.Any> = {
  set(value: T["value"]): void;
  readonly value: DesignToken.ValueByToken<T>;
  readonly type: T["type"];
} & Readonly<Omit<T, "value">>;

export type DesignTokenLibraryConfig<T extends {}, R extends {} = T> = {
  [K in keyof T]: T[K] extends DesignToken.Any
    ? T[K]
    : K extends "type"
    ? DesignToken.Type
    : T[K] extends {}
    ? DesignTokenLibraryConfig<T[K], R>
    : never;
};

export const DesignTokenLibraryFactory = Object.freeze({
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
  config: DesignTokenLibraryConfig<T>
): IDesignTokenLibrary<T, T> {
  const library: IDesignTokenLibrary<any, any> = {};
  recurseCreate(library, config, library);
  return library;
}

function recurseCreate(
  library: IDesignTokenLibrary<any, any>,
  config: DesignTokenLibraryConfig<any>,
  context: IDesignTokenLibrary<any, any>,
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
class LibraryToken<T extends DesignToken.Any> {
  #context: IDesignTokenLibrary<any, any>;
  #value: T["value"];
  public readonly description?: string;
  public extensions: Record<string, unknown>;
  public type: Required<T>["type"];

  constructor(
    value: T["value"],
    type: Required<T>["type"],
    context: IDesignTokenLibrary<any, any>,
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
  public get value(): DesignToken.ValueByToken<T> {
    Observable.track(this, "value");

    if (typeof this.#value === "function") {
      return this.#value(this.#context).value as DesignToken.ValueByToken<T>;
    } else {
      return this.#value as any;
    }
  }

  public set(value: T["value"]) {
    if (this.#value !== value) {
      this.#value = value;
      Observable.notify(this, "value");
    }
  }
}
