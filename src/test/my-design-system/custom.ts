import { DesignToken } from "../../lib/design-token.js";
import { Library } from "../../lib/library.js";
import { Theme } from "./theme.js";

export interface Custom {
  type: DesignToken.Type.Custom;
  a: DesignToken.Custom<{ a: number; b: string }>;
  b: DesignToken.Custom<{ a: DesignToken.Values.Color; b: [string, string] }>;
  c: DesignToken.Custom<{ a: number; b: string }>;
}

export const custom: Library.Config<Custom, Theme> = {
  type: DesignToken.Type.Custom,
  a: {
    type: DesignToken.Type.Custom,
    value: { a: 12, b: "foobar" },
  },
  b: {
    value(ctx) {
      return { a: ctx.colors.accent.value, b: ["hello", "world"] };
    },
  },
  c: {
    value(ctx) {
      return ctx.custom.a;
    },
  },
};
