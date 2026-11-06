import type * as Package from "../lib/index.js";

/**
 * The package's exports. A benchmark loads them from a build given on the
 * command line, so that two builds, such as `main` and a branch, run the
 * same scenarios.
 */
export type LibraryModule = typeof Package;
