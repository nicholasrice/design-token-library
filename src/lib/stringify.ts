import { configuredValueOf, type Library } from "./library.js";
import { isRef, pathOf } from "./ref.js";
import { isChildName, isObject, setOwn, type Node } from "./parse-document.js";
import { COMPUTED, RECIPE, isComputed } from "./recipe.js";
import { isStandardType } from "./parse-value.js";
import { isToken } from "./utilities.js";

/**
 * Options of {@link stringify} for the standard form.
 *
 * @public
 */
export interface StringifyStandardOptions {
    /**
     * The form to write: the default, `"standard"`, is the DTCG format, which
     * any tool can read.
     */
    readonly format?: "standard";

    /**
     * Return `false` to leave a token out of the document. The filter runs
     * before a token's value is read, so a token it leaves out is never
     * resolved. A group it empties is left out too.
     */
    readonly filter?: (token: Library.Token<any, any>) => boolean;

    /**
     * Writes the tokens of a custom type as a token of a standard type, keyed
     * by the custom type's name. It returns the `$type` and `$value` to write.
     * A converter also takes precedence over the format for a standard type.
     *
     * @remarks
     * A custom type, such as a `palette`, has no standard form, so a library
     * that has one can't be written until each such type is converted or its
     * tokens are filtered out.
     */
    readonly converters?: Readonly<
        Record<
            string,
            (
                value: any,
                token: Library.Token<any, any>,
            ) => { $type: string; $value: unknown }
        >
    >;
}

const GROUP_PROPERTIES = [
    "$type",
    "$description",
    "$extensions",
    "$deprecated",
];

const writeGroup = (group: Node, context: Context): Node => {
    const { options } = context;
    const result: Node = {};

    for (const key of GROUP_PROPERTIES) {
        if (group[key] !== undefined) {
            result[key] = structuredClone(group[key]);
        }
    }

    // Each token is written with its own type, so a group's type that the
    // format doesn't know can be left out without changing a token's type.
    if (
        context.format === "standard" &&
        typeof group.$type === "string" &&
        !isStandardType(group.$type)
    ) {
        delete result.$type;
    }

    for (const key of Object.keys(group)) {
        const child = group[key];

        if (!isChildName(key) || !isObject(child)) {
            continue;
        }

        if (isToken(child)) {
            if (options.filter?.(child as Library.Token<any, any>) === false) {
                continue;
            }

            setOwn(
                result,
                key,
                writeToken(child as Library.Token<any, any>, context),
            );
        } else {
            const written = writeGroup(child, context);

            // A group that filtering emptied is left out.
            if (Object.keys(written).some(isChildName)) {
                setOwn(result, key, written);
            }
        }
    }

    return result;
};

interface Context {
    readonly library: Library.Library<any, any>;
    readonly options: {
        readonly filter?: StringifyStandardOptions["filter"];
        readonly converters?: StringifyStandardOptions["converters"];
    };
    /**
     * The form being written.
     */
    readonly format: "standard" | "extended";
}

const tokenAt = (
    library: Library.Library<any, any>,
    path: readonly string[],
): Library.Token<any, any> | undefined => {
    let node: any = library.tokens;

    for (const key of path) {
        node =
            isObject(node) && Object.hasOwn(node, key) ? node[key] : undefined;
    }

    return isToken(node) ? (node as Library.Token<any, any>) : undefined;
};

const converterOf = (
    type: string,
    options: Context["options"],
): NonNullable<StringifyStandardOptions["converters"]>[string] | undefined =>
    options.converters && Object.hasOwn(options.converters, type)
        ? options.converters[type]
        : undefined;

/**
 * The reference that stands for a ref in the document, `"{color.blue}"`, or
 * `undefined` when its token isn't written as itself: it's left out by the
 * filter, or converted, so the document has no token of that name and type.
 */
