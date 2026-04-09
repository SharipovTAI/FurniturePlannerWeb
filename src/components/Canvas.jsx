import React, { useState, useRef } from "react";

export default function Canvas({ objects, onAddObject, onUpdatePosition, onRemoveObject }) {
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [preview, setPreview] = useState(null);
  const [draggingObject, setDraggingObject] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const canvasRef = useRef(null);

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setIsDraggingOver(true);

    const data = e.dataTransfer.getData("application/json");
    if (data) {
      const item = JSON.parse(data);
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setPreview({ ...item, x, y });
    }
  };

  const handleDragLeave = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setIsDraggingOver(false);
      setPreview(null);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDraggingOver(false);
    setPreview(null);

    const data = e.dataTransfer.getData("application/json");
    if (data) {
      const item = JSON.parse(data);
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      onAddObject({ ...item, x, y });
    }
  };

  const handleMouseDown = (e, obj) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const offsetX = e.clientX - rect.left - obj.x;
    const offsetY = e.clientY - rect.top - obj.y;
    setDraggingObject(obj.id);
    setDragOffset({ x: offsetX, y: offsetY });
  };

  const handleMouseMove = (e) => {
    if (draggingObject) {
      const rect = canvasRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left - dragOffset.x;
      const y = e.clientY - rect.top - dragOffset.y;
      onUpdatePosition(draggingObject, x, y);
    }
  };

  const handleMouseUp = () => {
    setDraggingObject(null);
    setDragOffset({ x: 0, y: 0 });
  };

  return (
    <div
      ref={canvasRef}
      className={`canvas ${isDraggingOver ? 'dragging-over' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {objects.map((obj) => (
        <div
          key={obj.id}
          className="canvas-object"
          style={{
            position: 'absolute',
            left: obj.x - obj.width / 2,
            top: obj.y - obj.height / 2,
            width: obj.width,
            height: obj.height,
            backgroundColor: obj.color,
            border: '2px solid #333',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontSize: '12px',
            fontWeight: 'bold',
            cursor: draggingObject === obj.id ? 'grabbing' : 'grab',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
            zIndex: draggingObject === obj.id ? 10 : 1,
          }}
          onMouseDown={(e) => handleMouseDown(e, obj)}
          onDoubleClick={() => onRemoveObject(obj.id)}
        >
          {obj.name}
        </div>
      ))}
      {preview && (
        <div
          className="canvas-object preview"
          style={{
            position: 'absolute',
            left: preview.x - preview.width / 2,
            top: preview.y - preview.height / 2,
            width: preview.width,
            height: preview.height,
            backgroundColor: preview.color,
            border: '2px dashed #333',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontSize: '12px',
            fontWeight: 'bold',
            opacity: 0.7,
            pointerEvents: 'none',
          }}
        >
          {preview.name}
        </div>
      )}
    </div>
  );
}