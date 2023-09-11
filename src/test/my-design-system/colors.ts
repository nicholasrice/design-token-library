import { DesignToken } from "../../lib/design-token.js";
import { DesignTokenLibraryConfig } from "../../lib/library.js";
import type { Theme } from "./theme.js";

export interface Colors {
  type: DesignToken.Type.Color;
  accent: DesignToken.Color<Theme>;
  neutral: DesignToken.Color<Theme>;
}

export const colors: DesignTokenLibraryConfig<Colors, Theme> = {
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
