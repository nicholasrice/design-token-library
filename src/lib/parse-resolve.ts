import {
    isChildName,
    isGroupNode,
    isObject,
    isReference,
    isTokenNode,
    label,
    referencePath,
    setOwn,
    type Node,
    type Report,
} from "./parse-document.js";
import { EXTENSION } from "./parse-extension.js";

/**
 * Parses a JSON Pointer in URI fragment form (RFC 6901), such as
 * `#/color/blue/$value`.
 */
const parsePointer = (pointer: string): string[] | undefined => {
    if (!pointer.startsWith("#")) {
        return undefined;
    }

    const rest = pointer.slice(1);

    if (rest === "") {
        return [];
    }

    if (!rest.startsWith("/")) {
        return undefined;
    }

    try {
        return rest
            .slice(1)
            .split("/")
            .map((segment) =>
                decodeURIComponent(segment)
                    .replaceAll("~1", "/")
                    .replaceAll("~0", "~"),
            );
    } catch {
        return undefined;
    }
};

/**
 * The most nodes a document may have once `$extends` and `$ref` are resolved.
 * Both copy what they name, so a chain of them grows exponentially: 22 groups
 * that each hold two `$ref`s to the one before are four million tokens. The
 * time to read a document is linear in its expanded size, so this bounds the
 * time, and a real document is a small part of it.
 */
const MAX_EXPANDED_NODES = 1_000_000;

/**
 * Thrown to stop expanding a document that is too large.
 */
export class TooLarge extends Error {}

export const tooLarge = (): { path: string; message: string } => ({
    path: "",
    message: `is more than ${MAX_EXPANDED_NODES} nodes once $extends and $ref are resolved. Each one copies what it names, so a chain of them grows exponentially.`,
});

/**
 * The number of nodes of a document, counting a node that is shared as many
 * times as it's used. That is what the document expands to.
 */
const expandedSize = (root: unknown): number => {
    const known = new WeakMap<object, number>();

    const size = (node: unknown): number => {
        if (typeof node !== "object" || node === null) {
            return 0;
        }

        const cached = known.get(node);

        if (cached !== undefined) {
            return cached;
        }

        let total = 1;

        for (const child of Object.values(node)) {
            total += size(child);
        }

        known.set(node, total);

        return total;
    };

    return size(root);
};

/**
 * Applies `$extends`: a group takes the tokens and groups of the group it
 * extends, and its own override them. Groups at the same path are merged
 * deeply; a token replaces a token in full.
 */
const resolveExtends = (doc: Node, report: Report): Node => {
    const done = new Map<string, any>();
    const active: string[] = [];

    const merge = (base: Node, over: Node): Node => {
        const result: Node = { ...base };

        for (const key of Object.keys(over)) {
            setOwn(
                result,
                key,
                isChildName(key) &&
                    isGroupNode(base[key]) &&
                    isGroupNode(over[key])
                    ? merge(base[key], over[key])
                    : over[key],
            );
        }

        return result;
    };

    const targetOf = (
        extended: unknown,
        here: string,
    ): string[] | undefined => {
        if (isReference(extended)) {
            return referencePath(extended);
        }

        if (isObject(extended) && typeof extended.$ref === "string") {
            const path = parsePointer(extended.$ref);

            if (path) {
                return path;
            }
        }

        report(
            here,
            `$extends must be a reference to a group, such as "{color.brand}" or { "$ref": "#/color/brand" }, but found ${JSON.stringify(extended)}.`,
        );

        return undefined;
    };

    const resolveNode = (node: unknown, path: string[]): any => {
        if (!isGroupNode(node)) {
            return node;
        }

        const key = label(path);

        if (done.has(key)) {
            return done.get(key);
        }

        if (active.includes(key)) {
            report(
                key,
                `$extends forms a cycle: ${[...active.slice(active.indexOf(key)), key].join(" → ")}.`,
            );

            const { $extends, ...rest } = node;

            return rest;
        }

        active.push(key);

        const local: Node = {};

        for (const property of Object.keys(node)) {
            if (property !== "$extends") {
                setOwn(
                    local,
                    property,
                    isChildName(property)
                        ? resolveNode(node[property], [...path, property])
                        : node[property],
                );
            }
        }

        let result = local;

        if ("$extends" in node) {
            const target = targetOf(node.$extends, key);

            if (target) {
                const base = lookup(target);

                if (base === undefined) {
                    report(
                        key,
                        `$extends names "${label(target)}", which does not exist.`,
                    );
                } else if (!isGroupNode(base)) {
                    report(
                        key,
                        `$extends names "${label(target)}", which is a token. It must name a group.`,
                    );
                } else {
                    result = merge(base, local);
                }
            }
        }

        active.pop();
        done.set(key, result);

        return result;
    };

    // Finds a group or token by path, seeing the children a group inherits.
    const lookup = (path: string[]): any => {
        let node: any = doc;
        const walked: string[] = [];

        for (const segment of path) {
            if (!isGroupNode(node)) {
                return undefined;
            }

            if ("$extends" in node) {
                node = resolveNode(node, walked);
            }

            if (!isChildName(segment) || !Object.hasOwn(node, segment)) {
                return undefined;
            }

            node = node[segment];
            walked.push(segment);
        }

        return resolveNode(node, walked);
    };

    return resolveNode(doc, []);
};

