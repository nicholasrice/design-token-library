export abstract class Subscribable<T> implements ISubscribable<T> {
    protected subscribers: Set<ISubscriber<T>> = new Set();
    subscribe(target: ISubscriber<T>): void {
        this.subscribers.add(target);
    }

    unsubscribe(target: ISubscriber<T>): void {
        this.subscribers.delete(target);
    }
}

class Notifier<T = any> extends Subscribable<T> implements INotifier<T> {
    public static getNotifier<T>(target: T): INotifier<T> {
        let notifier = Notifier.lookup.get(target);

        if (!notifier) {
            notifier = new Notifier(target);
            Notifier.lookup.set(target, notifier);
        }

        return notifier;
    }

    private static lookup: WeakMap<any, INotifier<unknown>> = new WeakMap();
    readonly #subject: T;

    constructor(subject: T) {
        super();
        this.#subject = subject;
    }

    notify(): void {
        const subject = this.#subject;
        for (const value of this.subscribers) {
            value.onChange(subject);
        }
    }
}

/**
 * @internal
 */
export interface ISubscriber<T> {
    onChange(target: T): void;
}

export interface ISubscribable<T> {
    subscribe(target: ISubscriber<T>): void;
    unsubscribe(target: ISubscriber<T>): void;
}
/**
 * @internal
 */
export interface INotifier<T> extends ISubscribable<T> {
    notify(): void;
}

export const getNotifier = Notifier.getNotifier;
