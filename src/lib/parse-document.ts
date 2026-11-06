/*
 * What the passes over a tokens document share: its nodes and references.
 */

export type Node = Record<string, any>;

export const isObject = (value: unknown): value is Node =>
    typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Sets an own property, even one named `__proto__`, which an assignment sets
 * the prototype of: a token with that name would be lost without a word.
 */
export const setOwn = (target: Node, key: string, value: unknown): void => {
    Object.defineProperty(target, key, {
        value,
        enumerable: true,
        writable: true,
        configurable: true,
    });
};

export const isTokenNode = (value: unknown): value is Node =>
    isObject(value) && "$value" in value;

export const isGroupNode = (value: unknown): value is Node =>
    isObject(value) && !("$value" in value);

/**
 * A child of a group: anything not `$`-prefixed, and the group's own token
 * `$root`.
 */
export const isChildName = (key: string): boolean =>
    !key.startsWith("$") || key === "$root";

const REFERENCE = /^\{([^{}]+)\}$/;

/**
 * Tests whether a value is a reference to a token, such as `"{color.blue}"`.
 */
export const isReference = (value: unknown): value is string =>
    typeof value === "string" && REFERENCE.test(value);

export const referencePath = (reference: string): string[] =>
    reference.slice(1, -1).split(".");

export const label = (path: string[]): string => path.join(".");

export type Report = (path: string, message: string) => void;
