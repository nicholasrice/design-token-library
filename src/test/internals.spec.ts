import { suite } from "uvu";
import * as Assert from "uvu/assert";
import { spy } from "sinon";
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
