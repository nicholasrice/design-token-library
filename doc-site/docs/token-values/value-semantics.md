# Value semantics

A token's `$value` is a copy of the config entry with refs resolved; mutating the config after `Library.create` does not change the library.

Arrays and plain objects are deep-copied, including symbol-keyed and non-enumerable properties. Shared or cyclic object references become a single copy in the resolved value. Getters are read once and stored as data properties.

Any other value—class instances, `Date`, `Map`, functions—is returned as-is; the library does not call methods on it or search it for refs. Put refs in plain data structures.

When reading tokens, ref targets and plain data copies are frozen; mutating them throws. See [Recipes](./recipes) for how that applies to computed functions.

## Equal values

A library with a subscriber keeps a token's value when the token resolves again to an equal one, so an unchanged value is the same object, and a consumer can compare values with `===`. Each DTCG type is compared by its parts: a dimension or a duration by its number and unit, so `0px` isn't `0rem`, a color by its color space, components and alpha but not its `hex` fallback, and arrays in order. An optional part, such as a color's `alpha` or a shadow's `inset`, is compared as it is written: a missing `alpha` isn't equal to `alpha: 1`. A [custom type](../advanced/custom-types#registering-a-type) is compared by its `isEqual`.

A library without a subscriber keeps no previous values, so each time a token resolves its value is a new object.
