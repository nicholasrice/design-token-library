/**
 * Type source: https://second-editors-draft.tr.designtokens.org/format/#types
 */
export type DesignTokenType =
  | "color"
  | "dimension"
  | "fontFamily"
  | "fontWeight"
  | "duration"
  | "cubicBezier";

/**
 * A stable value that is not derived from other token values
 */
export type InertValue<T> = T;

/**
 * A token that uses other tokens to derive it's value
 */
export type DerivedValue<DS, T> = (this: DS) => T;

/**
 * An object describing the token value
 */
export type DesignTokenConfiguration<DS, T> = {
  value: DerivedValue<DS, T> | InertValue<T>;
  description?: string;
  name?: string;
  type?: DesignTokenType;
};

/**
 * All possible methods for defining a design token
 */
export type DesignTokenValue<DS, T> =
  | DerivedValue<DS, T>
  | InertValue<T>
  | DesignTokenConfiguration<DS, T>;

/**
 * @internal
 */
export function isDerivedValue<DS, T>(
  value: DesignTokenValue<DS, T>
): value is DerivedValue<DS, T> {
  return typeof value === "function";
}

/**
 * @internal
 */
export function isConfigurationValue<DS, T>(
  value: unknown
): value is DesignTokenConfiguration<DS, T> {
  return typeof value === "object" && value !== null && "value" in value;
}

/**
 * @internal
 */
export function isInertValue<DS, T>(
  value: DesignTokenValue<DS, T>
): value is InertValue<T> {
  return (
    !isGroup(value) && !isDerivedValue(value) && !isConfigurationValue(value)
  );
}

export function isDesignTokenValue<DS, T>(
  value: unknown
): value is DesignTokenValue<DS, T> {
  return (
    isConfigurationValue(value) || isDerivedValue(value) || isInertValue(value)
  );
}

export function isGroup(value: unknown): value is object {
  return (
    typeof value === "object" && value !== null && !isConfigurationValue(value)
  );
}
