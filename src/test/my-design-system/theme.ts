import { Library } from "../../lib/library.js";
import { borders, Borders } from "./borders.js";
import { colors, Colors } from "./colors.js";
import { custom, Custom } from "./custom.js";
import { dimensions, Dimensions } from "./dimensions.js";
import { fonts, Fonts } from "./fonts.js";

export interface Theme {
    borders: Borders;
    custom: Custom;
    colors: Colors;
    dimensions: Dimensions;
    fonts: Fonts;
}

export const theme: Library.Config<Theme, Theme> = {
    colors,
    custom,
    borders,
    dimensions,
    fonts,
};
