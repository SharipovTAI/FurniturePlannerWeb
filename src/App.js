import Header from "./components/Header";
import Sidebar from "./components/Sidebar";
import Canvas from "./components/Canvas";
import Inspector from "./components/Inspector";
import ZoomControl from "./components/ZoomControl";

export default function App() {
  return (
    <div className="app">
      <Header />

      <div className="main">
        <Sidebar />
        <Canvas />
        <Inspector />
      </div>

      <ZoomControl />
    </div>
  );
}