import { suite } from "uvu";
import * as Assert from "uvu/assert";
import { spy } from "sinon";
import { getNotifier } from "../lib/notifier.js";
import { Queue } from "../lib/queue.js";
import { Watcher } from "../lib/watcher.js";
import { nextUpdate } from "./helpers.js";

const QueueSuite = suite("Queue");
const NotifierSuite = suite("Notifier");
const WatcherSuite = suite("Watcher");

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

NotifierSuite("returns one notifier per target", () => {
    const first = {};
    const second = {};

    Assert.is(getNotifier(first), getNotifier(first));
    Assert.is.not(getNotifier(first), getNotifier(second));
});

NotifierSuite("notify passes the subject to subscribers", () => {
    const subject = {};
    const onChange = spy();
    const notifier = getNotifier(subject);
    notifier.subscribe({ onChange });

    notifier.notify();

    Assert.ok(onChange.calledOnceWith(subject));
});

WatcherSuite(
    "nested use() restores the previous watcher; track() is a no-op without one",
    () => {
        const outer = { watch: spy() };
        const inner = { watch: spy() };
        const source = {};

        Watcher.track(source);

        const stopOuter = Watcher.use(outer);
        const stopInner = Watcher.use(inner);
        Watcher.track(source);
        stopInner();
        Watcher.track(source);
        stopOuter();
        Watcher.track(source);

        Assert.is(inner.watch.callCount, 1);
        Assert.is(outer.watch.callCount, 1);
        Assert.ok(inner.watch.calledWith(source));
        Assert.ok(outer.watch.calledWith(source));
    },
);

QueueSuite.run();
NotifierSuite.run();
WatcherSuite.run();