const aliasOf = (
    ref: Library.Ref<unknown, never>,
    { library, options }: Context,
): string | undefined => {
    const path = pathOf(ref);
    const node = tokenAt(library, path);

    if (
        node === undefined ||
        options.filter?.(node) === false ||
        !isStandardType((node as { $type: string }).$type) ||
        converterOf((node as { $type: string }).$type, options)
    ) {
        return undefined;
    }

    return `{${path.join(".")}}`;
};

/**
 * A token's value as the document has it: a ref is the reference to its
 * token, which the format has, and a recipe's result is the value it
 * computed, which it doesn't. `resolved` is the value at the same place.
 */
const writeValue = (
    configured: unknown,
    resolved: unknown,
    context: Context,
): unknown => {
    if (isRef(configured)) {
        return aliasOf(configured, context) ?? structuredClone(resolved);
    }

    if (
        isComputed(configured) ||
        !isObject(configured) ||
        !isObject(resolved)
    ) {
        return structuredClone(resolved);
    }

    const result: any = Array.isArray(configured) ? [] : {};

    for (const key of Object.keys(configured)) {
        setOwn(
            result,
            key,
            writeValue(
                (configured as Node)[key],
                (resolved as Node)[key],
                context,
            ),
        );
    }

    return result;
};

const writeToken = (token: Library.Token<any, any>, context: Context): Node => {
    const type: string = token.$type;

    if (context.format === "extended") {
        return withMetadata(token, {
            $type: type,
            $value: extendedValue(configuredValueOf(token), token, context),
        });
    }

    const converter = converterOf(type, context.options);

    if (!converter && !isStandardType(type)) {
        throw new Error(
            `Token "${token.name}" has the custom type "${type}", which has no standard form. Give serialize() a converter for it, or filter it out.`,
        );
    }

    // A converter is given the value, and writes it as it chooses.
    const { $type, $value } = converter
        ? converter(token.$value, token)
        : {
              $type: type,
              $value: writeValue(
                  configuredValueOf(token),
                  token.$value,
                  context,
              ),
          };
    return withMetadata(token, { $type, $value: structuredClone($value) });
};

const withMetadata = (token: Library.Token<any, any>, result: Node): Node => {
    if (token.$description) {
        result.$description = token.$description;
    }

    if (Object.keys(token.$extensions).length > 0) {
        result.$extensions = structuredClone(token.$extensions);
    }

    if (token.$deprecated !== false) {
        result.$deprecated = token.$deprecated;
    }

    return result;
};

/**
 * Options of {@link stringify} for the extended form.
 *
 * @public
 */
export interface StringifyExtendedOptions {
    /**
     * The form to write: `"extended"` is this library's own, with its
     * extensions to the format, which only this library reads.
     */
    readonly format: "extended";

    /**
     * Return `false` to leave a token out of the document. The filter runs
     * before a token's value is read. A token that another token refers to
     * can't be left out, since the reference would have nothing to name.
     */
    readonly filter?: (token: Library.Token<any, any>) => boolean;
}

/**
 * Options of {@link stringify}.
 *
 * @public
 */
export type StringifyOptions =
    | StringifyStandardOptions
    | StringifyExtendedOptions;

/**
 * Writes a library as the text of a tokens document, which {@link (parse:1)} reads
 * again, indented by four spaces. A library that was extended is written whole.
 *
 * @remarks
 * There are two forms, by who reads the document.
 *
 * The `"standard"` form, the default, is a
 * {@link https://www.designtokens.org/tr/2025.10/format/ | DTCG 2025.10}
 * document that any tool that reads the format can read. A ref is written as the
 * format's reference to its token, `"{color.blue}"`, as a whole value or inside
 * one, so the document keeps its aliases. A recipe's result is written as the
 * value it computed, since the format has no recipes. A ref to a token the
 * document doesn't have as itself, because the filter leaves it out or a
 * converter writes it differently, is written as the value too. A custom type
 * has no standard form, so each needs a converter, or its tokens a filter.
 * Token and group metadata is kept.
 *
 * The `"extended"` form is this library's own, which `parse()` reads into the
 * same library when it's given the same `types` and `recipes`. A token's value
 * is written as it was configured, not as it evaluates: a ref is
 * `"{color.blue}"`, a recipe's call is a string such as
 * `"darken({color.blue}, 0.2)"`, and a custom type keeps its own `$type` and
 * value. Other tools don't know a recipe call or a custom type. A value that
 * JSON can't hold, such as a function or a class instance, is an error that
 * names the token, as is a ref to a token the filter leaves out.
 *
 * @public
 */
