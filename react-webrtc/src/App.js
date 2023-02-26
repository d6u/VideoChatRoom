import "./App.css";
import Router from "./Router";
import Root from "./Root";
import Room from "./Room";

export default function App() {
  return (
    <div className="App">
      <Router
        routeMap={[
          ["/", () => <Root />],
          ["/([a-zA-Z0-9_-]+)/?", (roomKey) => <Room roomKey={roomKey} />],
          [null, () => <div>Path not found.</div>],
        ]}
      />
    </div>
  );
}
