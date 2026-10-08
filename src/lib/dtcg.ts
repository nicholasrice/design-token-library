import { Library } from "./library.js";
import { RecipeRegistry, recipes as defaultRecipes, isRef } from "./recipe.js";
import { isDTCGType, validateValue, type ValueContext } from "./dtcg-values.js";
import { DesignToken } from "./design-token.js";

/**
 * One problem found in a DTCG document.
 *
 * @public
 */
export interface DTCGIssue {
    /**
     * The dotted path of the token or group, plus the location inside its
     * value, such as `color.brand.$value.components[0]`.
     */
    path: string;
    message: string;
}

/**
 * Thrown when a document is not valid DTCG. It reports every problem found,
 * not only the first.
 *
 * @public
 */
export class DTCGError extends Error {
    constructor(public readonly issues: ReadonlyArray<DTCGIssue>) {
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
        this.name = "DTCGError";
    }
}

/**
 * Options for {@link fromDTCG} and {@link parseDTCG}.
 *
 * @public
 */
export interface DTCGOptions {
    /**
     * The {@link RecipeRegistry} that resolves `$recipe`. Defaults to the global
     * {@link recipes} registry.
     */
    recipes?: RecipeRegistry;

    /**
     * Names of custom token types the document may use, in addition to the
     * DTCG types and the types of registered recipes. The values of a custom
     * type are not validated.
     */
    types?: string[];
}

type Node = Record<string, any>;

const isObject = (value: unknown): value is Node =>
    typeof value === "object" && value !== null && !Array.isArray(value);

const isTokenNode = (value: unknown): boolean =>
    isObject(value) && "$value" in value;

const isGroupNode = (value: unknown): value is Node =>
    isObject(value) && !("$value" in value);

/**
 * A child of a group: anything not `$`-prefixed, and the group's own token
 * `$root`.
 */
const isChildName = (key: string): boolean =>
    !key.startsWith("$") || key === "$root";

const refPath = (ref: string): string[] => ref.slice(1, -1).split(".");

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

const RECIPE_GROUP_PROPERTIES = [...GROUP_PROPERTIES, "$recipe", "$with"];

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
            result[key] =
                isChildName(key) &&
                isGroupNode(base[key]) &&
                isGroupNode(over[key])
                    ? merge(base[key], over[key])
                    : over[key];
        }

        return result;
    };

    const targetOf = (
        extended: unknown,
        here: string,
    ): string[] | undefined => {
        if (isRef(extended)) {
            return refPath(extended);
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
                local[property] = isChildName(property)
                    ? resolveNode(node[property], [...path, property])
                    : node[property];
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
 * becomes an alias, so the value stays live; a pointer to anything else is
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

    const walk = (node: any, here: string[]): any => {
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
            result[key] =
                key === "$extensions"
                    ? node[key]
                    : walk(node[key], [...here, key]);
        }

        return result;
    };

    return walk(doc, []);
};

interface Found {
    kind: "token" | "group" | "generated";
    node?: Node;
    type?: string;
    inherited?: string;
}

/**
 * Checks a document and turns it into the {@link (Library:namespace).Config}
 * the library is created from. Every problem is reported before it throws.
 */
