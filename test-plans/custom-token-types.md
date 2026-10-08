# Test plan: custom token types

Covers `DesignToken.Custom<Name, Value>`, DTWG group-type inheritance with compile-time accuracy, and
custom-type CSS converters, for both created and extended libraries.

Type-level cases live in `src/test/custom-types.types.spec.ts` and are enforced by `tsc -b`
(`Equal`/`IsAny`/`IsUnknown` assertions and `@ts-expect-error` negatives). Runtime cases live in
`src/test/custom-types.spec.ts` (uvu).

## Type level

### Value and type resolution

| ID   | Scenario                                                                                                         | Expected                                                             |
| ---- | ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| T1.1 | `Custom<"elevation", Elevation>` with an object value                                                            | `tokens.x.value` is exactly `Elevation`                              |
| T1.2 | Primitive custom values (`number`, `string`, `boolean`)                                                          | `value` is exactly the primitive                                     |
| T1.3 | Tuple, array and nested-object custom values                                                                     | `value` is exactly the declared shape                                |
| T1.4 | `tokens.x.type`                                                                                                  | exactly the literal name (`"elevation"`)                             |
| T1.5 | Standard tokens alongside custom tokens                                                                          | standard `value`/`type` are unchanged                                |
| T1.6 | No `any`/`unknown` on: token `value`/`type`, context tokens, subscriber records, converter args, extended tokens | `IsAny`/`IsUnknown` are `false`                                      |
| T1.7 | Subscriber records                                                                                               | a union of the library's tokens; narrowing on `type` narrows `value` |

### Config values

