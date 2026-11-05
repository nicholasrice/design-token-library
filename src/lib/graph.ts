/**
 * The tokens that refer to each token of a library, by name, found in their
 * configured values.
 *
 * @remarks
 * A library made by `create()` has the edges of all of its tokens. A library
 * made by `extend()` has the edges of its own tokens only, those with a value
 * of their own, and takes the rest from its source's graph: a token it
 * inherits has its source token's configured value, and the refs in it are
 * paths, which it resolves in its own library. So an extension costs the
 * tokens it gives a value, and a set of its source's token changes the
 * extension's graph too.
 *
 * @internal
 */
export class Graph {
    private readonly edges = new Map<string, Set<string>>();
    private changes = 0;

    /**
     * @param parent - The graph of the library this one extends.
     * @param isOwn - Whether a token has a value of its own, so its edges are
     * this graph's rather than the parent's.
     */
    constructor(
        private readonly parent: Graph | null,
        private readonly isOwn: (name: string) => boolean,
    ) {}

    /**
     * Adds the edges of `dependent` to each of `dependencies`.
     */
    public add(dependent: string, dependencies: Iterable<string>): void {
        this.changes++;
        for (const dependency of dependencies) {
            let dependents = this.edges.get(dependency);
            if (dependents === undefined) {
                dependents = new Set();
                this.edges.set(dependency, dependents);
            }
            dependents.add(dependent);
        }
    }

    public remove(dependent: string, dependencies: Iterable<string>): void {
        this.changes++;
        for (const dependency of dependencies) {
            const dependents = this.edges.get(dependency);
            dependents?.delete(dependent);
            if (dependents?.size === 0) {
                this.edges.delete(dependency);
            }
        }
    }

    /**
     * Changes with any edge of this graph or of the graphs it is on, so what
     * is found from it can be kept until it does.
     */
    public get version(): number {
        return this.changes + (this.parent?.version ?? 0);
    }

    /**
     * Calls `visit` with each token that refers to `name`, once.
     */
    public dependentsOf(name: string, visit: (dependent: string) => void) {
        this.parent?.dependentsOf(name, (dependent) => {
            if (!this.isOwn(dependent)) {
                visit(dependent);
            }
        });
        this.edges.get(name)?.forEach((dependent) => visit(dependent));
    }
}
