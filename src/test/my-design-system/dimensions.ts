import { DesignToken } from "../../lib/design-token.js";
import { DesignTokenLibraryConfig } from "../../lib/library.js";
import { Theme } from "./theme.js";

export interface Dimensions {
  type: DesignToken.Type;
  unit: DesignToken.Dimension<Theme>;
  border: DesignToken.Dimension<Theme>;
}

export const dimensions: DesignTokenLibraryConfig<Dimensions, Theme> = {
  type: DesignToken.Type.Dimension,
  unit: { value: "4px" },
  border: { value: "1px" },
};
