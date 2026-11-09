import { ISubscribable, Subscribable } from "./notifier.js";

export interface IQueue<T extends {}> extends ISubscribable<ReadonlyArray<T>> {
    add(target: T): void;
    /**
     * Whether the queue has a subscriber.
     */
    readonly subscribed: boolean;
}

export class Queue<T extends {}>
    extends Subscribable<ReadonlyArray<T>>
    implements IQueue<T>
{
    private targets: Set<T> = new Set();
    private needsQueue: boolean = true;

    /**
     * @param prepare - Gives the targets to deliver, from those added since
     * the last batch. An empty batch isn't delivered.
     */
    constructor(
        private readonly prepare: (targets: ReadonlySet<T>) => readonly T[] = (
            targets,
        ) => Array.from(targets),
    ) {
        super();
    }

    public get subscribed(): boolean {
        return this.subscribers.size > 0;
    }

    public add(target: T) {
        this.targets.add(target);

        if (this.needsQueue) {
            this.queue();
        }
    }

    private queue() {
        this.needsQueue = false;
        queueMicrotask(() => {
            const added = this.targets;
            this.targets = new Set();
            this.needsQueue = true;
            const targets = Object.freeze(this.prepare(added));
            if (targets.length === 0) {
                return;
            }

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
