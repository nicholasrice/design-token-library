import { DesignToken } from "../../lib/design-token.js";
import { Library } from "../../lib/library.js";
import type { Theme } from "./theme.js";

export interface Colors {
    accent: DesignToken.Color;
    neutral: DesignToken.Color;
}

export const colors: Library.Config<Colors, Theme> = {
    neutral: {
        type: DesignToken.Type.Color,
        value: "#FFFFFF",
    },
    accent: {
        type: DesignToken.Type.Color,
        value: function (theme) {
            return theme.colors.neutral;
        },
    },
};
