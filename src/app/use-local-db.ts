import deepEqual from "fast-deep-equal";
import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import type { z } from "zod";
import { getStore } from "./components/store-registry";

export type T_UseLocalDb<T> = {
  key: string;
  schema: z.ZodSchema<T>;
  initialValue?: T | null;
  /** Optional: choose a specific IndexedDB database & object store */
  dbName?: string;
  storeName?: string;
};

export type UseLocalDbReturn<T> = {
  value: T | null | undefined;
  setValue: (next: T | null) => void;
};

export const defaultIsEqual = <T>(a: T | null | undefined, b: T | null | undefined): boolean => {
  if (a === b) return true; // primitives, same ref, null/undefined
  if (!a || !b) return false; // one side is null/undefined
  if (typeof a !== "object" || typeof b !== "object") return false;
  return deepEqual(a, b); // deep structural compare (fast-deep-equal)
};

export const validateWithSchema = <T>(schema: z.ZodSchema<T>, val: T | null): boolean => {
  return val === null ? true : schema.safeParse(val).success;
};

export function useLocalDb<T>({ key, schema, initialValue = null, dbName, storeName }: T_UseLocalDb<T>): UseLocalDbReturn<T> {
  const initialRef = useRef<T | null>(initialValue);
  const ns = useMemo(() => ({ dbName, storeName }), [dbName, storeName]);

  const isValid = useCallback((val: T | null) => validateWithSchema(schema, val), [schema]);
  const isEqual = defaultIsEqual<T>;

  const store = useMemo(() => getStore<T>(key, initialRef.current, isValid, isEqual, ns), [key, isValid, isEqual, ns]);

  const value = useSyncExternalStore(
    (listener) => {
      store.listeners.add(listener);
      return () => store.listeners.delete(listener);
    },
    () => store.value,
    () => store.value
  ) as T | null | undefined;

  const setValue = useCallback(
    (next: T | null) => {
      if (store.isEqual(value, next)) return;

      const safe = isValid(next) ? next : (store.repairTo as T | null);
      store.setValue(safe);
    },
    [store, value, isValid]
  );

  useEffect(() => {
    store.hydrate();
  }, [store]);

  return { value, setValue };
}
