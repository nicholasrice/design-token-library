import type { Result, Unit } from "./measure.js";

export interface Summary {
    readonly id: string;
    readonly unit: Unit;
    readonly n: number;
    readonly median: number;
    readonly p95: number;
    /**
     * The median absolute deviation from the median: the noise.
     */
    readonly mad: number;
    readonly counts?: Readonly<Record<string, number>>;
}

const sorted = (values: readonly number[]) => [...values].sort((a, b) => a - b);

const medianOf = (values: readonly number[]): number => {
    const s = sorted(values);
    const middle = Math.floor(s.length / 2);
    return s.length % 2 === 0 ? (s[middle - 1] + s[middle]) / 2 : s[middle];
};

/**
 * The nearest-rank percentile.
 */
const percentile = (values: readonly number[], p: number): number => {
    const s = sorted(values);
    return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)];
};

export const summarize = (result: Result): Summary => {
    // A check passes only when every sample does.
    const median =
        result.unit === "pass"
            ? Math.min(...result.samples)
            : medianOf(result.samples);
    return {
        id: result.id,
        unit: result.unit,
        n: result.samples.length,
        median,
        p95: percentile(result.samples, 95),
        mad: medianOf(result.samples.map((value) => Math.abs(value - median))),
        counts: result.counts,
    };
};

/**
 * A change is reported only when the medians differ by more than this many
 * times the combined noise of both, and by more than {@link MIN_CHANGE}.
 */
const NOISE_FACTOR = 3;
const MIN_CHANGE = 0.05;

export type Verdict =
    | "faster"
    | "slower"
    | "smaller"
    | "larger"
    | "changed"
    | "same";

export const verdictOf = (a: Summary, b: Summary): Verdict => {
    if (a.unit === "pass") {
        return a.median === b.median ? "same" : "changed";
    }

    const difference = b.median - a.median;
    const noise = NOISE_FACTOR * Math.hypot(a.mad, b.mad);
    if (
        Math.abs(difference) <= noise ||
        Math.abs(difference) <= MIN_CHANGE * Math.abs(a.median)
    ) {
        return "same";
    }

    if (a.unit === "bytes") {
        return difference < 0 ? "smaller" : "larger";
    }
    return difference < 0 ? "faster" : "slower";
};

const format = (value: number, unit: Unit): string =>
    unit === "ms"
        ? value < 0.1
            ? `${(value * 1000).toFixed(1)}µs`
            : `${value.toFixed(2)}ms`
        : unit === "bytes"
          ? `${Math.round(value)}B`
          : value === 1
            ? "pass"
            : "fail";

const countsOf = (summary: Summary): string =>
    Object.entries(summary.counts ?? {})
        .map(([key, value]) => `${key}=${value}`)
        .join(" ");

const table = (rows: readonly string[][]): string => {
    const widths = rows[0].map((_, column) =>
        Math.max(...rows.map((row) => row[column].length)),
    );
    return rows
        .map((row) =>
            row
                .map((cell, column) => cell.padEnd(widths[column]))
                .join("  ")
                .trimEnd(),
        )
        .join("\n");
};

export const formatSummaries = (summaries: readonly Summary[]): string =>
    table([
        ["scenario", "median", "p95", "mad", "n", "counts"],
        ...summaries.map((s) => [
            s.id,
            format(s.median, s.unit),
            s.unit === "pass" ? "" : format(s.p95, s.unit),
            s.unit === "pass" ? "" : format(s.mad, s.unit),
            String(s.n),
            countsOf(s),
        ]),
    ]);

export const formatComparison = (
    labels: readonly [string, string],
    a: readonly Summary[],
    b: readonly Summary[],
): string => {
    const others = new Map(b.map((summary) => [summary.id, summary]));
    const rows = [
        ["scenario", labels[0], labels[1], "change", "verdict", "counts"],
    ];

    for (const summary of a) {
        const other = others.get(summary.id);
        if (other === undefined) {
            continue;
        }
        const change =
            summary.unit === "pass" || summary.median === 0
                ? ""
                : `${(((other.median - summary.median) / summary.median) * 100).toFixed(1)}%`;
        const counts = countsOf(summary);
        const otherCounts = countsOf(other);
        rows.push([
            summary.id,
            format(summary.median, summary.unit),
            format(other.median, other.unit),
            change,
            verdictOf(summary, other),
            counts === otherCounts ? counts : `${counts} → ${otherCounts}`,
        ]);
    }

    return table(rows);
};
