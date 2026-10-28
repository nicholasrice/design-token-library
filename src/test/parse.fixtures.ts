import { DesignToken } from "../lib/design-token.js";
import { Library } from "../lib/library.js";
import { hex, px } from "./values.js";

/**
 * A library that tokens documents extend, shared by the parse specs.
 */
export interface Base {
    colors: {
        $type: DesignToken.Type.Color;
        primary: DesignToken.Color;
        secondary: DesignToken.Color;
    };
    size: {
        $type: DesignToken.Type.Dimension;
        small: DesignToken.Dimension;
    };
    ratio: DesignToken.Custom<"ratio", number>;
}

export const createBase = () =>
    Library.create<Base>({
        colors: {
            $type: DesignToken.Type.Color,
            primary: { $value: hex("#0000ff") },
            secondary: { $value: hex("#ff0000") },
        },
        size: {
            $type: DesignToken.Type.Dimension,
            small: { $value: px(4) },
        },
        ratio: { $type: "ratio", $value: 1.5 },
    });
