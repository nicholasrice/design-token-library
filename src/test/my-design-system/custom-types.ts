/**
 * Custom (non-DTCG) token types, registered through declaration merging into
 * `DesignToken.TypeDefinitions`. Token interfaces are declared directly:
 * `DesignToken.Properties` stays constrained to the DTCG types.
 */
export type FontStyleValue = "regular" | "italic";

export interface FontStyleToken {
    $description?: string;
    $type?: "fontStyle";
    $extensions?: Record<string, any>;
    $value: FontStyleValue;
}

export interface BooleanToken {
    $description?: string;
    $type?: "boolean";
    $extensions?: Record<string, any>;
    $value: boolean;
}

/**
 * A composite custom $value: `visible` is not a DTCG value, `color` is.
 */
export interface BadgeValue {
    visible: boolean;
    color: `#${string}`;
}

export interface BadgeToken {
    $description?: string;
    $type?: "badge";
    $extensions?: Record<string, any>;
    $value: BadgeValue;
}

declare module "../../lib/design-token.js" {
    namespace DesignToken {
        interface TypeDefinitions {
            fontStyle: { value: FontStyleValue; token: FontStyleToken };
            boolean: { value: boolean; token: BooleanToken };
            badge: { value: BadgeValue; token: BadgeToken };
        }
    }
}
