import "./dom-shim.js";
import { DesignTokenLibraryFactory } from "./index.js";
import { Updates } from "@microsoft/fast-element";
export let red = (input: any) => "\x1b[31m" + input + "\x1b[0m";
export let green = (input: any) => "\x1b[32m" + input + "\x1b[0m";

function test(description: string, cb: () => void) {
  try {
    cb();
    console.log(green(`SUCCESS: ${description}`));
  } catch (e) {
    console.error(red(`FAILED: ${description}`));
  }
}

function expect(value: any) {
  function fail(reason?: string) {
    throw new Error("reason");
  }

  return {
    toBe(expected: any) {
      if (value !== expected) {
        fail();
      }
    },
  };
}

Updates.setMode(false);

test("should use object path to create css custom property names if no name is defined", () => {
  const result = DesignTokenLibraryFactory.create({ foo: { bar: 12 } });

  expect(result.customProperties.foo.bar.property).toBe("--foo.bar");
  expect(result.customProperties.foo.bar.var).toBe("var(--foo.bar)");
});
test("should use name field in token definition for custom property if defined", () => {
  const result = DesignTokenLibraryFactory.create({
    foo: { bar: { value: 12, name: "fooBar" } },
  });

  expect(result.customProperties.foo.bar.property).toBe("--fooBar");
  expect(result.customProperties.foo.bar.var).toBe("var(--fooBar)");
});
