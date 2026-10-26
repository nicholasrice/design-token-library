import { refs } from "../../lib/ref.js";
import { DesignToken } from "../../lib/design-token.js";
import { Library } from "../../lib/library.js";
import { Theme } from "./theme.js";

const $ = refs<Theme>();

export interface Fonts {
    $type: DesignToken.Type.FontFamily;
    body: DesignToken.FontFamily;
    heading: DesignToken.FontFamily;
    weights: {
        $type: DesignToken.Type.FontWeight;
        normal: DesignToken.FontWeight;
        heavy: DesignToken.FontWeight;
    };
}

export const fonts: Library.Config<Fonts, Theme> = {
    $type: DesignToken.Type.FontFamily,
    body: { $value: ["foo", "bar"] },
    heading: { $value: $.fonts.body },
    weights: {
        $type: DesignToken.Type.FontWeight,
        normal: { $value: "normal" },
        heavy: { $value: "heavy" },
    },
};
