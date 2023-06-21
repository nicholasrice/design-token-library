import "./dom-shim.js";
import { createDesignTokenLibrary } from "./index.js";
interface MyDesignSystem {
  colors: {
    backgroundColor: string;
    foregroundColor: string;
  };
  typography: {
    fontSize: number;
    fontWeight: number;
  };
  gridUnit: number;
}
const result = createDesignTokenLibrary<MyDesignSystem>({
  colors: {
    backgroundColor: "red",
    foregroundColor: function () {
      return this.colors.backgroundColor;
    },
  },
  typography: {
    fontSize: 12,
    fontWeight: 13,
  },

  gridUnit: 8,
});

result.library.colors.backgroundColor.set("red");
result.library.colors.backgroundColor.token; // string
result.applyTo({} as Document);