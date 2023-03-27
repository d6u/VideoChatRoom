import "./App.css";
import Router from "./Router";
import Root from "./routes/Root";
import Room from "./routes/room/Room";

export default function App() {
  return (
    <div className="App">
      <Router
        routeMap={[
          ["/", () => <Root />],
          ["/([a-zA-Z0-9_-]+)/?", (roomId) => <Room roomId={roomId} />],
          [null, () => <div>Path not found.</div>],
        ]}
      />
    </div>
  );
}
