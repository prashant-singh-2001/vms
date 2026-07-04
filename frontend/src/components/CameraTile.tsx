import { useEffect, useRef, useState } from "react";
import { startCamera, stopCamera } from "../api/cameras";
import type { Camera } from "../types/camera";
import type { CameraRuntimeState } from "../types/events";
import { negotiateWhep } from "../webrtc/whep";
import { useRealtime } from "../ws/RealtimeContext";
import { AlertList } from "./AlertList";

const STATE_LABEL: Record<CameraRuntimeState, string> = {
  connecting: "Connecting…",
  live: "Live",
  stopped: "Stopped",
  error: "Error",
};

export function CameraTile({ camera, onEdit, onDelete }: { camera: Camera; onEdit: () => void; onDelete: () => void }) {
  const { stateByCamera, statsByCamera, alertsByCamera } = useRealtime();
  const runtimeState = stateByCamera[camera.id] ?? camera.status;
  const stats = statsByCamera[camera.id];
  const alerts = alertsByCamera[camera.id] ?? [];

  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [actionPending, setActionPending] = useState(false);

  useEffect(() => {
    let cancelled = false;

    function teardown() {
      pcRef.current?.close();
      pcRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
    }

    if (runtimeState !== "live") {
      teardown();
      return;
    }

    if (pcRef.current || !videoRef.current) return;

    setStreamError(null);
    negotiateWhep(camera.id, videoRef.current)
      .then((pc) => {
        if (cancelled) {
          pc.close();
          return;
        }
        pcRef.current = pc;
      })
      .catch((err) => {
        if (!cancelled) setStreamError(err instanceof Error ? err.message : String(err));
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runtimeState, camera.id]);

  useEffect(() => {
    return () => {
      pcRef.current?.close();
    };
  }, []);

  async function handleToggle() {
    setActionPending(true);
    setStreamError(null);
    try {
      if (runtimeState === "live" || runtimeState === "connecting") {
        await stopCamera(camera.id);
      } else {
        await startCamera(camera.id);
      }
    } catch (err) {
      setStreamError(err instanceof Error ? err.message : String(err));
    } finally {
      setActionPending(false);
    }
  }

  const canToggle = camera.enabled || runtimeState !== "stopped";

  return (
    <article className={`camera-tile camera-tile--${runtimeState}`}>
      <header className="camera-tile__header">
        <div>
          <h3>{camera.name}</h3>
          {camera.location && <p className="camera-tile__location">{camera.location}</p>}
        </div>
        <span className={`state-badge state-badge--${runtimeState}`}>{STATE_LABEL[runtimeState]}</span>
      </header>

      <div className="camera-tile__video">
        {runtimeState === "live" ? (
          <video ref={videoRef} autoPlay playsInline muted />
        ) : (
          <div className="camera-tile__placeholder">{STATE_LABEL[runtimeState]}</div>
        )}
      </div>

      {streamError && <p className="camera-tile__error">{streamError}</p>}

      <div className="camera-tile__stats">
        <span>FPS: {stats ? stats.fps.toFixed(1) : "–"}</span>
        <span>Detections/min: {stats ? stats.detectionsPerMinute.toFixed(1) : "–"}</span>
      </div>

      <div className="camera-tile__alerts">
        <h4>Recent alerts</h4>
        <AlertList alerts={alerts} />
      </div>

      <footer className="camera-tile__actions">
        <button onClick={handleToggle} disabled={actionPending || !canToggle}>
          {runtimeState === "live" || runtimeState === "connecting" ? "Stop" : "Start"}
        </button>
        <button onClick={onEdit}>Edit</button>
        <button className="camera-tile__delete" onClick={onDelete}>
          Delete
        </button>
      </footer>
      {!camera.enabled && <p className="camera-tile__disabled-note">Camera is disabled</p>}
    </article>
  );
}
