import React from "react";

const furnitureItems = [
  { id: 1, type: "table", name: "Стол", width: 100, height: 60, color: "#8B4513" },
  { id: 2, type: "chair", name: "Стул", width: 50, height: 50, color: "#654321" },
  { id: 3, type: "sofa", name: "Диван", width: 150, height: 80, color: "#4169E1" },
  { id: 4, type: "cabinet", name: "Шкаф", width: 80, height: 120, color: "#8B4513" },
  { id: 5, type: "bed", name: "Кровать", width: 160, height: 100, color: "#FF6347" },
  { id: 6, type: "lamp", name: "Лампа", width: 30, height: 60, color: "#FFD700" },
];

export default function Sidebar() {
  const handleDragStart = (e, item) => {
    e.dataTransfer.setData("application/json", JSON.stringify(item));
    
    // Создаем custom drag image с реальным размером объекта
    const ghost = document.createElement('div');
    ghost.style.width = `${item.width}px`;
    ghost.style.height = `${item.height}px`;
    ghost.style.backgroundColor = item.color;
    ghost.style.border = '2px solid #333';
    ghost.style.borderRadius = '4px';
    ghost.style.display = 'flex';
    ghost.style.alignItems = 'center';
    ghost.style.justifyContent = 'center';
    ghost.style.color = 'white';
    ghost.style.fontSize = '12px';
    ghost.style.fontWeight = 'bold';
    ghost.style.position = 'absolute';
    ghost.style.top = '-1000px'; // скрываем off-screen
    ghost.textContent = item.name;
    document.body.appendChild(ghost);

    e.dataTransfer.setDragImage(ghost, item.width / 2, item.height / 2);
    e.dataTransfer.effectAllowed = "copy";

    // Удаляем ghost после drag
    setTimeout(() => document.body.removeChild(ghost), 0);
  };

  return (
    <div className="sidebar">
      <h3>
        Меню
        <span style={{ fontSize: '14px', color: '#5f637a' }}>˅</span>
      </h3>

      <div className="grid">
        {furnitureItems.map((item) => (
          <div
            key={item.id}
            className="item"
            draggable
            onDragStart={(e) => handleDragStart(e, item)}
            style={{
              backgroundColor: item.color,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: '12px',
              fontWeight: 'bold',
              cursor: 'grab'
            }}
          >
            {item.name}
          </div>
        ))}
      </div>
    </div>
  );
}