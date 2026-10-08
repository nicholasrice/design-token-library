// The tests only read fixture files, so declare the one function they use
// instead of depending on @types/node.
declare module "node:fs" {
    export function readFileSync(path: URL, encoding: "utf8"): string;
}
