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

// A custom type registers its equality, which gets the values of the type's tokens.
type Swatch = DesignToken.Custom<"swatch", { readonly base: number }>;
const swatchType: Library.TypeOptions<Library.ValueOfType<{ s: Swatch }, "swatch">> = {
    isEqual: (previous, next) => previous.base === next.base,
};
const options: Library.CreateOptions = { types: { swatch: swatchType } };
const swatches = Library.create<{ s: Swatch }>(
    { s: { $type: "swatch", $value: { base: 1 } } },
    { types: { swatch: swatchType } },
);
const names: Library.CustomTypeNamesOf<{ s: Swatch }> = "swatch";
// @ts-expect-error a custom type has to be registered
Library.create<{ s: Swatch }>({ s: { $type: "swatch", $value: { base: 1 } } });
// @ts-expect-error a DTCG type can't be registered
const reserved: Library.ExtendOptions & Library.ExtendArgs<{}, Tokens>[0] = { types: { color: swatchType } };

for (const entry of entriesOf(library)) {
    void entry.path;
}
void [byPath, value, notARef, toCSS(library), options, swatches, names, reserved];
