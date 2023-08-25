import { DesignToken, DesignTokenLibrary } from "../design-token.js";
import type { Theme } from "./theme.js";

export interface Colors {
  type: DesignToken.Type.Border;
  accent: DesignToken.Color;
  neutral: DesignToken.Color;
}

export const colors: DesignTokenLibrary<Colors, Theme> = {
  type: DesignToken.Type.Color,
  neutral: {
    value: "#FFFFFF",
  },
  accent: {
    value: "#0078D4",
  },
};
