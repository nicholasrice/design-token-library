import { DesignToken } from "../../lib/design-token.js";
import { Library } from "../../lib/library.js";
import type { Theme } from "./theme.js";

export interface Borders {
  type: DesignToken.Type.Border;
  accentThin: DesignToken.Border;
  neutralThin: DesignToken.Border;
}

export const borders: Library.Config<Borders, Theme> = {
  type: DesignToken.Type.Border,
  accentThin: {
    value: {
      color: Library.derive(function (theme) {
        return theme.colors.accent;
      }),
      style: "dashed",
      width: Library.derive((theme) => {
        return theme.dimensions.border;
      }),
    },
  },
  neutralThin: {
    value: Library.derive(function (theme): DesignToken.Border {
      return theme.borders.accentThin;
    }),
  },
};
