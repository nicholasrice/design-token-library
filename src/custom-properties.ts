import { DeepReadOnly, DeepRecord } from "./utilities.js";
import { DesignTokenConfiguration, DesignTokenValue } from "./values.js";

export interface CustomPropertyDefinition {
  readonly var: `var(--${string})`;
  readonly property: `--${string}`;
}

class CustomProperty implements CustomPropertyDefinition {
  public readonly property: `--${string}`;
  public readonly var: `var(--${string})`;
  constructor(config: DesignTokenConfiguration<any, any>) {
    this.property = `--${config.name}`;
    this.var = `var(${this.property})`;
  }
}

export type CustomPropertyLibrary<T extends {}> = {
  readonly [K in keyof T]: T[K] extends object
    ? // Tests DesignToken configuration - referencing the configuration type does not create the right type
      T[K] extends { value: unknown }
      ? CustomPropertyDefinition
      : CustomPropertyLibrary<T[K]>
    : CustomPropertyDefinition;
};
export const customPropertyFactory = Object.freeze({
  define(config: DesignTokenConfiguration<any, any>): CustomPropertyDefinition {
    return new CustomProperty(config);
  },
});
