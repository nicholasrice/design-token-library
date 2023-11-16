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
      color: "#FFF000",
      // color: function (theme: Theme) {
      //   return theme.colors.accent;
      // },
      style: "dashed",
      // width(theme) {
      //   return theme.dimensions.border;
      // },
      width: "2px",
    },
  },
  neutralThin: {
    value: {
      color: "#000000",
      style: "solid",
      width: "4px",
    },
    // value: function (theme: Theme): DesignToken.Border {
    //   return theme.borders.accentThin;
    // },
  },
};
