import { DesignToken, DesignTokenLibrary } from "../design-token.js";
import type { Theme } from "./theme.js";

export interface Borders {
  type: DesignToken.Type.Border;
  accentThin: DesignToken.Border<Theme>;
  neutralThin: DesignToken.Border<Theme>;
}

export const borders: DesignTokenLibrary<Borders, Theme> = {
  type: DesignToken.Type.Border,
  accentThin: {
    value: {
      color: function (theme: Theme) {
        return theme.colors.accent;
      },
      style: "dashed",
      width: "2px",
    },
  },
  neutralThin: {
    value: function (theme: Theme): DesignToken.Border<Theme> {
      return theme.borders.accentThin;
    },
  },
};
