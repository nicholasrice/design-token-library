import { DesignToken } from "../../lib/design-token.js";
import { Library } from "../../lib/library.js";
import { Theme } from "./theme.js";

export interface Dimensions {
    unit: DesignToken.Dimension;
    border: DesignToken.Dimension;
}

export const dimensions: Library.Config<Dimensions, Theme> = {
    unit: {
        type: DesignToken.Type.Dimension,
        value: "4px",
    },
    border: {
        type: DesignToken.Type.Dimension,
        value: "1px",
    },
};
