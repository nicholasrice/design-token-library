import "./dom-shim.js";
import { suite } from "uvu";
import * as Assert from "uvu/assert";
import { spy } from "sinon";
import { Library } from "../lib/library.js";
import { Updates } from "@microsoft/fast-element";
import { DesignToken } from "../lib/design-token.js";

Updates.setMode(false);

const Type = suite("DesignToken.type");
const Description = suite("DesignToken.description");
const Value = suite("DesignToken.value");
const Lib = suite("DesignToken.Library");

Description("should exist in the library when defined on the token", () => {
  const library = Library.create({
    token: {
      type: DesignToken.Type.Color,
      value: "#FFFFFF",
      description: "Hello world",
    },
  });

  Assert.equal(library.token.description, "Hello world");
});
Type(
  "A token should get it's type assigned when it is defined on the token",
  () => {
    const library = Library.create({
      token: {
        type: DesignToken.Type.Color,
        value: "#FFFFFF",
      },
    });

    Assert.equal(library.token.type, DesignToken.Type.Color);
  }
);
Type(
  "A token should inherit it's group's type when it does not define a type ",
  () => {
    const library = Library.create({
      type: DesignToken.Type.Color,
      token: {
        value: "#FFFFFF",
      },
    });

    Assert.equal(library.token.type, DesignToken.Type.Color);
  }
);
Type(
  "A token should override it's group's type when a type is explicitly assigned",
  () => {
    const library = Library.create({
      type: DesignToken.Type.Border,
      token: {
        type: DesignToken.Type.Color,
        value: "#FFFFFF",
      },
    });

    Assert.equal(library.token.type, DesignToken.Type.Color);
  }
);
Type(
  "should throw when there is no type declared for a token and it's ancestor groups",
  () => {
    Assert.throws(() => {
      Library.create({ token: { value: "#FFFFFF " } });
    });
  }
);

Value(
  "should be the value a token was defined with when defined with a static value",
  () => {
    const library = Library.create({
      token: {
        type: DesignToken.Type.Color,
        value: "#FFFFFF",
      },
      anotherToken: {
        type: DesignToken.Type.Border,
        value: {
          color: "#FFFFFF",
          style: "solid",
          width: "2px",
        },
      },
    });

    Assert.equal(library.token.value, "#FFFFFF");
    Assert.equal(library.anotherToken.value, {
      color: "#FFFFFF",
      style: "solid",
      width: "2px",
    });
  }
);

Value("should invoke function values with the token library", () => {
  // Arrange
  interface Theme {
    token: DesignToken.Color;
    anotherToken: DesignToken.Color;
  }

  const value = spy((context: Library.Context<Theme>) => context.token);
  const config: Library.Config<Theme> = {
    token: {
      type: DesignToken.Type.Color,
      value: "#FF0000",
    },
    anotherToken: {
      type: DesignToken.Type.Color,
      value,
    },
  };
  const library = Library.create(config);

  // Act
  const anotherTokenValue = library.anotherToken.value;

  Assert.equal(value.calledOnce, true);
  Assert.equal(value.firstCall.args[0], library);
});

Value(
  "should return the value of a referenced token when assigned a token reference",
  () => {
    interface Theme {
      token: DesignToken.Color;
      anotherToken: DesignToken.Color;
    }
    const config: Library.Config<Theme> = {
      token: {
        type: DesignToken.Type.Color,
        value: "#FF0000",
      },
      anotherToken: {
        type: DesignToken.Type.Color,
        value: (theme: Theme) => theme.token,
      },
    };
    const library = Library.create(config);

    Assert.equal(library.anotherToken.value, library.token.value);
  }
);
Value("reference tokens should support multiple levels of inheritance", () => {
  interface Theme {
    token: DesignToken.Color;
    secondaryToken: DesignToken.Color;
    tertiaryToken: DesignToken.Color;
  }
  const config: Library.Config<Theme> = {
    token: {
      type: DesignToken.Type.Color,
      value: "#FF0000",
    },
    secondaryToken: {
      type: DesignToken.Type.Color,
      value: (theme) => theme.token,
    },
    tertiaryToken: {
      type: DesignToken.Type.Color,
      value: (theme) => theme.secondaryToken,
    },
  };
  const library = Library.create(config);

  Assert.equal(library.tertiaryToken.value, library.token.value);
});
Value("should support setting a static value", () => {
  interface Library {
    token: DesignToken.Color;
  }

  const config: Library.Config<Library> = {
    token: {
      type: DesignToken.Type.Color,
      value: "#FFFFFF",
    },
  };
  const library = Library.create(config);
  const value: DesignToken.Values.Color = "#000000";
  library.token.set(value);

  Assert.equal(library.token.value, value);
});
Value("should support setting a token alias", () => {
  interface Theme {
    token: DesignToken.Color;
    secondaryToken: DesignToken.Color;
  }

  const config: Library.Config<Theme> = {
    token: {
      type: DesignToken.Type.Color,
      value: "#FFFFFF",
    },
    secondaryToken: {
      type: DesignToken.Type.Color,
      value: "#000000",
    },
  };

  const library = Library.create(config);
  library.secondaryToken.set((theme) => theme.token.value);

  Assert.equal(library.secondaryToken.value, library.token.value);
});

Value("should support setting a value alias", () => {
  interface Theme {
    token: DesignToken.Color;
    secondaryToken: DesignToken.Color;
  }

  const config: Library.Config<Theme> = {
    token: {
      type: DesignToken.Type.Color,
      value: "#FFFFFF",
    },
    secondaryToken: {
      type: DesignToken.Type.Color,
      value: "#000000",
    },
  };

  const library = Library.create(config);
  library.secondaryToken.set(() => "#FF0000");

  Assert.equal(library.secondaryToken.value, "#FF0000");
});

Lib("should be immutable", () => {
  const library = Library.create({
    colors: {
      type: DesignToken.Type.Color,
      primary: {
        value: "#FFFFFF",
      },
      secondary: {
        value: "#000000",
      },
    },
  });

  Assert.throws(
    () =>
      // @ts-ignore
      (library.colors = {}),
    "Assigning a group should throw"
  );
  Assert.throws(
    // @ts-ignore
    () => (library.colors.type = DesignToken.Type.Color),
    "Assigning the 'type' field of a group should throw"
  );
  Assert.throws(
    // @ts-ignore
    () => (library.colors.primary = { value: "#FFF000" }),
    "Assigning a token field should throw"
  );
  Assert.throws(
    // @ts-ignore
    () => (library.colors.primary.value = "#FFF000"),
    "Assigning a token 'value' field  should throw"
  );
  Assert.throws(
    // @ts-ignore
    () => (library.colors.primary.type = DesignToken.Type.Border),
    "Assigning a token 'type' field  should throw"
  );
  Assert.throws(
    // @ts-ignore
    () => (library.colors.primary.extensions = {}),
    "Assigning a token 'extensions' field  should throw"
  );
  Assert.not.throws(
    () => (library.colors.primary.extensions.foo = {}),
    "Assigning a field of a token's extension field should not throw"
  );
});

Description.run();
Type.run();
Value.run();
Lib.run();
