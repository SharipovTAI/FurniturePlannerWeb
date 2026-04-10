import React from "react";

export default function Header() {
  return (
    <div className="header">
      <button>☰</button>
      <div>Название проекта</div>
      <div className="actions">
        <button>←</button>
        <button>→</button>
      </div>
      <button>⋯</button>
      <button>Войти</button>
      <button className="save">Сохранить</button>
    </div>
  );
}