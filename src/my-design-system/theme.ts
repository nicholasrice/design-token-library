import { DesignTokenLibrary } from "../design-token.js";
import { borders, Borders } from "./borders.js";
import { colors, Colors } from "./colors.js";
import { dimensions, Dimensions } from "./dimensions.js";

export interface Theme {
  borders: Borders;
  colors: Colors;
  dimensions: Dimensions;
}

const theme: DesignTokenLibrary<Theme> = {
  colors,
  borders,
  dimensions,
};
