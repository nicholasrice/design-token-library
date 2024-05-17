---
sidebar_position: 3
---

# Getting Started

This section will guide you through getting started with `design-token-library`.

> The following instructions assume TypeScript. If you're using JavaScript, skip the steps related to TypeScript and remove typings from code-samples where necessary.

## Library Interface

The first step is to define the interface for the design token library. This is done using `DesignToken`.

First, import `DesignToken`

```ts
import { type DesignToken } from "design-token-library";
```

Next, define the hierarchy of the library. This hierarchy is arbitrary, so choose whichever hierarchy works for you. Hierarchies can also have arbitrary levels of nesting, and can be divided into sub-interfaces if desired.

> For a complete list of available token-types, see [here](/design-token-library/api-reference/design-token-library.designtoken#type-aliases).

```ts
export interface IMyLibrary {
  colors: {
    foreground: DesignToken.Color;
    background: DesignToken.Color;
  };
  shadows: {
    low: DesignToken.Shadow;
    high: DesignToken.Shadow;
  };
  typography: {
    body: DesignToken.Typography;
    heading: DesignToken.Typography;
  };
}
```

## Config

With the Library interface created, the library config can be created. This config will serve as the initial configuration of the library.

```ts
import { Library } from "design-token-library";

const myLibraryConfig: Library.Config<IMyLibrary> = {
  colors: {
    foreground: {
      type: DesignToken.Type.Color,
      value: "#010101",
    },
    background: {
      type: DesignToken.Type.Color,
      value: "#FEFEFE",
    },
  },
  typography: {
    body: {
      type: DesignToken.Type.Typography
      value: {
        fontFamily: "Helvetica",
        fontSize: "14px",
        fontWeight: 400;
        letterSpacing: "0px";
        lineHeight: "18px";
      }
    },
    heading: {
        type: DesignToken.Type.Typography,
        value: {
            fontFamily: (context) => context.typography.body.value.fontFamily,
            fontSize: "20px",
            fontWeight: 400,
            letterSpacing: "0px",
            lineHeight: "24px"
        }
    }
  }
};
```
