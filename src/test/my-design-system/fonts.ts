import { DesignToken } from "../../lib/design-token.js";
import { Library } from "../../lib/library.js";
import { Theme } from "./theme.js";

export interface Fonts {
    body: DesignToken.FontFamily;
    heading: DesignToken.FontFamily;
    weights: {
        normal: DesignToken.FontWeight;
        heavy: DesignToken.FontWeight;
    };
}

export const fonts: Library.Config<Fonts, Theme> = {
    body: {
        type: DesignToken.Type.FontFamily,
        value: ["foo", "bar"],
    },
    heading: {
        type: DesignToken.Type.FontFamily,
        value: ["bat", (theme) => theme.fonts.body],
    },
    weights: {
        normal: {
            type: DesignToken.Type.FontWeight,
            value: "normal",
        },
        heavy: {
            type: DesignToken.Type.FontWeight,
            value: "heavy",
        },
    },
};
