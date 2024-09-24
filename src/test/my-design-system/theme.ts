import { Library } from "../../lib/library.js";
import { borders, Borders } from "./borders.js";
import { colors, Colors } from "./colors.js";
import { custom, Custom } from "./custom.js";
import { dimensions, Dimensions } from "./dimensions.js";
import { fonts, Fonts } from "./fonts.js";

export interface Theme {
  custom: Custom;
  borders: Borders;
  colors: Colors;
  dimensions: Dimensions;
  fonts: Fonts;
}

export const theme: Library.Config<Theme, Theme> = {
  custom,
  colors,
  borders,
  dimensions,
  fonts,
};

export const library = Library.create(theme);
