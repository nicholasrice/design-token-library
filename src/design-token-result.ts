import type { DesignTokenValue } from "./index";

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
  readonly set: (value: DesignTokenValue<DSL, T>) => void;
}

export class DesignTokenResultImpl<DSL, T>
  implements DesignTokenResult<DSL, T> {
    /**
     * TODO: Implement this.
     */
    public get value(): T {
        return null as any;
    }

    /**
     * TODO: Implement this.
     */
    public get token(): string {
        return "";
    }

    /**
     * TODO: Implement this.
     */
    public set(value: DesignTokenValue<DSL, T>) {

    }
}