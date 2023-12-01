import { INotifier, ISubscriber, Subscriber } from "./notifier.js";
import { empty } from "./utilities.js";

const notifierLookup: WeakMap<any, INotifier<any>> = new WeakMap();

export interface IWatcher {
  watch(source: Object): void;
}

export interface IFunctionObserver extends INotifier<Function> {
  /**
   * Call the observed function with any args, return the result
   */
  call(...args: any[]): any;
}

let watcher: IWatcher | typeof empty = empty;

export class FunctionObserver
  extends Subscriber
  implements IFunctionObserver, IWatcher
{
  #subject: Function;
  #records: INotifier<any>[] = [];

  constructor(subject: Function) {
    super(subject);
    this.#subject = subject;
  }

  public call(...args: any[]): any {
    this.disconnect();

    const previousWatcher = watcher;
    watcher = this;
    let result;

    try {
      result = this.#subject(...args);
    } finally {
      watcher = previousWatcher;
    }

    return result;
  }

  public watch(source: Object): void {
    const notifier = getNotifier(source);
    notifier.subscribe(this);
    this.#records.push(notifier);
  }

  public disconnect() {
    let record;
    while ((record = this.#records.pop())) {
      record.unsubscribe(this);
    }
  }

  public update = this.notify;
}

export function track(source: any) {
  if (watcher !== empty) {
    watcher.watch(source);
  }
}

export function getNotifier<T>(target: T): INotifier<T> {
  let notifier = notifierLookup.get(target);

  if (!notifier) {
    notifier = new Subscriber(target);
    notifierLookup.set(target, notifier);
  }

  return notifier;
}
