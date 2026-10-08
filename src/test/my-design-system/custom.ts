import { DesignToken } from "../../lib/design-token.js";
import { Library } from "../../lib/library.js";
import { Theme } from "./theme.js";

export interface Custom {
    a: DesignToken.Custom<{ a: number; b: string }>;
    b: DesignToken.Custom<{ a: DesignToken.Color; b: [string, string] }>;
    c: DesignToken.Custom<{ a: number; b: string }>;
    d: DesignToken.Custom<{ a: DesignToken.Color }>;
    e: DesignToken.Custom<{ a: DesignToken.Border }>;
}

export const custom: Library.Config<Custom, Theme> = {
    a: {
        type: DesignToken.Type.Custom,
        value: { a: 12, b: "foobar" },
    },
    b: {
        type: DesignToken.Type.Custom,
        value(ctx) {
            return { a: ctx.colors.accent, b: ["hello", "world"] };
        },
    },
    c: {
        type: DesignToken.Type.Custom,
        value(ctx) {
            return ctx.custom.a;
        },
    },
    d: {
        type: DesignToken.Type.Custom,
        value: {
            a: (ctx) => ctx.colors.accent,
        },
    },

    e: {
        type: DesignToken.Type.Custom,
        value: {
            a: {
                type: DesignToken.Type.Border,
                value(ctx) {
                    return {
                        color: ctx.colors.accent.value,
                        style: "dashed",
                        width: ctx.dimensions.border.value,
                    };
                },
            },
        },
    },
};
