import { cssDirective, Observable } from "@microsoft/fast-element";
import type { ElementStyles, CSSDirective, ComposableStyles, AddBehavior } from "@microsoft/fast-element";
import { DesignTokenConfiguration, DesignTokenValue } from "./values.js";

export type CSSCustomPropertyName = `--${string}`;
export type CSSVariable = `var(${CSSCustomPropertyName})`;

export interface IDesignToken<DS extends {}, T> {
    readonly value: T;
    readonly name: string;
    readonly description?: string;
}

export interface ICSSDesignToken<DS extends object, T> extends CSSDirective {
    readonly cssProperty: CSSCustomPropertyName;
    readonly cssVar: CSSVariable;
}

class DesignToken<DS extends object, T> implements IDesignToken<DS, T> {
    constructor(configuration: DesignTokenConfiguration<DS, T> & { name: string}) {
        this.name = configuration.name;
        this.description = configuration.description;
    }

    public readonly name: string;
    public readonly description?: string;

    /**
     * Gets the token 
     * @observable
     */
    public get value(): T {
        Observable.track(this, "value");
        return "" as any;
    }

    public assign(value: DesignTokenValue<DS, T>): void {

    }
}

@cssDirective()
export class CSSDesignToken<DS extends object, T> extends DesignToken<DS, T> implements CSSDirective, ICSSDesignToken<DS, T> {
    constructor(configuration: DesignTokenConfiguration<DS, T> & { name: string}) {
        super(configuration);

        this.cssProperty = `--${configuration.name}`;
        this.cssVar = `var(${this.cssProperty})`;
    }

    /**
     * The CSS custom property created by the token
     */
    public readonly cssProperty: CSSCustomPropertyName;
    
    
    /** */
    public readonly cssVar: CSSVariable;

    /**
     * Create CSS to be interpolated into a {@link ElementStyles}
     * @param add - Callback to add behaviors to the host
     * @returns 
     */
    public createCSS(add: AddBehavior): ComposableStyles {
        return this.cssVar;
    }
}