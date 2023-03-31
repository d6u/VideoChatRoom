import { createContext } from "react";

class RouteManager {
  private listeners = new Set<() => void>();

  init() {
    // There isn't a cross browser compatible way to know when pushState is
    // called, thus, we need to invent one.
    window.history.pushState = new Proxy(window.history.pushState, {
      apply: (
        target,
        thisArg,
        argArray: [any, string, string | URL | null]
      ) => {
        const res = target.apply(thisArg, argArray);

        // This is for making sure window.location is up to date
        this.listeners.forEach((listener) => listener());

        return res;
      },
    });
  }

  addListener(listener: () => void) {
    this.listeners.add(listener);
  }

  removeListener(listener: () => void) {
    this.listeners.delete(listener);
  }
}

const routeManager = new RouteManager();
routeManager.init();

const RouterContext = createContext(routeManager);

export default RouterContext;
