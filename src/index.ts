import { DesignTokenResult } from "./design-token-result.js";

export type DerivedValue<DSL, T> = (this: DSL) => T;
export type DesignTokenValue<DSL, T> = DerivedValue<DSL, T> | T;
export type DesignTokenLibrary<DSL extends {}, R = never> = {
  [K in keyof DSL]: DSL[K] extends object
    ? DesignTokenLibrary<DSL[K], DSL>
    : DesignTokenValue<R, DSL[K]>;
};
export type DesignTokenLibraryTarget = Document;
export type DesignTokenCatalog<DSL = {}, R = never> = {
  [K in keyof DSL]: DSL[K] extends object
    ? DesignTokenCatalog<DSL[K], DSL>
    : DesignTokenResult<R, DSL[K]>;
};
export type DesignTokenLibraryResult<DSL extends {}> = {
  library: DesignTokenCatalog<DSL>;
  applyTo(target: DesignTokenLibraryTarget): void;
  removeFrom(target: DesignTokenLibraryTarget): void;
};

export function createDesignTokenLibrary<T extends {}>(
  raw: DesignTokenLibrary<T>
): DesignTokenLibraryResult<T> {
  console.log(raw);
  return {} as any;
}
