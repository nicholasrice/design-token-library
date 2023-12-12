import { suite } from "uvu";
import * as Assert from "uvu/assert";
import { toCSS } from "../lib/css-reflector.js";
import { DesignToken } from "../lib/design-token.js";
import { Library } from "../lib/library.js";

const toCssSuite = suite("toCss");

interface Config<T extends DesignToken.Any> {
  token: T;
}

toCssSuite("should convert Border", () => {
  const config: Config<DesignToken.Border> = {
    token: {
      type: DesignToken.Type.Border,
      value: { color: "#FFFFFF", style: "dashed", width: "2px" },
    },
  };
  const library = Library.create(config);
  const result = toCSS(library);

  Assert.is(result, "--token:2px dashed #FFFFFF;");
});
toCssSuite("should convert Color", () => {
  const config: Config<DesignToken.Color> = {
    token: {
      type: DesignToken.Type.Color,
      value: "#FF0000",
    },
  };
  const library = Library.create(config);
  const result = toCSS(library);

  Assert.is(result, "--token:#FF0000;");
});
toCssSuite("should convert CubicBezier", () => {
  const config: Config<DesignToken.CubicBezier> = {
    token: {
      type: DesignToken.Type.CubicBezier,
      value: [0, 0.5, 0.9, 0.7],
    },
  };
  const library = Library.create(config);
  const result = toCSS(library);

  Assert.is(result, "--token:0 0.5 0.9 0.7;");
});
toCssSuite("should convert Dimension", () => {
  const config: Config<DesignToken.Dimension> = {
    token: {
      type: DesignToken.Type.Dimension,
      value: "2px",
    },
  };
  const library = Library.create(config);
  const result = toCSS(library);

  Assert.is(result, "--token:2px;");
});
toCssSuite("should convert Duration", () => {
  const config: Config<DesignToken.Duration> = {
    token: {
      type: DesignToken.Type.Duration,
      value: "100ms",
    },
  };
  const library = Library.create(config);
  const result = toCSS(library);

  Assert.is(result, "--token:100ms;");
});
toCssSuite("should convert single FontFamily", () => {
  const config: Config<DesignToken.FontFamily> = {
    token: {
      type: DesignToken.Type.FontFamily,
      value: "Comic Sans",
    },
  };
  const library = Library.create(config);
  const result = toCSS(library);

  Assert.is(result, '--token:"Comic Sans";');
});
toCssSuite("should convert multiple FontFamily", () => {
  const config: Config<DesignToken.FontFamily> = {
    token: {
      type: DesignToken.Type.FontFamily,
      value: ["Comic Sans", "Courier New", "serif"],
    },
  };
  const library = Library.create(config);
  const result = toCSS(library);

  Assert.is(result, '--token:"Comic Sans","Courier New",serif;');
});
toCssSuite("should fix malformed FontFamily", () => {
  const config: Config<DesignToken.FontFamily> = {
    token: {
      type: DesignToken.Type.FontFamily,
      // prettier-ignore
      value: ['"Comic Sans', 'Courier New"', '\'serif', 'system\''],
    },
  };

  const library = Library.create(config);
  const result = toCSS(library);

  Assert.is(result, '--token:"Comic Sans","Courier New",serif,system;');
});
toCssSuite("should convert keyword FontWeight", () => {
  const config: Config<DesignToken.FontWeight> = {
    token: {
      type: DesignToken.Type.FontWeight,
      value: "heavy",
    },
  };

  const library = Library.create(config);
  const result = toCSS(library);

  Assert.is(result, "--token:heavy;");
});
toCssSuite("should convert numerical FontWeight", () => {
  const config: Config<DesignToken.FontWeight> = {
    token: {
      type: DesignToken.Type.FontWeight,
      value: 400,
    },
  };

  const library = Library.create(config);
  const result = toCSS(library);

  Assert.is(result, "--token:400;");
});
toCssSuite("should convert Gradient", () => {
  const config: Config<DesignToken.Gradient> = {
    token: {
      type: DesignToken.Type.Gradient,
      value: [
        { color: "#FFFFFF", position: 0 },
        { color: "#AAAAAA", position: 0.5 },
        { color: "#000000", position: 1 },
      ],
    },
  };

  const library = Library.create(config);
  const result = toCSS(library);

  Assert.is(result, "--token:#FFFFFF 0%,#AAAAAA 50%,#000000 100%;");
});
toCssSuite("should convert Number", () => {
  const config: Config<DesignToken.Number> = {
    token: {
      type: DesignToken.Type.Number,
      value: 12,
    },
  };

  const library = Library.create(config);
  const result = toCSS(library);

  Assert.is(result, "--token:12;");
});
toCssSuite("should convert .ShadowGradient", () => {
  const config: Config<DesignToken.Shadow> = {
    token: {
      type: DesignToken.Type.Shadow,
      value: {
        color: "#FFFFFF",
        blur: "2px",
        offsetX: "0px",
        offsetY: "1px",
        spread: "3px",
      },
    },
  };

  const library = Library.create(config);
  const result = toCSS(library);

  Assert.is(result, "--token:0px 1px 2px 3px #FFFFFF;");
});

toCssSuite.run();
