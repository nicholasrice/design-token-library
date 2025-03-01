import { DesignToken } from "../../lib/design-token.js";
import { Library } from "../../lib/library.js";
import type { Theme } from "./theme.js";

export interface Colors {
    type: DesignToken.Type.Color;
    accent: DesignToken.Color;
    neutral: DesignToken.Color;
}

export const colors: Library.Config<Colors, Theme> = {
    type: DesignToken.Type.Color,
    neutral: {
        value: "#FFFFFF",
    },
    accent: {
        value: function (theme) {
            return theme.colors.neutral;
        },
    },
};
