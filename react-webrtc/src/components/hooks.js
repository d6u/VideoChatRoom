import { useRef } from "react";
import Logger from "../utils/Logger";

export function useConst(initializer) {
  const ref = useRef(null);
  if (ref.current == null) {
    ref.current = initializer();
  }
  return ref.current;
}

export function useLogger(label) {
  return useConst(() => new Logger(label));
}
