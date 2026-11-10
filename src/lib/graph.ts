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
    /**
     * The tokens whose edges the graph has, with the tokens they refer to:
     * the same edges as `edges`, from the other end.
     */
    private readonly dependencies = new Map<string, ReadonlySet<string>>();
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
     * Whether the graph has the edges of `dependent`.
     */
    public has(dependent: string): boolean {
        return this.dependencies.has(dependent);
    }

    /**
     * The tokens that `dependent` refers to, if the graph has its edges.
     */
    public dependenciesOf(dependent: string): ReadonlySet<string> | undefined {
        return this.dependencies.get(dependent);
    }

    /**
     * Adds the edges of `dependent` to each of `dependencies`, unless the
     * graph has its edges.
     */
    public add(dependent: string, dependencies: ReadonlySet<string>): void {
        if (this.dependencies.has(dependent)) {
            return;
        }

        this.changes++;
        this.dependencies.set(dependent, dependencies);
        for (const dependency of dependencies) {
            let dependents = this.edges.get(dependency);
            if (dependents === undefined) {
                dependents = new Set();
                this.edges.set(dependency, dependents);
            }
            dependents.add(dependent);
        }
    }

    /**
     * Drops the edges of `dependent`, and says whether the graph had them.
     */
    public remove(dependent: string): boolean {
        const dependencies = this.dependencies.get(dependent);
        if (dependencies === undefined) {
            return false;
        }

        this.changes++;
        this.dependencies.delete(dependent);
        for (const dependency of dependencies) {
            const dependents = this.edges.get(dependency);
            dependents?.delete(dependent);
            if (dependents?.size === 0) {
                this.edges.delete(dependency);
            }
        }
        return true;
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
