import { empty } from "./utilities.js";

export interface IWatcher {
  watch(source: Object): void;
}

let _watcher: IWatcher | typeof empty = empty;

export namespace Watcher {
  export function track(source: any) {
    if (_watcher !== empty) {
      _watcher.watch(source);
    }
  }

  /**
   * Use the provided watcher
   * @param watcher - the watcher to use
   * @returns - a function that instructs the watcher to stop using the provided watcher
   */
  export function use(watcher: IWatcher): () => void {
    const previousWatcher = watcher;
    _watcher = watcher;

    return () => {
      _watcher = previousWatcher;
    };
  }
}
