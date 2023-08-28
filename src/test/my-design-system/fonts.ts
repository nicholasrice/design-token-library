import { DesignToken, DesignTokenLibrary } from "../../lib/design-token.js";
import { Theme } from "./theme.js";

export interface Fonts {
  body: DesignToken.FontFamily<Theme>;
  heading: DesignToken.FontFamily<Theme>;
  weights: {
    normal: DesignToken.FontWeight<Theme>;
    heavy: DesignToken.FontWeight<Theme>;
  };
}

export const fonts: DesignTokenLibrary<Fonts, Theme> = {
  body: { value: ["foo", "bar"] },
  heading: { value: ["bat", (theme: Theme) => theme.fonts.body] },
  weights: {
    normal: { value: "normal" },
    heavy: { value: "heavy" },
  },
};