/**
 * Resolves `{ "$ref": "#/json/pointer" }`. A pointer to a token's `$value`
 * becomes a reference, so the value stays live; a pointer to anything else is
 * replaced by a copy of what it points at.
 */
const resolvePointers = (doc: Node, report: Report): Node => {
    const active: string[] = [];

    const pointerGet = (path: string[], here: string[]): any => {
        let node: any = doc;

        for (const segment of path) {
            if (isObject(node) && "$ref" in node) {
                node = refObject(node, here);

                // A reference to a token stands for its $value, so a pointer
                // can go on through it.
                if (isReference(node)) {
                    node = pointerGet([...referencePath(node), "$value"], here);
                }
            }

            if (Array.isArray(node)) {
                node = node[Number(segment)];
            } else if (isObject(node) && Object.hasOwn(node, segment)) {
                node = node[segment];
            } else {
                return undefined;
            }
        }

        return node;
    };

    const refObject = (node: Node, here: string[]): any => {
        const where = label(here);

        if (typeof node.$ref !== "string" || Object.keys(node).length !== 1) {
            report(where, `a $ref must be the only property, and a string.`);

            return node;
        }

        const path = parsePointer(node.$ref);

        if (!path) {
            report(
                where,
                `$ref "${node.$ref}" is not a JSON Pointer into this document, such as "#/color/blue/$value".`,
            );

            return node;
        }

        if (active.includes(node.$ref)) {
            report(
                where,
                `$ref "${node.$ref}" is circular: ${[...active.slice(active.indexOf(node.$ref)), node.$ref].join(" → ")}.`,
            );

            return node;
        }

        active.push(node.$ref);

        try {
            const target = pointerGet(path, here);

            if (target === undefined) {
                report(where, `$ref "${node.$ref}" does not exist.`);

                return node;
            }

            const parent = path.slice(0, -1);

            if (
                path[path.length - 1] === "$value" &&
                isTokenNode(pointerGet(parent, here))
            ) {
                return `{${parent.join(".")}}`;
            }

            if (isTokenNode(target)) {
                return `{${path.join(".")}}`;
            }

            return walk(target, here);
        } finally {
            active.pop();
        }
    };

    let visited = 0;

    // Extensions are vendor data, and a "$ref" in one is theirs, except in
    // this library's own: it holds the library's form of the token, which
    // the hand-written form's "$ref" reads in.
    const extensionsOf = (extensions: any, here: string[]): any => {
        if (!isObject(extensions) || !Object.hasOwn(extensions, EXTENSION)) {
            return extensions;
        }

        const result: Node = { ...extensions };

        setOwn(
            result,
            EXTENSION,
            walk(extensions[EXTENSION], [...here, EXTENSION]),
        );

        return result;
    };

    const walk = (node: any, here: string[]): any => {
        // A node is an object or an array, as `expandedSize()` counts them.
        if (typeof node !== "object" || node === null) {
            return node;
        }

        if (++visited > MAX_EXPANDED_NODES) {
            throw new TooLarge();
        }

        if (Array.isArray(node)) {
            return node.map((item, index) => walk(item, [...here, `${index}`]));
        }

        if ("$ref" in node) {
            return refObject(node, here);
        }

        const result: Node = {};

        for (const key of Object.keys(node)) {
            setOwn(
                result,
                key,
                key === "$extensions"
                    ? extensionsOf(node[key], [...here, key])
                    : walk(node[key], [...here, key]),
            );
        }

        return result;
    };

    return walk(doc, []);
};

/**
 * Resolves `$extends` and `$ref`.
 *
 * @throws TooLarge when they expand the document past what is allowed.
 */
export const resolveReferences = (doc: Node, report: Report): Node => {
    const extended = resolveExtends(doc, report);

    // `$extends` shares what it copies, so it is cheap itself, and what it
    // expands to is what the passes after it must visit.
    if (expandedSize(extended) > MAX_EXPANDED_NODES) {
        throw new TooLarge();
    }

    return resolvePointers(extended, report);
};
