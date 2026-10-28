# Value semantics

A token's `$value` is a copy of the config entry with refs resolved; mutating the config after `Library.create` does not change the library.

Arrays and plain objects are deep-copied, including symbol-keyed and non-enumerable properties. Shared or cyclic object references become a single copy in the resolved value. Getters are read once and stored as data properties.

Any other value—class instances, `Date`, `Map`, functions—is returned as-is; the library does not call methods on it or search it for refs. Put refs in plain data structures.

When reading tokens, ref targets and plain data copies are frozen; mutating them throws. See [Recipes](./recipes) for how that applies to computed functions.
