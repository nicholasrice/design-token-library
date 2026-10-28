# Groups

In alignment with the [DTCG Group](https://www.designtokens.org/tr/2025.10/format/#type-1) specification, token groups _may_ define a `$type` field. All tokens in the group infer their type from the group unless they define their own.

Type inheritance is checked at compile time. A token may omit `$type` only when its nearest ancestor group declares a single, literal `$type` in the library interface that matches the token's type:

```ts
interface Colors {
  $type: DesignToken.Type.Color;
  primary: DesignToken.Color;
  borders: {
    $type: DesignToken.Type.Border;
    thin: DesignToken.Border;
  };
}

const config: Library.Config<Colors> = {
  $type: DesignToken.Type.Color,
  primary: { $value: { colorSpace: "srgb", components: [1, 1, 1] } },
  borders: {
    $type: DesignToken.Type.Border,
    thin: {
      $value: {
        color: { colorSpace: "srgb", components: [0, 0, 0] },
        width: { value: 1, unit: "px" },
        style: "solid",
      },
    },
  },
};
```

A group declared with a non-literal `$type` (such as `DesignToken.Type`), a union, or an optional `$type` does not pass a type on, so its tokens must declare their own.
