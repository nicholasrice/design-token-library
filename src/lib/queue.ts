import { ISubscribable, Subscribable } from "./notifier.js";

export interface IQueue<T extends {}> extends ISubscribable<ReadonlyArray<T>> {
    add(target: T): void;
}

export class Queue<T extends {}>
    extends Subscribable<ReadonlyArray<T>>
    implements IQueue<T>
{
    private targets: Set<T> = new Set();
    private needsQueue: boolean = true;

    public add(target: T) {
        this.targets.add(target);

        if (this.needsQueue) {
            this.queue();
        }
    }

    private queue() {
        this.needsQueue = false;
        queueMicrotask(() => {
            const targets = Object.freeze(Array.from(this.targets));
            this.targets.clear();
            this.needsQueue = true;

            // A throwing subscriber must not stop the others, so each error is
            // re-thrown on its own, like a DOM event listener's.
            for (const subscriber of this.subscribers) {
                try {
                    subscriber.onChange(targets);
                } catch (error) {
                    queueMicrotask(() => {
                        throw error;
                    });
                }
            }
        });
    }
}
