/**
 * Compares two runs saved with `npm run bench -- --json <file>`: the first
 * build of each.
 *
 * ```sh
 * npm run bench:compare -- main.json branch.json
 * ```
 */
import { readFileSync } from "node:fs";
import type { Result } from "./measure.js";
import { formatComparison, summarize } from "./stats.js";

const files = process.argv.slice(2);
if (files.length !== 2) {
    throw new Error("Give two files saved with `npm run bench -- --json`.");
}

const [a, b] = files.map((file) => {
    const [build] = JSON.parse(readFileSync(file, "utf8")) as {
        label: string;
        results: Result[];
    }[];
    return { label: build.label, summaries: build.results.map(summarize) };
});

console.log(formatComparison([a.label, b.label], a.summaries, b.summaries));
