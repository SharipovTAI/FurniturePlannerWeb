export default function Inspector() {
  return (
    <div className="inspector">
      <div className="inspector-header">
        <h3>Название объекта</h3>
        <div className="preview-box" />
      </div>

      <div className="inspect-grid">
        <div className="row">
          <div className="field">
            <label>X:</label>
            <input type="text" />
          </div>
          <div className="field">
            <label>Y:</label>
            <input type="text" />
          </div>
          <div className="field">
            <label>Z:</label>
            <input type="text" />
          </div>
        </div>

        <div className="row">
          <div className="field">
            <label>Ширина:</label>
            <input type="text" />
          </div>
          <div className="field">
            <label>Длина:</label>
            <input type="text" />
          </div>
          <div className="field">
            <label>Высота:</label>
            <input type="text" />
          </div>
        </div>
      </div>

      <div className="buttons">
        <button>👁</button>
        <button>🔒</button>
        <button>🗑</button>
      </div>
    </div>
  );
}