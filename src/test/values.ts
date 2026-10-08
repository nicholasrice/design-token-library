import type { DesignToken } from "../lib/design-token.js";

/**
 * Builds a 2025.10 sRGB color from a CSS hex string: `#RGB`, `#RRGGBB` or
 * `#RRGGBBAA`.
 */
export const hex = (css: string): DesignToken.Values.Color => {
    let digits = css.slice(1);

    if (digits.length === 3) {
        digits = [...digits].map((digit) => digit + digit).join("");
    }

    const byte = (index: number) =>
        parseInt(digits.slice(index, index + 2), 16);
    const color: DesignToken.Values.Color = {
        colorSpace: "srgb",
        components: [byte(0) / 255, byte(2) / 255, byte(4) / 255],
    };

    if (digits.length === 8) {
        color.alpha = byte(6) / 255;
    }

    return color;
};

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

export const px = (value: number): DesignToken.Values.Dimension => ({
    value,
    unit: "px",
});

export const rem = (value: number): DesignToken.Values.Dimension => ({
    value,
    unit: "rem",
});

export const ms = (value: number): DesignToken.Values.Duration => ({
    value,
    unit: "ms",
});
