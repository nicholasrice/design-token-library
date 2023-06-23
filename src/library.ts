import { DesignTokenResult, DesignTokenResultImpl } from "./design-token-result.js";
import { isDerivedValue, type DesignTokenValue, isStaticValue, isLibrarySection, isConfigurationValue } from "./values.js";
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
  apply(target: DesignTokenLibraryTarget): void;
  unapply(target: DesignTokenLibraryTarget): void;
  extend<NDSL extends object>(overrides: DesignTokenLibrary<DeepPartial<DSL> & NDSL>): DesignTokenLibraryResult<DSL & NDSL>;
};

        const define = <DSL, T>(source: any, target: any, currentContext: any, rootContext: any = currentContext) => {
            for (const key in source) {
                const value = source[key];

                if (
                    isDerivedValue(value)
                    || isConfigurationValue(value)
                    || isStaticValue(value)
                    ) {
                        const result = new DesignTokenResultImpl<DSL, any>(
                            rootContext as any,
                            value
                        );
                        Reflect.defineProperty(target, key, {
                            value: result,
                            configurable: false,
                            writable: false
                        });
                        Reflect.defineProperty(currentContext, key, {
                            get() {
                                return result.value;
                            },
                            configurable: false
                        });
                    } else {
                        target[key] = {};
                        currentContext[key] = {};
                        define(value, target[key], currentContext[key], rootContext);
                    }
            }
        }
class DesignTokenLibraryImpl<DSL extends object> implements DesignTokenLibraryResult<DSL> {
    constructor(rawLibrary: DesignTokenLibrary<DSL>) {
        define(rawLibrary, this.library, this.context);
    }

    public readonly library: DesignTokenCatalog<DSL> = Object.create(null);
    private readonly context = Object.create(null);

    
    /**
     * Applies the library to the provided target. This will set the CSS custom properties
     * for all tokens in the library on the target.
     * @param target - The target to which the library should be applied.
     */
    public apply(target: DesignTokenLibraryTarget): void {
        
    }

    /**
     * Removes the library from the provided target. This will remove all CSS custom properties
     * for all tokens in the library from the target.
     * @param target - The target from which the library should be removed.
     */
    public unapply(target: Document): void {
        
    }

    public extend<NDSL extends object>(overrides: DesignTokenLibrary<DeepPartial<DSL> & NDSL>): DesignTokenLibraryResult<DSL & NDSL> {
       const lib = new DesignTokenLibraryImpl<NDSL>(overrides); 

       return lib as any;
    }
}

export const DesignTokenLibraryFactory = Object.freeze({
    create<DSL extends {}>(library: DesignTokenLibrary<DSL>): DesignTokenLibraryResult<DSL> {
        return new DesignTokenLibraryImpl<DSL>(library);
    }
})