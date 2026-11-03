// What a consumer of the published package writes, compiled against the typings it gets: the package's own name resolves
// through `exports` to the file in `types`, and not to the sources. `npm run typings:check` compiles this with `strict` and
// without `skipLibCheck`, so a name in the typings that doesn't resolve, which would be an error for a consumer, is one here.
//
// A line with `@ts-expect-error` is one that has to be an error: if the typings stop reporting it, so does this check.
import { DesignToken, entriesOf, isRef, Library, ref, refs, toCSS } from "design-token-library";

type Tokens = {
    size: DesignToken.Number;
    group: {
        $type: DesignToken.Type.Number;
        inner: DesignToken.Number;
    };
};

const library = Library.create<Tokens>({
    size: { $type: DesignToken.Type.Number, $value: 1 },
    group: { $type: DesignToken.Type.Number, inner: { $value: 2 } },
});

// A ref of a group has the members of the group, and a ref of a token has the value of the token.
const $ = refs<Tokens>();
const inner = $.group.inner;
const byPath: Library.Ref<number, Library.TokenValues<Tokens>> = ref("size");

// A token takes a ref, and a library is extended with the type of its tokens.
const extended = library.extend({ size: { $value: inner } });
extended.tokens.size.set(3);
const value: number = extended.tokens.size.$value;

// A ref is told from any other object: it has a brand that a plain object doesn't.
declare const unknownValue: unknown;
if (isRef(unknownValue)) {
    const narrowed: Library.Ref<unknown, never> = unknownValue;
    void narrowed;
}
// @ts-expect-error a plain object isn't a ref
const notARef: Library.Ref<number, {}> = { path: ["size"] };

// @ts-expect-error a group has no member that it wasn't given
void $.group.missing;
// @ts-expect-error a token takes the value of its type
extended.tokens.size.set("one");

for (const entry of entriesOf(library)) {
    void entry.path;
}
void [byPath, value, notARef, toCSS(library)];
