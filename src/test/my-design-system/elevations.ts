import { DesignToken } from "../../lib/design-token.js";
import { Library } from "../../lib/library.js";
import type { Theme } from "./theme.js";

export interface Elevation {
    level: number;
    shadow: DesignToken.Values.Shadow;
}

export type ElevationToken = DesignToken.Custom<"elevation", Elevation>;

export interface Elevations {
    $type: "elevation";
    flat: ElevationToken;
    raised: ElevationToken;
}

export const elevations: Library.Config<Elevations, Theme> = {
    $type: "elevation",
    flat: {
        $value: {
            level: 0,
            shadow: {
                color: (theme) => theme.colors.neutral,
                offsetX: "0px",
                offsetY: "0px",
                blur: "0px",
                spread: "0px",
            },
        },
    },
    raised: {
        $value: (theme) => ({
            level: theme.elevations.flat.$value.level + 1,
            shadow: {
                ...theme.elevations.flat.$value.shadow,
                offsetY: theme.dimensions.unit.$value,
            },
        }),
    },
};
