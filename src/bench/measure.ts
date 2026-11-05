import { Counts, Scenario, Timed, quiesce } from "./scenarios.js";

export type Unit = "ms" | "bytes" | "pass";

/**
 * The samples of a scenario, from one process or pooled from several.
 */
export interface Result {
    readonly id: string;
    readonly unit: Unit;
    readonly samples: number[];
    readonly counts?: Counts;
}

export interface MeasureOptions {
    readonly samples: number;
    readonly warmup: number;
}

/**
 * A `"repeat"` scenario runs at least this long in each sample, so that
 * an operation of a microsecond is well above the timer's resolution.
 */
const MIN_SAMPLE_MS = 1;
const MAX_REPEATS = 10_000;

const settled = async (value: unknown): Promise<void> => {
    if (value instanceof Promise) {
        await value;
    }
};

const runOnce = async (scenario: Timed<any>, options: MeasureOptions) => {
    const samples: number[] = [];
    let state: unknown;

    for (let i = 0; i < options.warmup + options.samples; i++) {
        state = scenario.setup();
        await quiesce();
        const start = performance.now();
        await settled(scenario.run(state));
        const time = performance.now() - start;

        if (i >= options.warmup) {
            samples.push(time);
        }
    }

    return { samples, counts: await scenario.counts?.(state) };
};

const runRepeated = async (scenario: Timed<any>, options: MeasureOptions) => {
    const state = scenario.setup();
    const time = async (repeats: number): Promise<number> => {
        const start = performance.now();
        for (let i = 0; i < repeats; i++) {
            await settled(scenario.run(state));
        }
        return (performance.now() - start) / repeats;
    };

    const once = await time(1);
    const repeats = Math.min(
        MAX_REPEATS,
        Math.max(1, Math.ceil(MIN_SAMPLE_MS / Math.max(once, 1e-6))),
    );
    for (let i = 0; i < options.warmup; i++) {
        await time(repeats);
    }

    const samples: number[] = [];
    for (let i = 0; i < options.samples; i++) {
        await quiesce();
        samples.push(await time(repeats));
    }

    return { samples, counts: await scenario.counts?.(state) };
};

export const measure = async (
    scenario: Scenario,
    options: MeasureOptions,
): Promise<Result> => {
    if (scenario.kind === "measure") {
        const samples: number[] = [];
        for (let i = 0; i < scenario.samples; i++) {
            samples.push(await scenario.measure());
        }
        return { id: scenario.id, unit: scenario.unit, samples };
    }

    const capped =
        scenario.maxSamples === undefined
            ? options
            : {
                  samples: Math.min(options.samples, scenario.maxSamples),
                  warmup: Math.min(options.warmup, 1),
              };
    const { samples, counts } =
        scenario.kind === "once"
            ? await runOnce(scenario, capped)
            : await runRepeated(scenario, capped);

    return { id: scenario.id, unit: "ms", samples, counts };
};
