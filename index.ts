export type DerivedValue<DSL, T> = (this: DSL) => T;
export type DesignTokenValue<DSL, T> = DerivedValue<DSL, T> | T;

export type DesignTokenLibrary<DSL extends {}, R = never> = {
    [K in keyof DSL]: DSL[K] extends object ? DesignTokenLibrary<DSL[K], DSL> : DesignTokenValue<R, DSL[K]>;
}

interface MyDesignSystem {
    colors: {
        backgroundColor: string;
        foregroundColor: string;
    },
    typography: {
        fontSize: number;
        fontWeight: number;
    },
    gridUnit: number;
}

function createDesignTokenLibrary<T extends {}>(raw: DesignTokenLibrary<T>) {

}

createDesignTokenLibrary<MyDesignSystem>({
    colors: {
        backgroundColor: 'red',
        foregroundColor: function () {return this.colors.backgroundColor}
    },
    typography: {
        fontSize: 12,
        fontWeight: 13
    },
    gridUnit: 8
});
