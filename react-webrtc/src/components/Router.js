import { useContext, useEffect, useState } from "react";
import RouterContext from "./routeManager";

export default function Router(props) {
  const [path, setPath] = useState(window.location.pathname);
  const routeManager = useContext(RouterContext);

  useEffect(() => {
    const listener = () => {
      setPath(window.location.pathname);
    };

    window.addEventListener("popstate", listener);
    routeManager.addListener(listener);

    return () => {
      window.removeEventListener("popstate", listener);
      routeManager.removeListener(listener);
    };
  }, [routeManager]);

  for (let i = 0; i < props.routeMap.length - 1; i++) {
    const [pattern, route] = props.routeMap[i];
    const regex = new RegExp(`^${pattern}$`);
    const data = regex.exec(path);
    if (data != null) {
      return route.apply(null, data.slice(1));
    }
  }

  return props.routeMap[props.routeMap.length - 1][1]();
}
