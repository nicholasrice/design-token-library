import { DesignToken } from "./design-token.js";

export const empty = Symbol();

export type DeepPartial<T> = T extends object
  ? {
      [P in keyof T]?: T[P] extends DesignToken.Any ? T[P] : DeepPartial<T[P]>;
    }
  : T;
