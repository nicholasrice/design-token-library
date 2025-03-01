import { DesignToken } from "../../lib/design-token.js";
import { Library } from "../../lib/library.js";
import type { Theme } from "./theme.js";

export interface Borders {
    accentThin: DesignToken.Border;
    neutralThin: DesignToken.Border;
}

export const borders: Library.Config<Borders, Theme> = {
    accentThin: {
        type: DesignToken.Type.Border,
        value: {
            color: function (theme) {
                return theme.colors.accent;
            },
            style: "dashed",
            width(theme) {
                return theme.dimensions.border;
            },
        },
    },
    neutralThin: {
        type: DesignToken.Type.Border,
        value: function (theme): DesignToken.Border {
            return theme.borders.accentThin;
        },
    },
};
