import { DesignToken } from "../../lib/design-token.js";
import { Library } from "../../lib/library.js";
import { Theme } from "./theme.js";

export interface Fonts {
  body: DesignToken.FontFamily;
  heading: DesignToken.FontFamily;
  weights: {
    normal: DesignToken.FontWeight;
    heavy: DesignToken.FontWeight;
  };
}

export const fonts: Library.Config<Fonts, Theme> = {
  body: { value: ["foo", "bar"] },
  heading: {
    value: ["bat", Library.derive((theme) => theme.fonts.body)],
  },
  weights: {
    normal: { value: "normal" },
    heavy: { value: "heavy" },
  },
};
