import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import type { z } from "zod";
import { getStore } from "./components/store-registry";
import { isDeepEqual } from "@bb-labs/deep-equal";

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

export const validateWithSchema = <T>(schema: z.ZodSchema<T>, val: T | null): boolean => {
  return val === null ? true : schema.safeParse(val).success;
};

export function useLocalDb<T>({ key, schema, initialValue = null, dbName, storeName }: T_UseLocalDb<T>): UseLocalDbReturn<T> {
  const initialRef = useRef<T | null>(initialValue);
  const ns = useMemo(() => ({ dbName, storeName }), [dbName, storeName]);

  const isValid = useCallback((val: T | null) => validateWithSchema(schema, val), [schema]);
  const isEqual = isDeepEqual;

  const store = useMemo(() => getStore<T>(key, initialRef.current, isValid, isEqual, ns), [key, isValid, isEqual, ns]);

  const subscribe = useCallback(
    (listener: () => void) => {
      store.listeners.add(listener);
      return () => store.listeners.delete(listener);
    },
    [store]
  );

  const getSnapshot = useCallback(() => store.value, [store]);

  const value = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

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
