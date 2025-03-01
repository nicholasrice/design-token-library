import { DesignToken } from "../../lib/design-token.js";
import { Library } from "../../lib/library.js";
import { Theme } from "./theme.js";

export interface Dimensions {
    type: DesignToken.Type;
    unit: DesignToken.Dimension;
    border: DesignToken.Dimension;
}

export const dimensions: Library.Config<Dimensions, Theme> = {
    type: DesignToken.Type.Dimension,
    unit: { value: "4px" },
    border: { value: "1px" },
};
