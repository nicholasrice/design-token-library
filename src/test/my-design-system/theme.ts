import { Library } from "../../lib/library.js";
import { borders, Borders } from "./borders.js";
import { colors, Colors } from "./colors.js";
import { dimensions, Dimensions } from "./dimensions.js";
import { elevations, Elevations } from "./elevations.js";
import { fonts, Fonts } from "./fonts.js";

export interface Theme {
    borders: Borders;
    colors: Colors;
    dimensions: Dimensions;
    elevations: Elevations;
    fonts: Fonts;
}

export const theme: Library.Config<Theme, Theme> = {
    colors,
    borders,
    dimensions,
    elevations,
    fonts,
};
