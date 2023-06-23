
export type DeepPartial<T> = T extends object ? {
    [P in keyof T]?: DeepPartial<T[P]>;
} : T;
export function attachDeepProto<T extends {}>(obj: DeepPartial<T>, proto: T) {
    Object.setPrototypeOf(obj, proto);

    Object.keys(obj).forEach(key => {
        const value = Reflect.get(obj, key);
        const pro = Reflect.get(proto, key);
        if (typeof value === 'object' && value !== null && typeof pro === 'object' && pro !== null) {
            attachDeepProto(value as any, pro);
        }
    });
}