export abstract class Subscribable<T> implements ISubscribable<T> {
    protected subscribers: Set<ISubscriber<T>> = new Set();
    subscribe(target: ISubscriber<T>): void {
        this.subscribers.add(target);
    }

    unsubscribe(target: ISubscriber<T>): void {
        this.subscribers.delete(target);
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
