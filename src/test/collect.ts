// Node's collector, without a flag on the command line. The specifiers are
// strings, so the modules are untyped and need no @types/node.
const v8: string = "node:v8";
const vm: string = "node:vm";
(await import(v8)).setFlagsFromString("--expose-gc");
const gc: () => void = (await import(vm)).runInNewContext("gc");

/**
 * Whether the target is collected, after a few collections and turns of the
 * event loop, which run the finalizers.
 */
export const isCollected = async (
    target: WeakRef<object>,
): Promise<boolean> => {
    for (let i = 0; i < 10 && target.deref() !== undefined; i++) {
        await new Promise((resolve) => setTimeout(resolve, 0));
        gc();
    }
    return target.deref() === undefined;
};
