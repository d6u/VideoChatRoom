import { createContext } from "react";

class RouteManager {
  listeners = new Set();

  init() {
    // There isn't a cross browser compatible way to know when pushState is
    // called, thus, we need to invent one.
    window.history.pushState = new Proxy(window.history.pushState, {
      apply: (target, thisArg, argArray) => {
        const res = target.apply(thisArg, argArray);

        // This is for making sure window.location is up to date
        for (const listener of this.listeners) {
          listener();
        }

        return res;
      },
    });
  }

  addListener(listener) {
    this.listeners.add(listener);
  }

  removeListener(listener) {
    this.listeners.delete(listener);
  }
}

const routeManager = new RouteManager();
routeManager.init();

const RouterContext = createContext(routeManager);

export default RouterContext;
