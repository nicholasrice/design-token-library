import { DesignToken } from "./design-token.js";
import { Library } from "./library.js";

/**
 * @public
 */
export function toCSS(library: Library.Library<any, any>): string {
  return recurseToCss(library.tokens);
}

interface CSSPropertyValues {
  readonly var: `var(--${string})`;
  readonly property: `--${string}`;
}

/**
 * A collection of {@link @CSSPropertyValues} that mirrors the
 * structure of the source {@link Library.Library<any> | Library}.
 * @public
 */
export type CSSPropertiesLibrary<T extends {}> = {
  [K in keyof Readonly<T>]: T[K] extends DesignToken.Any
    ? CSSPropertyValues
    : K extends "type"
    ? DesignToken.Type
    : T[K] extends {}
    ? CSSPropertiesLibrary<T[K]>
    : never;
};

/**
 * Construct an {@link CSSPropertiesLibrary} from a {@link Library.Library<any>}.
 * @public
 */
export function toProperties<T extends Library.Library<any>>(
  library: T
): CSSPropertiesLibrary<T["tokens"]> {
  const recurse = (
    section: Library.TokenLibrary<any>,
    properties: CSSPropertiesLibrary<any>
  ) => {
    for (const key in section) {
      const sectionValue = section[key];

      if (isToken(sectionValue)) {
        // TODO add a strategy for name conversion
        const property = `--${sectionValue.name.replaceAll(".", "-")}`;
        const propertyValue = Object.freeze({
          var: `var(${property})`,
          property,
        });
        Reflect.defineProperty(properties, key, {
          value: propertyValue,
          enumerable: true,
        });
      } else {
        const value = {};
        recurse(sectionValue, value);
        Reflect.defineProperty(properties, key, {
          value: Object.freeze(value),
          enumerable: true,
        });
      }
    }
  };

  const properties: CSSPropertiesLibrary<T["tokens"]> = {} as any;
  recurse(library.tokens, properties);

  return properties;
}

const isToken = (
  value: Library.TokenLibrary<any> | Library.Token<any, any>
): value is Library.Token<any, any> => {
  return "value" in value;
};

const recurseToCss = (
  librarySection: Library.TokenLibrary<any, any>
): string => {
  let result = "";
  for (const key in librarySection) {
    const tokenOrGroup = librarySection[key];

    if (isToken(tokenOrGroup)) {
      let value = tokenOrGroup.value;

      if (
        tokenOrGroup.type !== undefined &&
        Reflect.has(TokenConverters, tokenOrGroup.type)
      ) {
        value = Reflect.get(TokenConverters, tokenOrGroup.type)(value);
      }
      result += `--${tokenOrGroup.name}:${value};`;
    } else {
      result = recurseToCss(tokenOrGroup);
    }
  }

  return result;
};

const joiner = <T extends []>(value: T): string => {
  return value.join(" ");
};
/**
 * Convert a border value to CSS
 */
const borderConverter = (value: DesignToken.Values.Border): string => {
  return `${value.width} ${value.style} ${value.color}`;
};

const fontFamilyConverter = (value: DesignToken.Values.FontFamily): string => {
  return typeof value === "string"
    ? fontFamilyQuoter(value)
    : value.map(fontFamilyQuoter).join();
};
const fontFamilyQuoter = (value: string): string => {
  const test = /^(\'|\")?(.*?)(\'|\")?$/;
  const result = test.exec(value);

  if (result !== null && (result[1] || result[3])) {
    value = result[2];
  }

  return value.includes(" ") ? `"${value}"` : value;
};

type Unpacked<T> = T extends (infer U)[] ? U : T;

const gradientReducer = (
  accumulated: string,
  value: Unpacked<DesignToken.Values.Gradient>
): string => {
  return accumulated + `${value.color} ${value.position * 100}%,`;
};
const gradientConverter = (value: DesignToken.Values.Gradient): string => {
  return value.reduce(gradientReducer, "").replace(/,$/, "");
};

const shadowConverter = (value: DesignToken.Values.Shadow): string => {
  return `${value.offsetX} ${value.offsetY} ${value.blur} ${value.spread} ${value.color}`;
};

const strokeStyleConverter = (
  value: DesignToken.Values.StrokeStyle
): string => {
  // CSS doesn't support customizing dashed borders at the time of authoring.
  return typeof value === "string" ? value : "dashed";
};

const transitionConverter = (value: DesignToken.Values.Transition): string => {
  return `${value.duration} ${value.delay} ${value.timingFunction}`;
};

const TokenConverters = {
  [DesignToken.Type.Border]: borderConverter,
  [DesignToken.Type.CubicBezier]: joiner,
  [DesignToken.Type.FontFamily]: fontFamilyConverter,
  [DesignToken.Type.Gradient]: gradientConverter,
  [DesignToken.Type.Shadow]: shadowConverter,
  [DesignToken.Type.StrokeStyle]: strokeStyleConverter,
  [DesignToken.Type.Transition]: transitionConverter,
};
