import type { DesignToken } from "./design-token.js";

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

/**
 * Builds a 2025.10 sRGB color from a CSS hex string: `#RGB`, `#RRGGBB` or
 * `#RRGGBBAA`.
 *
 * @throws A `TypeError` when the string is not a hex color.
 *
 * @public
 */
export const hex = (css: string): DesignToken.Values.Color => {
    if (!HEX.test(css)) {
        throw new TypeError(`Invalid hex color: ${css}`);
    }

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
 * Builds a dimension in pixels.
 *
 * @public
 */
export const px = (value: number): DesignToken.Values.Dimension => ({
    value,
    unit: "px",
});

/**
 * Builds a dimension in rems.
 *
 * @public
 */
export const rem = (value: number): DesignToken.Values.Dimension => ({
    value,
    unit: "rem",
});

/**
 * Builds a duration in milliseconds.
 *
 * @public
 */
export const ms = (value: number): DesignToken.Values.Duration => ({
    value,
    unit: "ms",
});

/**
 * Builds a duration in seconds.
 *
 * @public
 */
export const s = (value: number): DesignToken.Values.Duration => ({
    value,
    unit: "s",
});
