export interface IQueue<T extends {}> {
  add(target: T): void;
  subscribe(subscriber: IQueueSubscriber<T>): void;
  unsubscribe(subscriber: IQueueSubscriber<T>): void;
}

export interface IQueueSubscriber<T> {
  update(targets: ReadonlyArray<T>): void;
}

export class Queue<T extends {}> implements IQueue<T> {
  private targets: Set<T> = new Set();
  private needsQueue: boolean = true;
  private subscribers: Set<IQueueSubscriber<T>> = new Set();

  public add(target: T) {
    this.targets.add(target);

    if (this.needsQueue) {
      this.queue();
    }
  }

  public subscribe(subscriber: IQueueSubscriber<T>): void {
    this.subscribers.add(subscriber);
  }

  public unsubscribe(subscriber: IQueueSubscriber<T>): void {
    this.subscribers.delete(subscriber);
  }

  private queue() {
    this.needsQueue = false;
    queueMicrotask(() => {
      const targets = Object.freeze(Array.from(this.targets));
      this.targets.clear();
      this.needsQueue = true;

      for (const subscriber of this.subscribers) {
        subscriber.update(targets);
      }
    });
  }
}
