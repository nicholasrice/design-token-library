import { suite } from "uvu";
import * as Assert from "uvu/assert";
import { hex, ms, px, rem, s } from "../lib/values.js";

const Hex = suite("hex");
const Dimensions = suite("dimension values");
const Durations = suite("duration values");

Hex("should build an opaque color from #RRGGBB", () => {
    Assert.equal(hex("#ff8000"), {
        colorSpace: "srgb",
        components: [1, 128 / 255, 0],
    });
});
Hex("should expand #RGB", () => {
    Assert.equal(hex("#f08"), hex("#ff0088"));
});
Hex("should read alpha from #RRGGBBAA", () => {
    Assert.equal(hex("#00000080"), {
        colorSpace: "srgb",
        components: [0, 0, 0],
        alpha: 128 / 255,
    });
});
Hex("should not set alpha without an alpha digit pair", () => {
    Assert.not("alpha" in hex("#ffffff"));
});
Hex("should be case-insensitive", () => {
    Assert.equal(hex("#ABCDEF"), hex("#abcdef"));
});
Hex("should throw on malformed input", () => {
    for (const bad of [
        "",
        "fff",
        "#ff",
        "#ffff",
        "#fffff",
        "#gggggg",
        "#fffffffff",
    ]) {
        Assert.throws(() => hex(bad), /Invalid hex color/, bad);
    }
});

Dimensions("px should build a pixel dimension", () => {
    Assert.equal(px(4), { value: 4, unit: "px" });
});
Dimensions("rem should build a rem dimension", () => {
    Assert.equal(rem(1.5), { value: 1.5, unit: "rem" });
});
Dimensions("should keep zero with its unit", () => {
    Assert.equal(px(0), { value: 0, unit: "px" });
    Assert.equal(rem(0), { value: 0, unit: "rem" });
});

Durations("ms should build a millisecond duration", () => {
    Assert.equal(ms(200), { value: 200, unit: "ms" });
});
Durations("s should build a second duration", () => {
    Assert.equal(s(0.5), { value: 0.5, unit: "s" });
});

Hex.run();
Dimensions.run();
Durations.run();
