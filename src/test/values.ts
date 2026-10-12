import type { DesignToken } from "../lib/design-token.js";

export { hex, ms, px, rem, s } from "../lib/values.js";

/**
 * The CSS hex string for an sRGB color, in lower case, without alpha.
 */
export const toHex = (color: DesignToken.Values.Color): string => {
    return (
        "#" +
        color.components
            .map((component) =>
                Math.round((component as number) * 255)
                    .toString(16)
                    .padStart(2, "0"),
            )
            .join("")
    );
};
