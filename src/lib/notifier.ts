class SubscriptionSubject<T = any> implements ISubscriptionSubject<T> {
  public static getNotifier<T>(target: T): ISubscriptionSubject<T> {
    let notifier = SubscriptionSubject.lookup.get(target);

    if (!notifier) {
      notifier = new SubscriptionSubject(target);
      SubscriptionSubject.lookup.set(target, notifier);
    }

    return notifier;
  }

  private static lookup: WeakMap<any, ISubscriptionSubject<unknown>> =
    new WeakMap();
  readonly #subject: T;
  readonly #subscribers: Set<ISubscriber<T>> = new Set();

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
    this.#subscribers.add(target);
  }

  unsubscribe(target: ISubscriber<T>): void {
    this.#subscribers.delete(target);
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
export interface ISubscriptionSubject<T> {
  notify(): void;
  subscribe(target: ISubscriber<T>): void;
  unsubscribe(target: ISubscriber<T>): void;
}

export const getNotifier = SubscriptionSubject.getNotifier;
