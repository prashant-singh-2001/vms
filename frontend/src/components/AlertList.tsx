import type { PersonDetectedEvent } from "../types/events";
import { useState } from "react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

export function AlertList({ alerts }: { alerts: PersonDetectedEvent[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (alerts.length === 0) {
    return <p className="alert-list__empty">No detections yet.</p>;
  }

  return (
    <ul className="alert-list">
      {alerts.map((alert) => (
        <li key={alert.id} className="alert-list__item">
          <button
            onClick={() => setExpandedId(expandedId === alert.id ? null : alert.id)}
            className="alert-list__button"
            style={{ cursor: "pointer", background: "none", border: "none", width: "100%", textAlign: "left" }}
          >
            <span className="alert-list__icon" aria-hidden>
              🧍
            </span>
            <span>
              {alert.detections.length} person{alert.detections.length === 1 ? "" : "s"} ·{" "}
              {(alert.confidence * 100).toFixed(0)}%
            </span>
            <time dateTime={alert.timestamp}>{new Date(alert.timestamp).toLocaleTimeString()}</time>
          </button>

          {expandedId === alert.id && alert.annotatedImageId && (
            <div style={{ marginTop: "12px", padding: "8px", backgroundColor: "#f5f5f5", borderRadius: "4px" }}>
              <img
                src={`${API_URL}/alerts/images/${alert.annotatedImageId}`}
                alt="Annotated detection"
                style={{ maxWidth: "100%", height: "auto", borderRadius: "4px" }}
              />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
