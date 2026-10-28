import { DesignToken } from "./design-token.js";
import { Library } from "./library.js";
import { calledName, parseCall, type Expression } from "./parse-expression.js";
import { isStandardType, readValue, type ValueContext } from "./parse-value.js";
import { RECIPE } from "./recipe.js";
import { refTo } from "./ref.js";

/**
 * One problem found in a tokens document.
 *
 * @public
 */
export interface ParseIssue {
    /**
     * The dotted path of the token or group, plus the location inside its
     * value, such as `color.brand.$value.components[0]`.
     */
    readonly path: string;
    readonly message: string;
}

/**
 * Thrown by {@link parse} for a document with problems. It reports every
 * problem found, not only the first.
 *
 * @public
 */
export class ParseError extends Error {
    public override readonly name = "ParseError";

    public readonly issues: ReadonlyArray<ParseIssue>;

    constructor(issues: ReadonlyArray<ParseIssue>) {
        super(
            `Invalid design tokens document (${issues.length} ${
                issues.length === 1 ? "issue" : "issues"
            }):\n${issues
                .map(
                    (issue) =>
                        `  ${issue.path || "(document)"}: ${issue.message}`,
                )
                .join("\n")}`,
        );
        this.issues = issues;
    }
}

/**
 * Options of {@link parse}.
 *
 * @public
 */
export interface ParseOptions {
    /**
     * The names of the custom types the document may use, such as
     * `Object.values(MyTypes)`. Their values are read as they are, with the
     * references in them. A `$type` that is neither a standard type nor one
     * of these is an error.
     */
    readonly types?: readonly string[];

    /**
     * The recipes the document may call, such as `{ ...Recipes, ...More }`.
     * A string written as a call to one of them, such as
     * `"darken({color.blue}, 0.2)"`, is a computed value. A recipe is known
     * by its name, not by its key here, and two different recipes can't have
     * the same name.
     */
    readonly recipes?: Readonly<Record<string, Library.Recipe<any, unknown>>>;
}

type RecipesByName = ReadonlyMap<string, Library.Recipe<any, unknown>>;

/**
 * The recipes of `options.recipes` by name, which must be unique.
 */
const recipesByName = (
    recipes: ParseOptions["recipes"] = {},
): RecipesByName => {
    const byName = new Map<string, Library.Recipe<any, unknown>>();

    for (const recipe of Object.values(recipes)) {
        const { name } = recipe[RECIPE];
        const known = byName.get(name);

        if (known !== undefined && known !== recipe) {
            throw new Error(
                `Two different recipes are named "${name}", so a document can't call one of them by name.`,
            );
        }

        byName.set(name, recipe);
    }

    return byName;
};

type Node = Record<string, any>;

const isObject = (value: unknown): value is Node =>
    typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Sets an own property, even one named `__proto__`, which an assignment sets
 * the prototype of: a token with that name would be lost without a word.
 */
const setOwn = (target: Node, key: string, value: unknown): void => {
    Object.defineProperty(target, key, {
        value,
        enumerable: true,
        writable: true,
        configurable: true,
    });
};

const isTokenNode = (value: unknown): value is Node =>
    isObject(value) && "$value" in value;

const isGroupNode = (value: unknown): value is Node =>
    isObject(value) && !("$value" in value);

/**
 * A child of a group: anything not `$`-prefixed, and the group's own token
 * `$root`.
 */
const isChildName = (key: string): boolean =>
    !key.startsWith("$") || key === "$root";

const REFERENCE = /^\{([^{}]+)\}$/;

/**
 * Tests whether a value is a reference to a token, such as `"{color.blue}"`.
 */
const isReference = (value: unknown): value is string =>
    typeof value === "string" && REFERENCE.test(value);

const referencePath = (reference: string): string[] =>
    reference.slice(1, -1).split(".");

const label = (path: string[]): string => path.join(".");

const TOKEN_PROPERTIES = [
    "$value",
    "$type",
    "$description",
    "$extensions",
    "$deprecated",
];