| ID    | Scenario                                                                         | Expected                                      |
| ----- | -------------------------------------------------------------------------------- | --------------------------------------------- |
| T2.1  | Static custom value                                                              | accepted                                      |
| T2.2  | Alias returning a token whose value matches                                      | accepted                                      |
| T2.3  | Alias returning a raw value that matches                                         | accepted                                      |
| T2.4  | Deep alias in object fields, tuple elements and nested objects                   | accepted                                      |
| T2.5  | Deep alias to a standard token from inside a custom value                        | accepted                                      |
| T2.6  | Alias to another custom token (same and different custom type, compatible value) | accepted                                      |
| T2.7  | Gradient stop aliases (#28) and CubicBezier number aliases (#29)                 | accepted (side effect of value-typed aliases) |
| T2.8  | Wrong static value / wrong field type                                            | error                                         |
| T2.9  | Alias or deep alias resolving to an incompatible value                           | error                                         |
| T2.10 | `set()` with a wrong value                                                       | error                                         |

### Declaration constraints

| ID   | Scenario                                                    | Expected                                  |
| ---- | ----------------------------------------------------------- | ----------------------------------------- |
| T3.1 | Custom type named after a DTWG type (`"color"`, `"border"`) | error naming the reserved type            |
| T3.2 | Custom value containing a function (top-level or nested)    | error stating values must be serializable |
| T3.3 | Config `type` literal differs from the declared name        | error                                     |

### Group type inheritance (DTWG grouping)

| ID   | Scenario                                                                  | Expected                            |
| ---- | ------------------------------------------------------------------------- | ----------------------------------- |
| T4.1 | Token in a group whose required literal `type` matches                    | `type` may be omitted               |
| T4.2 | Same, inherited through nested groups                                     | `type` may be omitted               |
| T4.3 | Nested group overrides the ancestor type                                  | inner tokens inherit the inner type |
| T4.4 | Token in a group of a different type, no own `type`                       | error                               |
| T4.5 | Token with no ancestor group type and no own `type`                       | error                               |
| T4.6 | Group declared with a wide (`DesignToken.Type`), union or optional `type` | no inheritance; `type` required     |
| T4.7 | Group `type` in the config differs from the interface                     | error                               |
| T4.8 | Applies equally to standard tokens                                        | as above                            |

### Extended libraries

| ID   | Scenario                                                                        | Expected                           |
| ---- | ------------------------------------------------------------------------------- | ---------------------------------- |
| T5.1 | Override a custom token with a static, alias or deep-alias value                | accepted; values typed             |
| T5.2 | Override with an incompatible value                                             | error                              |
| T5.3 | Add a new custom token with a `type`                                            | accepted; exposed with exact types |
| T5.4 | Add a new custom token to an existing source group with a matching literal type | `type` may be omitted              |
| T5.5 | Add a new custom token to a source group of a different type, no own `type`     | error                              |
| T5.6 | Extended token values/types and subscriber records                              | exact types, no `any`/`unknown`    |

### CSS

| ID   | Scenario                                                  | Expected                                    |
| ---- | --------------------------------------------------------- | ------------------------------------------- |
| T6.1 | `toCSS` on a library with no custom tokens                | no converters argument accepted or required |
| T6.2 | `toCSS` on a library with custom tokens                   | a converter per custom type is required     |
| T6.3 | Missing converter for one custom type                     | error                                       |
| T6.4 | Converter for a type not in the library                   | error                                       |
| T6.5 | Converter argument type                                   | exactly that custom type's value            |
| T6.6 | Extended library adding a new custom type                 | its converter is required                   |
| T6.7 | `toProperties` with custom tokens and custom-typed groups | compiles; group `type` is the literal       |

## Runtime

| ID   | Scenario                                                                            | Expected                                                     |
| ---- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| R1.1 | Create with a static custom value                                                   | `value`, `type`, `name`, `description`, `extensions` correct |
| R1.2 | Primitive, tuple and nested-object custom values                                    | resolved values deep-equal config                            |
| R2.1 | Whole-value alias to another custom token                                           | resolves to the target's value                               |
| R2.2 | Deep aliases in object fields, tuple elements and nested objects                    | each alias resolved                                          |
| R2.3 | Deep alias to a standard token                                                      | resolves                                                     |
| R2.4 | Custom value with a `value` key (static, nested, and returned from an alias)        | kept as data, not unwrapped as a token                       |
| R3.1 | Custom token inherits a custom group type                                           | `type` is the group's                                        |
| R3.2 | Inheritance through nested groups; inner group override                             | nearest ancestor wins                                        |
| R3.3 | Custom group exposes its `type`                                                     | non-enumerable, equals the declared name                     |
| R3.4 | Custom token with no type and no ancestor type                                      | throws, naming the token                                     |
| R4.1 | `set()` with a static value and with an alias                                       | value updates; subscribers notified                          |
| R4.2 | Dependents of a custom token recompute and notify after `set()`                     | updated values; notified                                     |
| R4.3 | Custom token deep-aliasing a standard token updates when the standard token changes | updated; notified                                            |
| R5.1 | Extended library inherits a custom token and tracks source changes                  | reflects source                                              |
| R5.2 | Override a custom token (static, alias, deep alias)                                 | override wins; source unchanged                              |
| R5.3 | New custom token; new custom token inheriting a source custom group's type          | created with the correct type                                |
| R5.4 | Inherited custom aliases resolve against the extending library's overrides          | resolves to the override                                     |
| R6.1 | `toCSS` uses the custom converter, with aliases already resolved                    | converter output emitted                                     |
| R6.2 | `toCSS` standard tokens unaffected when converters are passed                       | unchanged output                                             |
| R6.3 | `toCSS` with a custom token and no matching converter (e.g. untyped JS caller)      | throws, naming the type and token                            |
| R6.4 | `toCSS` on an extended library with a new custom type                               | uses its converter                                           |
| R6.5 | `toProperties` with custom tokens                                                   | properties generated                                         |

## Out of scope (tracked separately)

- Circular/self-referential custom aliases: #21.
- Deeply readonly values: #24.
- Type changes in `extend` overrides: #16.
- `toCSS` dropping tokens before nested groups: #10 (CSS cases avoid nested groups).
