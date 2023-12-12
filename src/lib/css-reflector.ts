import { DesignToken } from "./design-token.js";
import { Library } from "./library.js";
/**
 * An object capable of reflecting an {@link Library.Library}
 * to css custom properties
 */
export interface CSSReflector {
  /**
   * Applies the CSS custom properties to a target document or shadow root.
   * @param target -
   */
  applyTo(target: DocumentOrShadowRoot): void;

  /**
   * The computed CSS for the library.
   */
  readonly css: string;
}

export function toCSS(library: Library.Library<any, any>): string {
  return recurseToCss(library.tokens);
}

function isToken(
  value: Library.TokenLibrary<any> | Library.Token<any, any>
): value is Library.Token<any, any> {
  return "value" in value;
}

function recurseToCss(librarySection: Library.TokenLibrary<any, any>): string {
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
}

const TokenConverters = {
  [DesignToken.Type.Border]: borderConverter,
  [DesignToken.Type.CubicBezier]: joiner,
  [DesignToken.Type.FontFamily]: fontFamilyConverter,
  [DesignToken.Type.Gradient]: gradientConverter,
  [DesignToken.Type.Shadow]: shadowConverter,
  [DesignToken.Type.StrokeStyle]: strokeStyleConverter,
  [DesignToken.Type.Transition]: transitionConverter,
};

function joiner<T extends []>(value: T): string {
  return value.join(" ");
}
/**
 * Convert a border value to CSS
 */
function borderConverter(value: DesignToken.Values.Border): string {
  return `${value.width} ${value.style} ${value.color}`;
}

function fontFamilyConverter(value: DesignToken.Values.FontFamily): string {
  return typeof value === "string"
    ? fontFamilyQuoter(value)
    : value.map(fontFamilyQuoter).join();
}
function fontFamilyQuoter(value: string): string {
  const test = /^(\'|\")?(.*?)(\'|\")?$/;
  const result = test.exec(value);

  if (result !== null && (result[1] || result[3])) {
    value = result[2];
  }

  return value.includes(" ") ? `"${value}"` : value;
}

type Unpacked<T> = T extends (infer U)[] ? U : T;

function gradientReducer(
  accumulated: string,
  value: Unpacked<DesignToken.Values.Gradient>
): string {
  return accumulated + `${value.color} ${value.position * 100}%,`;
}
function gradientConverter(value: DesignToken.Values.Gradient): string {
  return value.reduce(gradientReducer, "").replace(/,$/, "");
}

function shadowConverter(value: DesignToken.Values.Shadow): string {
  return `${value.offsetX} ${value.offsetY} ${value.blur} ${value.spread} ${value.color}`;
}

function strokeStyleConverter(value: DesignToken.Values.StrokeStyle): string {
  // CSS doesn't support customizing dashed borders at the time of authoring.
  return typeof value === "string" ? value : "dashed";
}

function transitionConverter(value: DesignToken.Values.Transition): string {
  return `${value.duration} ${value.delay} ${value.timingFunction}`;
}
