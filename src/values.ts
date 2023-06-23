export type DerivedValue<DSL, T> = (this: DSL) => T;
export type StaticValue<T> = T;
export type DesignTokenValueConfiguration<DSL, T> = {
    $value: DerivedValue<DSL, T> | StaticValue<T>;
    description?: string;
    name?: string;
}
export type DesignTokenValue<DSL, T> = DerivedValue<DSL, T> | StaticValue<T> | DesignTokenValueConfiguration<DSL, T>;

/**
 * @internal
 */
export function isDerivedValue<DSL, T>(value: DesignTokenValue<DSL, T>): value is DerivedValue<DSL, T> {
    return typeof value === "function";
}

/**
 * @internal
 */
export function isConfigurationValue<DSL, T>(value: DesignTokenValue<DSL, T>): value is DesignTokenValueConfiguration<DSL, T> {
    return typeof value === "object" && value !== null && "$value" in value;
}

/**
 * @internal
 */
export function isStaticValue<DSL, T>(value: DesignTokenValue<DSL, T>): value is StaticValue<T> {
    return !isDerivedValue(value) && !isConfigurationValue(value) && !isLibrarySection(value);
}

export function isLibrarySection(value: unknown): value is object {
    return typeof value === "object" && value !== null && !isConfigurationValue(value);
}