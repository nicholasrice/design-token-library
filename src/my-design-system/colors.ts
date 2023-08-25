import { DesignToken, DesignTokenLibrary } from "../design-token.js";
import type { Theme } from "./theme.js";

export interface Colors {
  type: DesignToken.Type.Color;
  accent: DesignToken.Color<Theme>;
  neutral: DesignToken.Color<Theme>;
}

export const colors: DesignTokenLibrary<Colors, Theme> = {
  type: DesignToken.Type.Color,
  neutral: {
    value: "#FFFFFF",
  },
  accent: {
    value: function (theme: Theme) {
      return theme.colors.neutral;
    },
  },
};
