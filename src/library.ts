import {
  CustomPropertyLibrary,
  customPropertyFactory,
} from "./custom-properties.js";
import { DeepPartial, DeepReadOnly, DeepRecord } from "./utilities.js";
import {
  isDerivedValue,
  type DesignTokenValue,
  isInertValue,
  isConfigurationValue,
  DesignTokenConfiguration,
  isGroup,
  isDesignTokenValue,
} from "./values.js";

export type DesignTokenLibrarySource<DSL extends {}, R = never> = {
  [K in keyof DSL]: DSL[K] extends object
    ? DesignTokenLibrarySource<DSL[K], DSL>
    : DesignTokenValue<R, DSL[K]>;
};
export interface DesignTokenLibrary<T extends {}> {
  readonly customProperties: CustomPropertyLibrary<DesignTokenLibrarySource<T>>;
}

// const define = <DSL, T>(
//   source: {},
//   target: any,
//   currentContext: any,
//   path: string,
//   rootContext: any = currentContext
// ) => {
//   for (const key in source) {
//     const value = source[key];
//
//     if (
//       isDerivedValue(value) ||
//       isConfigurationValue(value) ||
//       isStaticValue(value)
//     ) {
//       // const result = new DesignTokenResultImpl<DSL, any>(
//       //   rootContext as any,
//       //   value
//       // );
//       // Reflect.defineProperty(target, key, {
//       //   value: result,
//       //   configurable: false,
//       //   writable: false,
//       // });
//       // Reflect.defineProperty(currentContext, key, {
//       //   get() {
//       //     return result.value;
//       //   },
//       //   configurable: false,
//       // });
//     } else {
//       target[key] = {};
//       currentContext[key] = {};
//       define(value, target[key], currentContext[key], rootContext);
//     }
//   }
// };

function defineCustomProperties<T extends {}>(
  source: DeepReadOnly<DesignTokenLibrarySource<T>>
): CustomPropertyLibrary<T> {
  function traverse(
    source: DeepReadOnly<DesignTokenLibrarySource<T>>,
    target: DeepPartial<CustomPropertyLibrary<T>> = {} as any,
    path?: string
  ): CustomPropertyLibrary<T> {
    for (const key in source) {
      const value = source[key];
      const currentPath = path !== undefined ? path + `.${key}` : key;
      if (isDesignTokenValue(value)) {
        const name = currentPath;
        const config = isConfigurationValue(value)
          ? { name, ...value }
          : { name, value };

        Reflect.defineProperty(target, key, {
          value: customPropertyFactory.define(config),
          writable: false,
        });
      } else {
        traverse(value, (target[key] = {} as any), currentPath);
      }
    }

    return target as CustomPropertyLibrary<T>;
  }

  return traverse(source);
}

export const DesignTokenLibraryFactory = Object.freeze({
  create<T extends {}>(
    source: DesignTokenLibrarySource<T>
  ): DesignTokenLibrary<T> {
    return new DesignTokenLibraryImpl(source);
  },
});

class DesignTokenLibraryImpl<T extends {}> implements DesignTokenLibrary<T> {
  readonly customProperties: CustomPropertyLibrary<DesignTokenLibrarySource<T>>;

  constructor(
    private readonly source: DeepReadOnly<DesignTokenLibrarySource<T>>
  ) {
    this.customProperties = defineCustomProperties(this.source);
  }
}
