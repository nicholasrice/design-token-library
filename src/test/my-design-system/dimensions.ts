import { DesignToken } from "../../lib/design-token.js";
import { Library } from "../../lib/library.js";
import { Theme } from "./theme.js";
import { px } from "../values.js";

export interface Dimensions {
    $type: DesignToken.Type.Dimension;
    unit: DesignToken.Dimension;
    border: DesignToken.Dimension;
}

export const dimensions: Library.Config<Dimensions, Theme> = {
    $type: DesignToken.Type.Dimension,
    unit: { $value: px(4) },
    border: { $value: px(1) },
};
