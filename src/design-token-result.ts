import { Binding, Disposable, ExpressionNotifier, Observable, observable,  } from "@microsoft/fast-element";
import { isConfigurationValue, type DesignTokenValue, isDerivedValue, DerivedValue, StaticValue } from "./values.js";

export interface DesignTokenResult<DSL, T> {
  /**
   * The value of the design token.
   */
  readonly value: T;

  /**
   * The token string to be used in CSS.
   */
  readonly token: string;

  /**
   * Sets the value of the token to the provided value.
   * @param value - The token value to assign.
   * @returns void
   *
   * @privateRemarks - A setter function is required because it should
   * be assignable to a function that returns the type of the token (T)
   * *or* a value of T, however the `value` field should always be of type T.
   */
  set(value: DerivedValue<DSL, T> | StaticValue<T>): void;
}

export class DesignTokenResultImpl<DSL, T>
  implements DesignTokenResult<DSL, T> {
    private _value!: T;
    @observable
    private expressionNotifier: ExpressionNotifier;
    private expressionNotifierChanged(prev: ExpressionNotifier | undefined, next: ExpressionNotifier) {
        if (prev) {
            prev.unsubscribe(this);
        }

        next.subscribe(this);
        this._value =  this.expressionNotifier.observe(undefined);
    }

    public get value(): T {
        Observable.track(this, "value");
        return this._value;
    }

    /**
     * TODO: Implement this.
     */
    public get token(): string {
        return "";
    }

    public set(value: DerivedValue<DSL, T> | StaticValue<T>) {
        this.expressionNotifier = this.createBinding(value);
        Observable.notify(this, "value");
    }

    constructor(private readonly context: DSL, value: DesignTokenValue<DSL, T>) {
        let normalizedValue = isConfigurationValue(value) ? value.$value : value;
        this.expressionNotifier = this.createBinding(normalizedValue);
    }

    private createBinding(value: StaticValue<T> | DerivedValue<DSL, T>) {
        const normalized = isDerivedValue(value) ? value : () => value;
        return Observable.binding(normalized.bind(this.context));
    }

    handleChange(source: Function, args: ExpressionNotifier) {
        const value = args.observe(undefined);

        if (value !== this._value) {
            this._value = value;
            Observable.notify(this, "value");
        }
    }
}