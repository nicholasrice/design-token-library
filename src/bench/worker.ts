/**
 * Runs the scenarios in this process, on the build given by `--lib`, and
 * writes their samples to stdout as JSON. `run.ts` starts it once for each
 * process and build.
 */
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { fixturesOf } from "./fixtures.js";
import type { LibraryModule } from "./library-module.js";
import { Result, measure } from "./measure.js";
import { scenariosOf } from "./scenarios.js";

const { values } = parseArgs({
    options: {
        lib: { type: "string" },
        samples: { type: "string", default: "10" },
        warmup: { type: "string", default: "3" },
        filter: { type: "string", multiple: true, default: [] },
        list: { type: "boolean", default: false },
    },
});

const libPath = values.lib
    ? pathToFileURL(values.lib).href
    : new URL("../lib/index.js", import.meta.url).href;
const lib: LibraryModule = await import(libPath);

const scenarios = fixturesOf(lib)
    .flatMap((fixture) => scenariosOf(lib, fixture))
    .filter(
        (scenario) =>
            values.filter.length === 0 ||
            values.filter.some((filter) => scenario.id.includes(filter)),
    );

if (values.list) {
    for (const scenario of scenarios) {
        console.log(scenario.id);
    }
} else {
    const options = {
        samples: Number(values.samples),
        warmup: Number(values.warmup),
    };
    const results: Result[] = [];
    for (const scenario of scenarios) {
        const start = performance.now();
        results.push(await measure(scenario, options));
        const seconds = (performance.now() - start) / 1000;
        process.stderr.write(`  ${scenario.id} (${seconds.toFixed(1)}s)\n`);
    }
    process.stdout.write(JSON.stringify(results));
}
