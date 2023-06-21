export type DerivedValue<DSL, T> = (this: DSL) => T;
export type DesignTokenValue<DSL, T> = DerivedValue<DSL, T> | T;