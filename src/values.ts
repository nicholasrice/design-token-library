export type StaticValue<T> = T;
export type DerivedValue<DS, T> = (this: DS) => T;
export type DesignTokenValue<DS, T> = DerivedValue<DS, T> | StaticValue<T>;
export type DesignTokenConfiguration<DS, T> = {
    value: DerivedValue<DS, T> | StaticValue<T>;
    description?: string;
}

/**
 * @internal
 */
export function isDerivedValue<DS, T>(value: DesignTokenValue<DS, T>): value is DerivedValue<DS, T> {
    return typeof value === "function";
}

/**
 * @internal
 */
export function isConfigurationValue<DS, T>(value: unknown): value is DesignTokenConfiguration<DS, T> {
    return typeof value === "object" && value !== null && "$value" in value;
}

/**
 * @internal
 */
export function isStaticValue<DS, T>(value: DesignTokenValue<DS, T>): value is StaticValue<T> {
    return !isDerivedValue(value) && !isConfigurationValue(value) && !isLibrarySection(value);
}

export function isLibrarySection(value: unknown): value is object {
    return typeof value === "object" && value !== null && !isConfigurationValue(value);
}