export const stringify = (
    library: Library.Library<any, any>,
    options: StringifyOptions = {},
): string =>
    JSON.stringify(
        writeGroup(library.tokens, {
            library,
            options,
            format: options.format ?? "standard",
        }),
        null,
        4,
    );

const isPlain = (value: unknown): value is Node => {
    if (!isObject(value) || Array.isArray(value)) {
        return false;
    }

    const prototype = Object.getPrototypeOf(value);

    return prototype === Object.prototype || prototype === null;
};

/**
 * A value as it's configured, written as the document has it. `token` is the
 * token being written, for the errors.
 */
const extendedValue = (
    value: unknown,
    token: Library.Token<any, any>,
    context: Context,
): unknown => {
    if (isRef(value)) {
        return referenceTo(value, token, context);
    }

    if (isComputed(value)) {
        return callOf(value, token, context);
    }

    if (Array.isArray(value)) {
        return value.map((item) => extendedValue(item, token, context));
    }

    if (isPlain(value)) {
        const result: Node = {};

        for (const key of Object.keys(value)) {
            setOwn(result, key, extendedValue(value[key], token, context));
        }

        return result;
    }

    return jsonValue(value, token);
};

const jsonValue = (value: unknown, token: Library.Token<any, any>): unknown => {
    if (
        value === null ||
        typeof value === "string" ||
        typeof value === "boolean" ||
        (typeof value === "number" && Number.isFinite(value))
    ) {
        return value;
    }

    throw new Error(
        `Token "${token.name}" has a value that a tokens document can't hold: ${String(value)}.`,
    );
};

const referenceTo = (
    ref: Library.Ref<unknown, never>,
    token: Library.Token<any, any>,
    { library, options }: Context,
): string => {
    const path = pathOf(ref);
    const target = tokenAt(library, path);

    if (target === undefined || options.filter?.(target) === false) {
        throw new Error(
            `Token "${token.name}" refers to "${path.join(".")}", which the document doesn't have.`,
        );
    }

    return `{${path.join(".")}}`;
};

const callOf = (
    computed: Library.Computed<unknown, never>,
    token: Library.Token<any, any>,
    context: Context,
): string => {
    const { recipe, args } = (computed as any)[COMPUTED] as {
        recipe: { [RECIPE]: { name: string } };
        args: unknown[];
    };

    return `${recipe[RECIPE].name}(${args.map((arg) => argumentText(arg, token, context)).join(", ")})`;
};

/**
 * An argument of a call, in the text of the call: a reference, a call, or JSON.
 */
const argumentText = (
    value: unknown,
    token: Library.Token<any, any>,
    context: Context,
): string => {
    if (isRef(value)) {
        return referenceTo(value, token, context);
    }

    if (isComputed(value)) {
        return callOf(value, token, context);
    }

    if (Array.isArray(value)) {
        return `[${value.map((item) => argumentText(item, token, context)).join(", ")}]`;
    }

    if (isPlain(value)) {
        return `{${Object.keys(value)
            .map(
                (key) =>
                    `${JSON.stringify(key)}: ${argumentText(value[key], token, context)}`,
            )
            .join(", ")}}`;
    }

    return JSON.stringify(jsonValue(value, token));
};
