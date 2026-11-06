/**
 * An expression in a tokens document, as written: a recipe call, a
 * reference to a token, or a JSON value that may hold them.
 *
 * @internal
 */
export type Expression =
    | {
          readonly kind: "call";
          readonly name: string;
          readonly args: Expression[];
      }
    | { readonly kind: "reference"; readonly path: string[] }
    | { readonly kind: "literal"; readonly value: unknown }
    | { readonly kind: "array"; readonly items: Expression[] }
    | {
          readonly kind: "object";
          readonly entries: [key: string, value: Expression][];
      };

const NAME = /[A-Za-z_$][\w$]*/y;
const NUMBER = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/y;
const STRING = /"(?:[^"\\\u0000-\u001f]|\\.)*"/y;
const KEYWORD = /(?:true|false|null)(?![\w$])/y;
const WHITESPACE = /\s*/y;

const CALL = /^\s*([A-Za-z_$][\w$]*)\s*\(/;

/**
 * The name of the recipe a string calls, when it's written as a call, like
 * `darken({color.blue}, 0.2)`.
 *
 * @internal
 */
export const calledName = (text: string): string | undefined =>
    CALL.exec(text)?.[1];

class ExpressionSyntaxError extends Error {}

/**
 * Parses a recipe call: `name(argument, ...)`, where an argument is a call,
 * a reference such as `{color.blue}`, or a JSON value, whose arrays and
 * objects may hold them. A string in it is always a JSON string, never a
 * reference.
 *
 * @returns the call, or a message that says what's wrong and where.
 *
 * @internal
 */
export const parseCall = (
    text: string,
): { call: Expression } | { error: string } => {
    let index = 0;

    const fail = (expected: string): never => {
        throw new ExpressionSyntaxError(
            `expected ${expected} at position ${index + 1} of "${text}".`,
        );
    };

    const skip = () => {
        WHITESPACE.lastIndex = index;
        WHITESPACE.exec(text);
        index = WHITESPACE.lastIndex;
    };

    const match = (pattern: RegExp): string | undefined => {
        pattern.lastIndex = index;
        const found = pattern.exec(text)?.[0];

        if (found !== undefined) {
            index = pattern.lastIndex;
        }

        return found;
    };

    const take = (character: string): boolean => {
        skip();

        if (text[index] === character) {
            index++;
            return true;
        }

        return false;
    };

    // Items up to `close`, separated by commas.
    const list = <T>(close: string, item: () => T): T[] => {
        const items: T[] = [];

        if (take(close)) {
            return items;
        }

        do {
            items.push(item());
        } while (take(","));

        if (!take(close)) {
            fail(`"," or "${close}"`);
        }

        return items;
    };

    const string = (): string => {
        const found = match(STRING) ?? fail("a string");

        try {
            return JSON.parse(found);
        } catch {
            return fail("a valid JSON string");
        }
    };

    const call = (): Expression => {
        skip();
        const name = match(NAME) ?? fail("a recipe name");

        if (!take("(")) {
            fail(`"(" after "${name}"`);
        }

        return { kind: "call", name, args: list(")", expression) };
    };

    const expression = (): Expression => {
        skip();
        const next = text[index];

        if (next === "{") {
            index++;
            skip();

            // An object's keys are strings, and a reference's path is not.
            if (text[index] === '"' || text[index] === "}") {
                return {
                    kind: "object",
                    entries: list("}", () => {
                        skip();
                        const key = string();

                        if (!take(":")) {
                            fail(`":" after "${key}"`);
                        }

                        return [key, expression()];
                    }),
                };
            }

            const end = text.indexOf("}", index);
            const path = text.slice(index, end);

            if (end === -1 || path.includes("{")) {
                fail(`"}" to end the reference`);
            }

            index = end + 1;
            return { kind: "reference", path: path.split(".") };
        }

        if (next === "[") {
            index++;
            return { kind: "array", items: list("]", expression) };
        }

        if (next === '"') {
            return { kind: "literal", value: string() };
        }

        const number = match(NUMBER);

        if (number !== undefined) {
            return { kind: "literal", value: Number(number) };
        }

        const keyword = match(KEYWORD);

        if (keyword !== undefined) {
            return { kind: "literal", value: JSON.parse(keyword) };
        }

        return call();
    };

    try {
        const parsed = call();
        skip();

        if (index < text.length) {
            fail("the end of the call");
        }

        return { call: parsed };
    } catch (error) {
        if (error instanceof ExpressionSyntaxError) {
            return { error: error.message };
        }

        throw error;
    }
};
