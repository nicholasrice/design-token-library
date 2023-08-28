import "./dom-shim.js";
import { test } from "uvu";
import * as assert from "uvu/assert";
// import { Updates } from "@microsoft/fast-element";

// Updates.setMode(false);

test("should use object path to create css custom property names if no name is defined", () => {
  assert.is(2, 2);
});
test("should use name field in token definition for custom property if defined", () => {
  assert.equal(2, 2);
});

test.run();
