import { DesignToken } from "../../lib/design-token.js";
import { Library } from "../../lib/library.js";
import type { Theme } from "./theme.js";
import { px } from "../values.js";

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
                offsetX: px(0),
                offsetY: px(0),
                blur: px(0),
                spread: px(0),
            },
        },
    },
    raised: {
        // A shadow is one layer or several: raise each layer.
        $value: (theme) => ({
            level: theme.elevations.flat.$value.level + 1,
            shadow: [theme.elevations.flat.$value.shadow]
                .flat()
                .map((layer) => ({
                    ...layer,
                    offsetY: theme.dimensions.unit.$value,
                })),
        }),
    },
};
