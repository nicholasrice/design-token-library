import "./dom-shim.js";
import { DesignTokenLibrary, DesignTokenLibraryFactory, DesignTokenLibraryResult  } from "./index.js";
import { css, ElementStyles, Updates } from "@microsoft/fast-element";
import { updateSourceFile } from "typescript";

Updates.setMode(false);
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
  value: number;
}

const result = DesignTokenLibraryFactory.create<MyDesignSystem>({
  colors: {
    backgroundColor: "red",
    foregroundColor: function () {
      return this.colors.backgroundColor;
    },
  },
  typography: {
    fontSize: 12,
    fontWeight: {
      $value: function () { ; return 12; },
      description: "The font weight",
      name: "font-weight",
    },
  },
  gridUnit: {
    $value: 4,
  },
  value: 12
});


result.library.colors.backgroundColor.set("red");
result.library.colors.backgroundColor.token; // string
console.log(result.library.typography.fontWeight.value); // number
console.log(result.library.colors.foregroundColor.value); // number
result.apply(document);

const extend = result.extend({
  colors: { backgroundColor: "green", green: { $value: "green", name: 'green', token: 'foobar' } },
});

extend.library.colors.backgroundColor.set("green");


const CIB = {
  config: {
    theme: {
      tokens: {} as DesignTokenLibraryResult<MyDesignSystem>,
      addStyles(target: string, styles: ElementStyles) {},
      removeStyles(target: string, styles: ElementStyles) {}
    }
  }
}


CIB.config.theme.tokens = CIB.config.theme.tokens.extend<MyDesignSystem>({
  colors: {
    backgroundColor: "red"
  }
});

CIB.config.theme.tokens.library.colors.backgroundColor.set("someValue");

const styles = css`
  :host {
    backgroundColor: ${CIB.config.theme.tokens.library.colors.backgroundColor.token}
  }
`;