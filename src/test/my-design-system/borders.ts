import { DesignToken } from "../../lib/design-token.js";
import { DesignTokenLibraryConfig } from "../../lib/library.js";
import type { Theme } from "./theme.js";

export interface Borders {
  type: DesignToken.Type.Border;
  accentThin: DesignToken.Border<Theme>;
  neutralThin: DesignToken.Border<Theme>;
}

export const borders: DesignTokenLibraryConfig<Borders, Theme> = {
  type: DesignToken.Type.Border,
  accentThin: {
    value: {
      color: function (theme: Theme) {
        return theme.colors.accent;
      },
      style: "dashed",
      width(theme) {
        return theme.dimensions.border;
      },
    },
  },
  neutralThin: {
    value: function (theme: Theme): DesignToken.Border<Theme> {
      return theme.borders.accentThin;
    },
  },
};