const convert = (
    doc: Node,
    registry: RecipeRegistry,
    customTypes: ReadonlySet<string>,
    report: Report,
): Node => {
    const types = new Map<string, string | undefined>();
    const chain: string[] = [];
    const circular = new Set<string>();

    const knownType = (type: string): boolean =>
        isDTCGType(type) || customTypes.has(type);

    // Finds a token or group by path. A group recipe generates its keys later,
    // so any single key under one is accepted.
    const find = (path: string[]): Found | undefined => {
        let node: any = doc;
        let inherited: string | undefined =
            typeof doc.$type === "string" ? doc.$type : undefined;

        for (let index = 0; index < path.length; index++) {
            if (!isGroupNode(node)) {
                return undefined;
            }

            if ("$recipe" in node) {
                const recipe = registry.get(node.$recipe);

                return recipe?.keys && index === path.length - 1
                    ? { kind: "generated", type: recipe.type }
                    : undefined;
            }

            const segment = path[index];

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

    // The type of a token: its own, else the type of the token it aliases,
    // else the nearest group's.
    const typeOf = (path: string[]): string | undefined => {
        const key = label(path);

        if (types.has(key)) {
            return types.get(key);
        }

        const found = find(path);

        if (found?.kind === "generated") {
            return found.type;
        }

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

        if (typeof node!.$type === "string") {
            type = node!.$type;
        } else if (isObject(node!.$value) && "$recipe" in node!.$value) {
            type = registry.get(node!.$value.$recipe)?.type;
        } else if (isRef(node!.$value)) {
            type = typeOf(refPath(node!.$value));
        }

        type ??= inherited;
        chain.pop();
        types.set(key, type);

        return type;
    };

    // Follows a token's chain of aliases to find a loop. A token with its own
    // $type never needs the chain to find its type, so typeOf cannot find it.
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
                found?.kind === "token" && isRef(found.node!.$value)
                    ? refPath(found.node!.$value)
                    : undefined;
        }
    };

    const checkRef = (ref: string, expected: string, path: string) => {
        const target = refPath(ref);
        const found = find(target);

        if (!found) {
            report(path, `references "${ref}", which does not exist.`);
        } else if (found.kind === "group") {
            report(
                path,
                `references "${ref}", which is a group. A reference must name a token.`,
            );
        } else {
            const type = typeOf(target);

            if (type !== undefined && type !== expected) {
                report(
                    path,
                    `references "${ref}", a ${type} token, where a ${expected} is needed.`,
                );
            }
        }
    };

    const context: ValueContext = { report, checkRef };

    // The references in a recipe's params need only exist: a recipe decides
    // what type it wants.
    const checkParams = (value: unknown, path: string) => {
        if (isRef(value)) {
            if (!find(refPath(value))) {
                report(path, `references "${value}", which does not exist.`);
            }
        } else if (Array.isArray(value)) {
            value.forEach((item, index) =>
                checkParams(item, `${path}[${index}]`),
            );
        } else if (isObject(value)) {
            for (const key of Object.keys(value)) {
                checkParams(value[key], `${path}.${key}`);
            }
        }
    };

    const checkCall = (call: Node, path: string, expectGroup: boolean) => {
        const recipe =
            typeof call.$recipe === "string"
                ? registry.get(call.$recipe)
                : undefined;

        if (!recipe) {
            report(
                path,
                `$recipe ${JSON.stringify(call.$recipe)} is not a registered recipe.`,
            );

            return undefined;
        }

        if (expectGroup && !recipe.keys) {
            report(
                path,
                `recipe "${recipe.name}" is a value recipe: call it from the $value of a token, not from a group.`,
            );
        } else if (!expectGroup && recipe.keys) {
            report(
                path,
                `recipe "${recipe.name}" is a group recipe: call it from a group, not from the $value of a token.`,
            );
        }

        if ("$with" in call) {
            if (!isObject(call.$with)) {
                report(path, "$with must be an object.");
            } else {
                checkParams(call.$with, `${path}.$with`);
            }
        }

        return recipe;
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

    const metadataOf = (node: Node, keys: string[]): Node => {
        const result: Node = {};

        for (const key of keys) {
            if (node[key] !== undefined) {
                result[key] = node[key];
            }
        }

        return result;
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

        if (isRef(node.$value)) {
            checkCycle(path);
        }

        const type = typeOf(path);

        if (type === undefined) {
            if (!circular.has(here)) {
                report(
                    here,
                    `has no $type. A token takes its own $type, the type of the token it references, or the $type of the nearest group.`,
                );
            }

            return undefined;
        }

        if (!knownType(type)) {
            if (!(typeof node.$type === "string")) {
                report(
                    here,
                    `has the type ${JSON.stringify(type)}, which is not known.`,
                );
            }

            return undefined;
        }

        const value = node.$value;
        const where = `${here}.$value`;

        if (isObject(value) && "$recipe" in value) {
            const recipe = checkCall(value, where, false);

            for (const key of Object.keys(value)) {
                if (key !== "$recipe" && key !== "$with") {
                    report(
                        where,
                        `has an unsupported property "${key}". A recipe call accepts $recipe, $with.`,
                    );
                }
            }

            if (recipe && recipe.type !== type) {
                report(
                    here,
                    `calls recipe "${recipe.name}", which produces ${JSON.stringify(recipe.type)}, but the token's type is ${JSON.stringify(type)}.`,
                );
            }
        } else if (isRef(value)) {
            checkRef(value, type, where);

            const inherited = find(path)?.inherited;

            if (
                node.$type === undefined &&
                inherited !== undefined &&
                typeOf(refPath(value)) !== inherited
            ) {
                report(
                    where,
                    `references "${value}", but the token's group gives the $type ${JSON.stringify(inherited)}.`,
                );
            }
        } else if (isDTCGType(type)) {
            validateValue(type, value, where, context);
        }

        return {
            $type: type,
            $value: value,
            ...metadataOf(node, ["$description", "$extensions", "$deprecated"]),
        };
    };

    const convertGroup = (node: Node, path: string[]): Node => {
        const here = label(path);
        const result: Node = {};
        const isRecipeGroup = "$recipe" in node;
        const allowed = isRecipeGroup
            ? RECIPE_GROUP_PROPERTIES
            : GROUP_PROPERTIES;

        checkMetadata(node, here, "a group");

        if (isRecipeGroup) {
            checkCall(node, here, true);
        }

        for (const key of Object.keys(node)) {
            if (!isChildName(key)) {
                if (!allowed.includes(key)) {
                    report(
                        here,
                        `has an unsupported property "${key}". A group accepts ${allowed.join(", ")}.`,
                    );
                } else {
                    result[key] = node[key];
                }

                continue;
            }

            const child = node[key];
            const childPath = [...path, key];

            if (isRecipeGroup) {
                report(
                    here,
                    `calls the group recipe "${node.$recipe}", so it cannot also have a child "${key}".`,
                );
                continue;
            }

            if (key === "") {
                report(here, `has a child with an empty name.`);
                continue;
            }

            if (/[{}.]/.test(key)) {
                report(
                    label(childPath),
                    `is not a valid name. A name cannot contain ".", "{" or "}".`,
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

            if (isTokenNode(child)) {
                const token = convertToken(child, childPath);

                if (token) {
                    result[key] = token;
                }
            } else if (key === "$root") {
                report(
                    label(childPath),
                    `$root must be a token, so it needs a $value.`,
                );
            } else {
                result[key] = convertGroup(child, childPath);
            }
        }

        return result;
    };

    return convertGroup(doc, []);
};

/**
 * Reads a {@link https://www.designtokens.org/tr/2025.10/format/ | DTCG 2025.10}
 * document and returns the {@link (Library:namespace).Config} it describes,
 * without creating a library.
 *
 * @remarks
 * `$extends` and `$ref` are resolved, every token gets its resolved `$type`, and
 * every value is checked. Recipes (`$recipe`) are an extension to the format and
 * are passed through. A document with problems throws a {@link DTCGError} that
 * lists all of them.
 *
 * @param document - the document, as JSON text or already parsed
 *
 * @public
 */
export function parseDTCG(
    document: string | object,
    options: DTCGOptions = {},
): Library.Config<any> {
    const issues: DTCGIssue[] = [];
    const report: Report = (path, message) => issues.push({ path, message });
    let doc: unknown = document;

    if (typeof document === "string") {
        try {
            doc = JSON.parse(document);
        } catch (error) {
            throw new DTCGError([
                {
                    path: "",
                    message: `is not valid JSON: ${(error as Error).message}`,
                },
            ]);
        }
    }

    if (!isObject(doc)) {
        throw new DTCGError([
            { path: "", message: "must be a JSON object, the root group." },
        ]);
    }

    const registry = options.recipes ?? defaultRecipes;
    const customTypes = new Set([
        ...(options.types ?? []),
        ...registry.list().map((recipe) => recipe.type),
    ]);
    const config = convert(
        resolvePointers(resolveExtends(doc, report), report),
        registry,
        customTypes,
        report,
    );

    if (issues.length > 0) {
        throw new DTCGError(issues);
    }

    return config as Library.Config<any>;
}

/**
 * Creates a library from a
 * {@link https://www.designtokens.org/tr/2025.10/format/ | DTCG 2025.10}
 * document.
 *
 * @example
 * ```ts
 * const library = fromDTCG(await (await fetch("brand.tokens.json")).text());
 * library.tokens.color.brand.$value;
 * ```
 *
 * @remarks
 * See {@link parseDTCG} for what is read and checked.
 *
 * @param document - the document, as JSON text or already parsed
 *
 * @public
 */
export function fromDTCG<T extends {} = any>(
    document: string | object,
    options: DTCGOptions = {},
): Library.Library<T> {
    return Library.create(parseDTCG(document, options) as any, {
        recipes: options.recipes,
    }) as Library.Library<T>;
}
