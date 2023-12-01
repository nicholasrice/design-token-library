import { suite } from "uvu";
import * as Assert from "uvu/assert";
import { spy } from "sinon";
import { FunctionObserver, getNotifier, track } from "../lib/observable.js";
import { ISubscriber } from "../lib/notifier.js";

const FunctionObserverSuite = suite("Observable.FunctionObserver");

FunctionObserverSuite(
  "should invoke the observed function w/ provided arguments when called",
  () => {
    // Arrange
    const fn = spy();
    const observer = new FunctionObserver(fn);
    const arg = Symbol();

    // Act
    observer.call(arg);

    // Assert
    Assert.is(fn.firstCall.args.length, 1);
    Assert.is(fn.firstCall.args[0], arg);
  }
);
FunctionObserverSuite("should return the observed functions value", () => {
  // Arrange
  const value = Symbol();
  const fn = () => value;
  const observer = new FunctionObserver(fn);

  // Act
  const result = observer.call();

  // Assert
  Assert.is(result, value);
});
FunctionObserverSuite(
  "should notify subscribers when a tracked dependency is changed",
  () => {
    // Arrange
    const dependency = {};
    const update = spy();
    const fn = () => {
      track(dependency);
      return 12;
    };
    const observer = new FunctionObserver(fn);
    const subscriber: ISubscriber<Symbol> = {
      update,
    };
    observer.subscribe(subscriber);

    // Act
    observer.call();

    // Assert
    Assert.is(update.called, false, "Update should not have been called");

    // Act
    getNotifier(dependency).notify();

    // Assert
    Assert.is(update.called, true, "Update should be called");
    Assert.is(
      update.firstCall.args[0],
      fn,
      "Should invoked update with the target function source"
    );
  }
);
FunctionObserverSuite(
  "should not notify subscribers after it is disconnected",
  () => {
    // Arrange
    const dependency = {};
    const update = spy();
    const fn = () => {
      track(dependency);
      return 12;
    };
    const observer = new FunctionObserver(fn);
    const subscriber: ISubscriber<Symbol> = {
      update,
    };
    observer.subscribe(subscriber);

    // Act
    observer.call();

    // Assert
    Assert.is(update.called, false, "Update should not have been called");
    observer.disconnect();

    // Act
    getNotifier(dependency).notify();

    // Assert
    Assert.is(update.called, false, "Update should not be called");
  }
);

FunctionObserverSuite.run();
