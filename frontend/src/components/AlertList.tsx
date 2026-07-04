import type { PersonDetectedEvent } from "../types/events";

export function AlertList({ alerts }: { alerts: PersonDetectedEvent[] }) {
  if (alerts.length === 0) {
    return <p className="alert-list__empty">No detections yet.</p>;
  }

  return (
    <ul className="alert-list">
      {alerts.map((alert) => (
        <li key={alert.id} className="alert-list__item">
          <span className="alert-list__icon" aria-hidden>
            🧍
          </span>
          <span>
            {alert.detections.length} person{alert.detections.length === 1 ? "" : "s"} ·{" "}
            {(alert.confidence * 100).toFixed(0)}%
          </span>
          <time dateTime={alert.timestamp}>{new Date(alert.timestamp).toLocaleTimeString()}</time>
        </li>
      ))}
    </ul>
  );
}
