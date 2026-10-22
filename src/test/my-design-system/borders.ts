import { DesignToken } from "../../lib/design-token.js";
import { refs } from "../../lib/ref.js";
import { Library } from "../../lib/library.js";
import type { Theme } from "./theme.js";

const $ = refs<Theme>();

export interface Borders {
    $type: DesignToken.Type.Border;
    accentThin: DesignToken.Border;
    neutralThin: DesignToken.Border;
}

export const borders: Library.Config<Borders, Theme> = {
    $type: DesignToken.Type.Border,
    accentThin: {
        $value: {
            color: $.colors.accent,
            style: "dashed",
            width: $.dimensions.border,
        },
    },
    neutralThin: {
        $value: $.borders.accentThin,
    },
};
