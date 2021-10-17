import { useEffect, useState } from "react";

const identity: <T>(arg: T) => T = (x) => x;

export function useLocalStorage<T, StoredT = T>(
  key: string,
  initialValue: T,
  options?: {
    /**
     * Sometimes you don't want to store everything in local storage,
     * provide a set of keys for the incoming object that you'd like to keep out
     * of local storage.
     */
    transform?: {
      get: (itemFromStorage: StoredT) => T;
      put: (item: T) => StoredT;
    };
    /**
     * Sometimes you don't actually want to persist. This flag let's you dynamically
     * disable/enable storing in localstorage
     */
    disabled?: boolean;
  }
) {
  const tranformGet = options?.transform?.get ?? identity;
  const tranformPut = options?.transform?.put ?? identity;
  /*
   * State to store our value
   * Pass initial state function to useState so logic is only executed once
   */
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (options?.disabled) {
      return initialValue;
    }
    try {
      // Get from local storage by key
      const item = window.localStorage.getItem(key);
      // Parse stored json or if none return initialValue
      return item ? tranformGet(JSON.parse(item)) : initialValue;
    } catch (error) {
      // If error also return initialValue
      return initialValue;
    }
  });

  useEffect(() => {
    if (options?.disabled) {
      return;
    }
    try {
      window.localStorage.setItem(
        key,
        JSON.stringify(tranformPut(storedValue))
      );
    } catch (error) {
      /*
       * A more advanced implementation would handle the error case
       * console.error(error);
       */
    }
  }, [storedValue, key, options?.disabled]);

  return [storedValue, setStoredValue] as const;
}

export function useDebounce<T>(value: T, delay: number) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value]);

  return debouncedValue;
}
