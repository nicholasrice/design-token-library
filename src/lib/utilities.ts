import { DesignToken } from "./design-token.js";

export const empty = Symbol();

export type DeepPartial<T> = T extends object
    ? {
          [P in keyof T]?: T[P] extends DesignToken.Any
              ? T[P]
              : DeepPartial<T[P]>;
      }
    : T;

/**
 * Tests whether a value is a token: it has a `$value`. This is the same rule for
 * a token in config and for a token in a library's token tree, and it cannot
 * mistake a value for a token because a name or a value's field cannot begin
 * with `$` (a DTCG dimension is `{ value: 16, unit: "px" }`).
 *
 * @internal
 */
export const isToken = (value: unknown): value is { $value: any } => {
    return typeof value === "object" && value !== null && "$value" in value;
};
