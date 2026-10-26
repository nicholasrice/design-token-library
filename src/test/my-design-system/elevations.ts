import { recipes } from "../../lib/recipe.js";
import { ref, refs } from "../../lib/ref.js";
import { DesignToken } from "../../lib/design-token.js";
import { Library } from "../../lib/library.js";
import type { Theme } from "./theme.js";
import { px } from "../values.js";

const $ = refs<Theme>();

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

const { raise } = recipes({
    // A shadow is one layer or several: raise each layer.
    raise: (
        elevation: DesignToken.DeepReadonly<Elevation>,
        offsetY: DesignToken.Values.Readonly.Dimension,
    ): DesignToken.DeepReadonly<Elevation> => ({
        level: elevation.level + 1,
        shadow: [elevation.shadow]
            .flat()
            .map((layer) => ({ ...layer, offsetY })),
    }),
});

export const elevations: Library.Config<Elevations, Theme> = {
    $type: "elevation",
    flat: {
        $value: {
            level: 0,
            shadow: {
                color: $.colors.neutral,
                offsetX: px(0),
                offsetY: px(0),
                blur: px(0),
                spread: px(0),
            },
        },
    },
    raised: {
        $value: raise(ref("elevations.flat"), ref("dimensions.unit")),
    },
};
