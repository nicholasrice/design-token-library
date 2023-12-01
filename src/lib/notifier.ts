export class Subscriber<T = any> implements INotifier<T> {
  public static getNotifier<T>(target: T): INotifier<T> {
    let notifier = Subscriber.lookup.get(target);

    if (!notifier) {
      notifier = new Subscriber(target);
      Subscriber.lookup.set(target, notifier);
    }

    return notifier;
  }

  private static lookup: WeakMap<any, INotifier<unknown>> = new WeakMap();
  readonly #subject: T;
  readonly #subscribers: ISubscriber<T>[] = [];

  constructor(subject: T) {
    this.#subject = subject;
  }

  notify(): void {
    const subject = this.#subject;
    for (const value of this.#subscribers) {
      value.update(subject);
    }
  }

  subscribe(target: ISubscriber<T>): void {
    if (!this.#subscribers.includes(target)) {
      this.#subscribers.push(target);
    }
  }

  unsubscribe(target: ISubscriber<T>): void {
    const index = this.#subscribers.indexOf(target);
    if (index !== -1) {
      this.#subscribers.splice(index, 1);
    }
  }
}

/**
 * @internal
 */
export interface ISubscriber<T> {
  update(target: T): void;
}

/**
 * @internal
 */
export interface INotifier<T> {
  notify(): void;
  subscribe(target: ISubscriber<T>): void;
  unsubscribe(target: ISubscriber<T>): void;
}

export const getNotifier = Subscriber.getNotifier;
