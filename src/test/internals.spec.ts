import { suite } from "uvu";
import * as Assert from "uvu/assert";
import { spy } from "sinon";
import { Graph } from "../lib/graph.js";
import { Queue } from "../lib/queue.js";
import { nextUpdate } from "./helpers.js";

const QueueSuite = suite("Queue");

QueueSuite(
    "batches and dedupes adds in one microtask, then clears",
    async () => {
        const queue = new Queue<object>();
        const onChange = spy();
        queue.subscribe({ onChange });
        const x = {};
        const y = {};
        const z = {};

        queue.add(x);
        queue.add(y);
        queue.add(x);
        await nextUpdate();

        Assert.ok(onChange.calledOnce);
        Assert.equal(onChange.firstCall.args[0], [x, y]);
        Assert.ok(Object.isFrozen(onChange.firstCall.args[0]));

        queue.add(z);
        await nextUpdate();

        Assert.is(onChange.callCount, 2);
        Assert.equal(onChange.secondCall.args[0], [z]);
    },
);

QueueSuite("does not flush when nothing was added", async () => {
    const queue = new Queue<object>();
    const onChange = spy();
    queue.subscribe({ onChange });

    await nextUpdate();

    Assert.not.ok(onChange.called);
});

QueueSuite(
    "a subscriber added before the flush receives the pending batch",
    async () => {
        const queue = new Queue<object>();
        const onChange = spy();
        const x = {};

        queue.add(x);
        queue.subscribe({ onChange });
        await nextUpdate();

        Assert.equal(onChange.firstCall.args[0], [x]);
    },
);

QueueSuite.run();

const GraphSuite = suite("Graph");

const dependentsOf = (graph: Graph, name: string): string[] => {
    const dependents: string[] = [];
    graph.dependentsOf(name, (dependent) => dependents.push(dependent));
    return dependents.sort();
};

GraphSuite("visits each dependent of a token once", () => {
    const graph = new Graph(null, () => true);

    graph.add("b", ["a"]);
    graph.add("c", ["a", "b"]);
    graph.add("c", ["a"]);

    Assert.equal(dependentsOf(graph, "a"), ["b", "c"]);
    Assert.equal(dependentsOf(graph, "b"), ["c"]);
    Assert.equal(dependentsOf(graph, "c"), []);
});

GraphSuite("remove drops only the given edges", () => {
    const graph = new Graph(null, () => true);
    graph.add("b", ["a"]);
    graph.add("c", ["a"]);

    graph.remove("b", ["a"]);
    Assert.equal(dependentsOf(graph, "a"), ["c"]);

    graph.remove("c", ["a"]);
    Assert.equal(dependentsOf(graph, "a"), []);

    graph.add("b", ["a"]);
    Assert.equal(dependentsOf(graph, "a"), ["b"]);
});

GraphSuite("version changes with each add and remove", () => {
    const graph = new Graph(null, () => true);
    const versions = [graph.version];

    graph.add("b", ["a"]);
    versions.push(graph.version);
    graph.remove("b", ["a"]);
    versions.push(graph.version);

    Assert.is(new Set(versions).size, 3);
});

GraphSuite("version changes with the parent's", () => {
    const parent = new Graph(null, () => true);
    const graph = new Graph(parent, () => false);
    const before = graph.version;

    parent.add("b", ["a"]);

    Assert.is.not(graph.version, before);
});

GraphSuite(
    "an extension's graph has its parent's dependents that aren't its own, and its own",
    () => {
        const own = new Set(["c"]);
        const parent = new Graph(null, () => true);
        const graph = new Graph(parent, (name) => own.has(name));
        parent.add("b", ["a"]);
        parent.add("c", ["a"]);
        graph.add("c", ["x"]);
        graph.add("d", ["a"]);

        Assert.equal(dependentsOf(graph, "a"), ["b", "d"]);
        Assert.equal(dependentsOf(graph, "x"), ["c"]);
        Assert.equal(dependentsOf(parent, "a"), ["b", "c"]);
        Assert.equal(dependentsOf(parent, "x"), []);
    },
);

GraphSuite("filters a parent's dependents at every layer", () => {
    const root = new Graph(null, () => true);
    const middle = new Graph(root, (name) => name === "b");
    const graph = new Graph(middle, (name) => name === "c");
    root.add("b", ["a"]);
    root.add("c", ["a"]);
    root.add("d", ["a"]);
    middle.add("b", ["y"]);

    Assert.equal(dependentsOf(middle, "a"), ["c", "d"]);
    Assert.equal(dependentsOf(graph, "a"), ["d"]);
    Assert.equal(dependentsOf(graph, "y"), ["b"]);
});

GraphSuite.run();
