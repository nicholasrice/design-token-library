import { DesignTokenResult, DesignTokenResultImpl } from "./design-token-result.js";
import type { DesignTokenValue } from "./values.js";

/**
 * The target to which a design token library should be applied.
 */
export type DesignTokenLibraryTarget = Document;
export type DesignTokenLibrary<DSL extends {}, R = never> = {
  [K in keyof DSL]: DSL[K] extends object
    ? DesignTokenLibrary<DSL[K], DSL>
    : DesignTokenValue<R, DSL[K]>;
};
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

class DesignTokenLibraryImpl<DSL extends {}> implements DesignTokenLibraryResult<DSL> {
    library: DesignTokenCatalog<DSL> = {} as any;
    
    /**
     * Applies the library to the provided target. This will set the CSS custom properties
     * for all tokens in the library on the target.
     * @param target - The target to which the library should be applied.
     */
    applyTo(target: DesignTokenLibraryTarget): void {
        
    }

    /**
     * Removes the library from the provided target. This will remove all CSS custom properties
     * for all tokens in the library from the target.
     * @param target - The target from which the library should be removed.
     */
    removeFrom(target: Document): void {
        
    }
}

export const DesignTokenLibraryFactory = Object.freeze({
    create<DSL extends {}>(library: DesignTokenLibrary<DSL>): DesignTokenLibraryResult<DSL> {
        return new DesignTokenLibraryImpl<DSL>();
    }
})