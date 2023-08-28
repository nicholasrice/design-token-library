export type DeepPartial<T> = T extends object
  ? {
      [P in keyof T]?: DeepPartial<T[P]>;
    }
  : T;

export type DeepRecord<T extends object, F> = {
  [K in keyof T]: T[K] extends object ? DeepRecord<T[K], F> : F;
};

export type DeepReadOnly<T extends object> = {
  readonly [K in keyof T]: T[K] extends object ? DeepReadOnly<T[K]> : T[K];
};
