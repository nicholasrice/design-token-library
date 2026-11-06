/**
 * Runs the benchmark in separate processes, on one build or alternating
 * between two, and prints the pooled results, or a comparison of the two.
 *
 * ```sh
 * npm run bench
 * npm run bench -- --lib main=../main/dist/lib/index.js --lib branch=dist/lib/index.js
 * npm run bench -- --filter F1/ --processes 3 --json results.json
 * ```
 */
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import type { Result } from "./measure.js";
import { formatComparison, formatSummaries, summarize } from "./stats.js";

const { values } = parseArgs({
    options: {
        lib: { type: "string", multiple: true, default: [] },
        processes: { type: "string", default: "5" },
        samples: { type: "string", default: "10" },
        warmup: { type: "string", default: "3" },
        filter: { type: "string", multiple: true, default: [] },
        json: { type: "string" },
    },
});

interface Build {
    readonly label: string;
    readonly path: string;
}

/**
 * `label=path`, or a path, labeled by the directory that has its `dist`.
 */
const buildOf = (option: string): Build => {
    const [label, path] = option.includes("=")
        ? option.split("=", 2)
        : [option.split("/").at(-4) ?? option, option];
    return { label, path };
};

const builds: Build[] =
    values.lib.length > 0
        ? values.lib.map(buildOf)
        : [
              {
                  label: "current",
                  path: fileURLToPath(
                      new URL("../lib/index.js", import.meta.url),
                  ),
              },
          ];

if (builds.length > 2) {
    throw new Error("Give one build, or two to compare.");
}

const worker = fileURLToPath(new URL("./worker.js", import.meta.url));
const processes = Number(values.processes);
const pooled = builds.map(() => new Map<string, Result>());

// Each process runs every build in turn, so that a drift of the machine,
// such as its temperature, falls on both builds alike.
for (let p = 0; p < processes; p++) {
    builds.forEach((build, b) => {
        process.stderr.write(`process ${p + 1}/${processes}, ${build.label}\n`);
        const child = spawnSync(
            process.execPath,
            [
                "--expose-gc",
                worker,
                `--lib=${build.path}`,
                `--samples=${values.samples}`,
                `--warmup=${values.warmup}`,
                ...values.filter.map((filter) => `--filter=${filter}`),
            ],
            {
                encoding: "utf8",
                maxBuffer: 256 * 1024 * 1024,
                stdio: ["ignore", "pipe", "inherit"],
            },
        );
        if (child.status !== 0) {
            throw new Error(`The worker for ${build.label} failed.`);
        }

        for (const result of JSON.parse(child.stdout) as Result[]) {
            const pool = pooled[b].get(result.id);
            pooled[b].set(
                result.id,
                pool
                    ? { ...pool, samples: [...pool.samples, ...result.samples] }
                    : result,
            );
        }
    });
}

const results = pooled.map((pool) => [...pool.values()]);
const summaries = results.map((pool) => pool.map(summarize));

if (values.json) {
    writeFileSync(
        values.json,
        JSON.stringify(
            builds.map((build, b) => ({ ...build, results: results[b] })),
            null,
            2,
        ),
    );
}

if (builds.length === 2) {
    console.log(
        formatComparison(
            [builds[0].label, builds[1].label],
            summaries[0],
            summaries[1],
        ),
    );
} else {
    console.log(formatSummaries(summaries[0]));
}