const GROUP_PROPERTIES = [
    "$type",
    "$description",
    "$extensions",
    "$deprecated",
];

type Report = (path: string, message: string) => void;

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
class TooLarge extends Error {}

const tooLarge = (): ParseIssue => ({
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

    const walk = (node: any, here: string[]): any => {
        if (++visited > MAX_EXPANDED_NODES) {
            throw new TooLarge();
        }

        if (Array.isArray(node)) {
            return node.map((item, index) => walk(item, [...here, `${index}`]));
        }

        if (!isObject(node)) {
            return node;
        }

        if ("$ref" in node) {
            return refObject(node, here);
        }

        const result: Node = {};

        for (const key of Object.keys(node)) {
            // Extensions are vendor data; a "$ref" there is theirs.
            setOwn(
                result,
                key,
                key === "$extensions"
                    ? node[key]
                    : walk(node[key], [...here, key]),
            );
        }

        return result;
    };

    return walk(doc, []);
};

/**
 * The key of this library's extension in `$extensions`. A document written in
 * the DTCG form keeps there what DTCG can't express: a token's own `$type`
 * and `$value`, and a group's own `$type`.
 */
const EXTENSION = "design-token-library";

/**
 * A token's `$type` and `$value` in the DTCG form of a document, which are
 * checked, while the token's own, in this library's extension, are read.
 */
interface CompliantForm {
    readonly type: string | undefined;
    readonly value: unknown;
}

/**
 * Takes a token's or group's own properties from this library's extension,
 * in place of the ones of its DTCG form, and removes the extension. Records
 * the DTCG form of each token that has one, by path, so it's still checked.
 */
const resolveExtension = (
    doc: Node,
    report: Report,
): { doc: Node; compliant: ReadonlyMap<string, CompliantForm> } => {
    const compliant = new Map<string, CompliantForm>();

    // The extension's properties, which are only those of `allowed`.
    const ownOf = (
        node: Node,
        result: Node,
        here: string,
        allowed: string[],
    ): Node | undefined => {
        if (!isObject(node.$extensions) || !(EXTENSION in node.$extensions)) {
            return undefined;
        }

        const { [EXTENSION]: own, ...others } = node.$extensions;

        if (Object.keys(others).length > 0) {
            result.$extensions = others;
        } else {
            delete result.$extensions;
        }

        const where = `${here}.$extensions.${EXTENSION}`;

        if (!isObject(own)) {
            report(where, `must be an object.`);
            return undefined;
        }

        for (const key of Object.keys(own)) {
            if (!allowed.includes(key)) {
                report(
                    where,
                    `has an unsupported property "${key}". It accepts ${allowed.join(", ")}.`,
                );
            }
        }

        return own;
    };

    const walk = (
        node: Node,
        path: string[],
        inherited: string | undefined,
    ): Node => {
        const here = label(path);
        const result: Node = { ...node };
        const type = typeof node.$type === "string" ? node.$type : inherited;

        if (isTokenNode(node)) {
            const own = ownOf(node, result, here, ["$type", "$value"]);

            if (own !== undefined) {
                compliant.set(here, { type, value: node.$value });

                for (const key of ["$type", "$value"]) {
                    if (key in own) {
                        result[key] = own[key];
                    }
                }
            }

            return result;
        }

        const own = ownOf(node, result, here, ["$type"]);

        if (own !== undefined && "$type" in own) {
            result.$type = own.$type;
        }

        for (const key of Object.keys(node)) {
            if (isChildName(key) && isObject(node[key])) {
                setOwn(result, key, walk(node[key], [...path, key], type));
            }
        }

        return result;
    };

    return { doc: walk(doc, [], undefined), compliant };
};

type Found =
    | { kind: "token"; node: Node; inherited: string | undefined }
    | { kind: "group"; node: Node };

/**
 * Checks a document and turns it into the {@link (Library:namespace).Config}
 * a library is created from. Every problem is reported.
 */
const convert = (
    doc: Node,
    compliant: ReadonlyMap<string, CompliantForm>,
    customTypes: ReadonlySet<string>,
    recipes: RecipesByName,
    report: Report,
): Node => {
    const types = new Map<string, string | undefined>();
    const chain: string[] = [];
    const circular = new Set<string>();

    const knownType = (type: string): boolean =>
        isStandardType(type) || customTypes.has(type);

    // Finds a token or group by path, with the type its groups give it.
    const find = (path: string[]): Found | undefined => {
        let node: unknown = doc;
        let inherited: string | undefined =
            typeof doc.$type === "string" ? doc.$type : undefined;

        for (const segment of path) {
            if (!isGroupNode(node)) {
                return undefined;
            }

            if (!isChildName(segment) || !Object.hasOwn(node, segment)) {
                return undefined;
            }

            node = node[segment];

            if (isGroupNode(node) && typeof node.$type === "string") {
                inherited = node.$type;
            }
        }

        if (isTokenNode(node)) {
            return { kind: "token", node, inherited };
        }

        return isObject(node) ? { kind: "group", node } : undefined;
    };

    // The type of a token: its own, else the type of the token it refers
    // to, else the nearest group's.
    const typeOf = (path: string[]): string | undefined => {
        const key = label(path);

        if (types.has(key)) {
            return types.get(key);
        }

        const found = find(path);

        if (found?.kind !== "token") {
            return undefined;
        }

        if (chain.includes(key)) {
            // Reported by checkCycle.
            return undefined;
        }

        chain.push(key);

        const { node, inherited } = found;
        let type: string | undefined;

        if (typeof node.$type === "string") {
            type = node.$type;
        } else if (isReference(node.$value)) {
            type = typeOf(referencePath(node.$value));
        }

        type ??= inherited;
        chain.pop();
        types.set(key, type);

        return type;
    };

    // Follows a token's chain of references to find a loop. A token with its
    // own $type never needs the chain to find its type, so typeOf cannot
    // find it.
    const checkCycle = (path: string[]) => {
        const visited: string[] = [];
        let current: string[] | undefined = path;

        while (current) {
            const key = label(current);

            if (visited.includes(key)) {
                const loop = visited.slice(visited.indexOf(key));

                if (!loop.some((member) => circular.has(member))) {
                    report(
                        label(path),
                        `Circular reference: ${[...loop, key].join(" → ")}.`,
                    );
                }

                for (const member of loop) {
                    circular.add(member);
                }

                return;
            }

            visited.push(key);

            const found = find(current);
            current =
                found?.kind === "token" && isReference(found.node.$value)
                    ? referencePath(found.node.$value)
                    : undefined;
        }
    };

    // Reads a reference to a token, such as "{color.blue}", which must be of
    // the `expected` type when there is one.
    const reference = (
        value: unknown,
        expected: string | undefined,
        path: string,
    ): unknown =>
        isReference(value)
            ? refer(referencePath(value), expected, path)
            : undefined;

    // Makes the ref to the token at `target`, which must exist and be of the
    // `expected` type when there is one.
    const refer = (
        target: string[],
        expected: string | undefined,
        path: string,
    ): Library.Ref<any, any> => {
        const value = `{${label(target)}}`;
        const found = find(target);

        if (!found) {
            report(path, `references "${value}", which does not exist.`);
        } else if (found.kind === "group") {
            report(
                path,
                `references "${value}", which is a group. A reference must name a token.`,
            );
        } else if (expected !== undefined) {
            const type = typeOf(target);

            if (type !== undefined && type !== expected) {
                report(
                    path,
                    `references "${value}", a ${type} token, where a ${expected} is needed.`,
                );
            }
        }

        return refTo(target);
    };

    // The call of a string that looks like a call to a name that isn't a
    // recipe, by its path, to explain why its value isn't valid.
    const unknownCalls = new Map<string, string>();

    // The config value of an expression of a recipe call.
    const evaluate = (expression: Expression, path: string): unknown => {
        switch (expression.kind) {
            case "call": {
                const recipe = recipes.get(expression.name);

                if (recipe === undefined) {
                    report(
                        path,
                        `calls "${expression.name}", which is not one of the recipes.`,
                    );
                    return undefined;
                }

                return recipe(
                    ...expression.args.map((arg) => evaluate(arg, path)),
                );
            }
            case "reference":
                // A recipe decides what its arguments may be.
                return refer(expression.path, undefined, path);
            case "literal":
                return expression.value;
            case "array":
                return expression.items.map((item) => evaluate(item, path));
            case "object":
                return Object.fromEntries(
                    expression.entries.map(([key, value]) => [
                        key,
                        evaluate(value, path),
                    ]),
                );
        }
    };

    // A string is a recipe call only when it calls one of the recipes, so a
    // string value such as "calc(100% - 4px)" stays a string.
    const callsRecipe = (value: unknown): value is string => {
        const name = typeof value === "string" ? calledName(value) : undefined;

        return name !== undefined && recipes.has(name);
    };

    // Reads a recipe call, such as "darken({color.blue}, 0.2)".
    const call = (value: unknown, path: string): unknown => {
        if (!callsRecipe(value)) {
            const name =
                typeof value === "string" ? calledName(value) : undefined;

            if (name !== undefined) {
                unknownCalls.set(path, name);
            }

            return undefined;
        }

        const parsed = parseCall(value);

        if ("error" in parsed) {
            report(path, `is not a valid recipe call: ${parsed.error}`);
            // Reported, so the reader of the position doesn't report it again.
            return value;
        }

        return evaluate(parsed.call, path);
    };

    const context: ValueContext = {
        report: (path, message) => {
            const name = unknownCalls.get(path);

            report(
                path,
                name === undefined
                    ? message
                    : `${message} It looks like a recipe call, but "${name}" is not one of the recipes.`,
            );
        },
        reference: (value, type, path) =>
            reference(value, type, path) ?? call(value, path),
    };

    // A custom value isn't checked, but the references and recipe calls in
    // it are read, at any depth.
    const readCustom = (value: unknown, path: string): unknown => {
        const read = reference(value, undefined, path) ?? call(value, path);

        if (read !== undefined) {
            return read;
        }

        if (Array.isArray(value)) {
            return value.map((item, index) =>
                readCustom(item, `${path}[${index}]`),
            );
        }

        if (isObject(value)) {
            const result: Node = {};

            for (const key of Object.keys(value)) {
                setOwn(result, key, readCustom(value[key], `${path}.${key}`));
            }

            return result;
        }

        return value;
    };

    const checkMetadata = (node: Node, path: string, where: string) => {
        if (
            node.$description !== undefined &&
            typeof node.$description !== "string"
        ) {
            report(`${path}.$description`, `must be a string.`);
        }

        if (node.$extensions !== undefined && !isObject(node.$extensions)) {
            report(`${path}.$extensions`, `must be an object.`);
        }

        if (
            node.$deprecated !== undefined &&
            typeof node.$deprecated !== "boolean" &&
            typeof node.$deprecated !== "string"
        ) {
            report(`${path}.$deprecated`, `must be true, false or a string.`);
        }

        if (node.$type !== undefined) {
            if (typeof node.$type !== "string" || !knownType(node.$type)) {
                report(
                    `${path}.$type`,
                    `${JSON.stringify(node.$type)} is not a type of ${where}. Expected one of ${[
                        ...Object.values(DesignToken.Type),
                        ...customTypes,
                    ].join(", ")}.`,
                );
            }
        }
    };

    // A copy of the metadata, so the library doesn't share it with the
    // document.
    const metadataOf = (node: Node, keys: string[]): Node => {
        const result: Node = {};

        for (const key of keys) {
            if (node[key] !== undefined) {
                result[key] = structuredClone(node[key]);
            }
        }

        return result;
    };

    // The type of a token in its DTCG form: its own or its group's, else, for
    // an alias, the DTCG type of the token it names, as the format says. A
    // token without the extension is the same in both forms.
    const dtcgTypeOf = (
        path: string[],
        seen: readonly string[] = [],
    ): string | undefined => {
        const key = label(path);
        const form = compliant.get(key);

        if (form === undefined) {
            return typeOf(path);
        }

        return form.type !== undefined ||
            !isReference(form.value) ||
            seen.includes(key)
            ? form.type
            : dtcgTypeOf(referencePath(form.value), [...seen, key]);
    };

    // Checks the DTCG form of a token whose own form is in this library's
    // extension. Its references only have to exist: they're of the DTCG
    // form, and the types of the tokens are their own.
    const checkCompliant = (form: CompliantForm, here: string) => {
        const where = `${here}.$value`;
        const type =
            form.type ??
            (isReference(form.value)
                ? dtcgTypeOf(referencePath(form.value))
                : undefined);

        if (type === undefined) {
            report(
                here,
                `has no $type in its DTCG form, its own, its group's or the one of the token it references.`,
            );
        } else if (!isStandardType(type)) {
            report(
                `${here}.$type`,
                `${JSON.stringify(type)} is not a standard type, so the token's DTCG form isn't DTCG. Its own type goes in $extensions["${EXTENSION}"].$type.`,
            );
        } else if (isReference(form.value)) {
            reference(form.value, undefined, where);
        } else {
            readValue(type, form.value, where, {
                report,
                reference: (value, _type, path) =>
                    reference(value, undefined, path),
            });
        }
    };

    const convertToken = (node: Node, path: string[]): Node | undefined => {
        const here = label(path);

        for (const key of Object.keys(node)) {
            if (!TOKEN_PROPERTIES.includes(key)) {
                report(
                    here,
                    key.startsWith("$")
                        ? `has an unsupported property "${key}". A token accepts ${TOKEN_PROPERTIES.join(", ")}.`
                        : `has a $value, so it is a token and cannot have a child "${key}".`,
                );
            }
        }

        checkMetadata(node, here, "a token");

        if (isReference(node.$value)) {
            checkCycle(path);
        }

        const type = typeOf(path);

        if (type === undefined) {
            if (!circular.has(here)) {
                report(
                    here,
                    `has no $type. A token takes its own $type, the type of the token it references, or the $type of the nearest group${
                        callsRecipe(node.$value)
                            ? ", not the type of a recipe's result"
                            : ""
                    }.`,
                );
            }

            return undefined;
        }

        if (!knownType(type)) {
            if (typeof node.$type !== "string") {
                report(
                    here,
                    `has the type ${JSON.stringify(type)}, which is not known.`,
                );
            }

            return undefined;
        }

        const value: unknown = node.$value;
        const where = `${here}.$value`;
        let read: unknown;

        if (isReference(value)) {
            read = reference(value, type, where);

            const found = find(path);
            const inherited =
                found?.kind === "token" ? found.inherited : undefined;

            if (
                node.$type === undefined &&
                inherited !== undefined &&
                typeOf(referencePath(value)) !== inherited
            ) {
                report(
                    where,
                    `references "${value}", but the token's group gives the $type ${JSON.stringify(inherited)}.`,
                );
            }
        } else {
            read =
                call(value, where) ??
                (isStandardType(type)
                    ? readValue(type, value, where, context)
                    : readCustom(value, where));
        }

        const form = compliant.get(here);

        if (form !== undefined) {
            checkCompliant(form, here);
        }

        return {
            $type: type,
            $value: read,
            ...metadataOf(node, ["$description", "$extensions", "$deprecated"]),
        };
    };

    const convertGroup = (node: Node, path: string[]): Node => {
        const here = label(path);
        const result: Node = metadataOf(node, GROUP_PROPERTIES);

        checkMetadata(node, here, "a group");

        for (const key of Object.keys(node)) {
            if (!isChildName(key)) {
                if (!GROUP_PROPERTIES.includes(key)) {
                    report(
                        here,
                        `has an unsupported property "${key}". A group accepts ${GROUP_PROPERTIES.join(", ")}.`,
                    );
                }

                continue;
            }

            const child = node[key];
            const childPath = [...path, key];

            if (key === "") {
                report(here, `has a child with an empty name.`);
                continue;
            }

            if (key === "__proto__" || /[{}.]/.test(key)) {
                report(
                    label(childPath),
                    `is not a valid name. A name cannot be "__proto__", or contain ".", "{" or "}".`,
                );
                continue;
            }

            if (!isObject(child)) {
                report(
                    label(childPath),
                    `must be a token or a group (an object), but found ${JSON.stringify(child)}.`,
                );
                continue;
            }

            if (key === "$root" && path.length === 0) {
                report(
                    key,
                    `$root is the token of a group, so it cannot be at the top level of a document.`,
                );
                continue;
            }

            if (isTokenNode(child)) {
                const token = convertToken(child, childPath);

                if (token) {
                    setOwn(result, key, token);
                }
            } else if (key === "$root") {
                report(
                    label(childPath),
                    `$root must be a token, so it needs a $value.`,
                );
            } else {
                setOwn(result, key, convertGroup(child, childPath));
            }
        }

        return result;
    };

    return convertGroup(doc, []);
};

/**
 * Reads a tokens document: the
 * {@link https://www.designtokens.org/tr/2025.10/format/ | DTCG 2025.10}
 * format and color module, and this library's extensions to it. Returns the
 * {@link (Library:namespace).Config} it describes, to create a library from.
 *
 * @remarks
 * `$extends` and `$ref` are resolved, every token gets its resolved `$type`,
 * and every value of a standard type is checked. A reference, such as
 * `"{color.blue}"`, becomes a {@link (Library:namespace).Ref}, so the token
 * follows the token it names. A custom type is read when it's one of
 * `options.types`. A string that calls one of `options.recipes`, such as
 * `"darken({color.blue}, 0.2)"`, is a computed value. A document in the DTCG
 * form keeps a token's own `$type` and `$value`, and a group's own `$type`,
 * in `$extensions["design-token-library"]`: those are read, and the DTCG form
 * is checked. A document with problems throws a {@link ParseError} that
 * lists all of them.
 *
 * A document's shape is known only when it's read, so the config isn't
 * typed. Give the library's shape to `Library.create` to type its tokens.
 *
 * @example
 * ```ts
 * const library = Library.create<Theme>(parse(await (await fetch("theme.tokens.json")).text()));
 * ```
 *
 * @param document - the document, as JSON text or already parsed. It isn't
 * changed.
 *
 * @public
 */
export function parse(
    document: string | object,
    options: ParseOptions = {},
): Library.Config<any> {
    const issues: ParseIssue[] = [];
    const report: Report = (path, message) => issues.push({ path, message });
    let doc: unknown = document;

    if (typeof document === "string") {
        try {
            // A byte order mark, which some tools write, isn't JSON.
            doc = JSON.parse(document.replace(/^\uFEFF/, ""));
        } catch (error) {
            throw new ParseError([
                {
                    path: "",
                    message: `is not valid JSON: ${error instanceof Error ? error.message : error}`,
                },
            ]);
        }
    }

    if (!isObject(doc)) {
        throw new ParseError([
            { path: "", message: "must be a JSON object, the root group." },
        ]);
    }

    let native: ReturnType<typeof resolveExtension>;

    try {
        const extended = resolveExtends(doc, report);

        // `$extends` shares what it copies, so it is cheap itself, and what it
        // expands to is what the passes after it must visit.
        if (expandedSize(extended) > MAX_EXPANDED_NODES) {
            throw new TooLarge();
        }

        native = resolveExtension(resolvePointers(extended, report), report);
    } catch (error) {
        if (error instanceof TooLarge) {
            throw new ParseError([...issues, tooLarge()]);
        }

        throw error;
    }

    const config = convert(
        native.doc,
        native.compliant,
        new Set(options.types),
        recipesByName(options.recipes),
        report,
    );

    if (issues.length > 0) {
        throw new ParseError(issues);
    }

    return config;
}
