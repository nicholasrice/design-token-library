import {
    isChildName,
    isObject,
    isTokenNode,
    label,
    setOwn,
    type Node,
    type Report,
} from "./parse-document.js";

/**
 * The key of this library's extension in `$extensions`. A document written in
 * the DTCG form keeps there what DTCG can't express: a token's own `$type`
 * and `$value`, and a group's own `$type`.
 */
export const EXTENSION = "design-token-library";

/**
 * A token's `$type` and `$value` in the DTCG form of a document, which are
 * checked, while the token's own, in this library's extension, are read.
 */
export interface CompliantForm {
    readonly type: string | undefined;
    readonly value: unknown;
}

/**
 * Takes a token's or group's own properties from this library's extension,
 * in place of the ones of its DTCG form, and removes the extension. Records
 * the DTCG form of each token that has one, by path, so it's still checked.
 */
export const resolveExtension = (
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
