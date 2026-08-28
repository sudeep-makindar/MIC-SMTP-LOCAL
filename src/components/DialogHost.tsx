import { useEffect, useState, useSyncExternalStore } from "react";
import { subscribe, getCurrent, resolveCurrent } from "../lib/dialogStore";

export default function DialogHost() {
  const request = useSyncExternalStore(subscribe, getCurrent);
  const [value, setValue] = useState("");

  useEffect(() => {
    if (request?.kind === "prompt") setValue(request.defaultValue);
  }, [request]);

  if (!request) return null;

  if (request.kind === "confirm") {
    return (
      <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && resolveCurrent(false)}>
        <div className="modal-box dialog-box">
          <div className="modal-body">
            <h3 className="dialog-title">{request.title}</h3>
            <p className="dialog-message">{request.message}</p>
          </div>
          <div className="modal-footer">
            <button className="btn" onClick={() => resolveCurrent(false)}>
              {request.cancelLabel}
            </button>
            <button className={`btn ${request.danger ? "btn-danger" : "btn-primary"}`} onClick={() => resolveCurrent(true)} autoFocus>
              {request.confirmLabel}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => e.target === e.currentTarget && resolveCurrent(null)}
    >
      <div className="modal-box dialog-box">
        <div className="modal-body">
          <h3 className="dialog-title">{request.title}</h3>
          {request.message && <p className="dialog-message">{request.message}</p>}
          <input
            autoFocus
            value={value}
            placeholder={request.placeholder}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") resolveCurrent(value);
              if (e.key === "Escape") resolveCurrent(null);
            }}
            style={{ width: "100%", marginTop: 14 }}
          />
        </div>
        <div className="modal-footer">
          <button className="btn" onClick={() => resolveCurrent(null)}>
            {request.cancelLabel}
          </button>
          <button className="btn btn-primary" onClick={() => resolveCurrent(value)} disabled={!value.trim()}>
            {request.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
