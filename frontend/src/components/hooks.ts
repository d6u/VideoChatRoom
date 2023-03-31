import { useRef } from "react";

import Logger from "../utils/Logger";

export function useConst<T>(initializer: () => T): T {
  const ref = useRef<T | null>(null);
  if (ref.current == null) {
    ref.current = initializer();
  }
  return ref.current;
}

export function useLogger(label: string) {
  return useConst(() => new Logger(label));
}
