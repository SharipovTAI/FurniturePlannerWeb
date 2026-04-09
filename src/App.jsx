import { useState } from "react";
import Header from "./components/Header";
import Sidebar from "./components/Sidebar";
import Canvas from "./components/Canvas";
import Inspector from "./components/Inspector";
import ZoomControl from "./components/ZoomControl";

export default function App() {
  const [canvasObjects, setCanvasObjects] = useState([]);

  const addObjectToCanvas = (obj) => {
    setCanvasObjects(prev => [...prev, { ...obj, id: Date.now(), x: 50, y: 50 }]);
  };

  const updateObjectPosition = (id, x, y) => {
    setCanvasObjects(prev => prev.map(obj => 
      obj.id === id ? { ...obj, x, y } : obj
    ));
  };

  const removeObject = (id) => {
    setCanvasObjects(prev => prev.filter(obj => obj.id !== id));
  };

  return (
    <div className="app">
      <Header />

      <div className="main">
        <Sidebar />
        <Canvas 
          objects={canvasObjects} 
          onAddObject={addObjectToCanvas} 
          onUpdatePosition={updateObjectPosition}
          onRemoveObject={removeObject}
        />
        <Inspector />
      </div>

      <ZoomControl />
    </div>
  );
}