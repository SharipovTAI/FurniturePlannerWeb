import React from "react";

export default function Sidebar() {
  return (
    <div className="sidebar">
      <h3>
        Меню
        <span style={{ fontSize: '14px', color: '#5f637a' }}>˅</span>
      </h3>

      <div className="grid">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="item"></div>
        ))}
      </div>
    </div>
  );
}