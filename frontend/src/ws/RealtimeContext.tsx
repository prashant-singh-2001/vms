import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "../auth/AuthContext";
import type { CameraRuntimeState, PersonDetectedEvent, StatsPayload, WsMessage } from "../types/events";

const WS_URL = import.meta.env.VITE_WS_URL;
const MAX_ALERTS_PER_CAMERA = 25;

export type ConnectionStatus = "connecting" | "open" | "closed";

interface RealtimeValue {
  connectionStatus: ConnectionStatus;
  alertsByCamera: Record<string, PersonDetectedEvent[]>;
  statsByCamera: Record<string, StatsPayload>;
  stateByCamera: Record<string, CameraRuntimeState>;
}

const RealtimeContext = createContext<RealtimeValue | undefined>(undefined);

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { token, isAuthenticated } = useAuth();
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("connecting");
  const [alertsByCamera, setAlertsByCamera] = useState<Record<string, PersonDetectedEvent[]>>({});
  const [statsByCamera, setStatsByCamera] = useState<Record<string, StatsPayload>>({});
  const [stateByCamera, setStateByCamera] = useState<Record<string, CameraRuntimeState>>({});
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !token) return;

    let cancelled = false;
    let retryDelay = 1000;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    const connect = () => {
      if (cancelled) return;
      setConnectionStatus("connecting");
      const ws = new WebSocket(`${WS_URL}/ws?token=${encodeURIComponent(token)}`);
      wsRef.current = ws;

      ws.onopen = () => {
        retryDelay = 1000;
        setConnectionStatus("open");
      };

      ws.onmessage = (event) => {
        let msg: WsMessage;
        try {
          msg = JSON.parse(event.data);
        } catch {
          return;
        }

        if (msg.type === "alert") {
          const cameraId = msg.data.cameraId;
          setAlertsByCamera((prev) => {
            const existing = prev[cameraId] ?? [];
            return { ...prev, [cameraId]: [msg.data, ...existing].slice(0, MAX_ALERTS_PER_CAMERA) };
          });
        } else if (msg.type === "stats") {
          setStatsByCamera((prev) => ({ ...prev, [msg.data.cameraId]: msg.data }));
        } else if (msg.type === "camera_state") {
          setStateByCamera((prev) => ({ ...prev, [msg.data.cameraId]: msg.data.state }));
        }
      };

      ws.onclose = () => {
        setConnectionStatus("closed");
        if (cancelled) return;
        retryTimer = setTimeout(connect, retryDelay);
        retryDelay = Math.min(retryDelay * 2, 15000);
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    connect();

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      wsRef.current?.close();
    };
  }, [isAuthenticated, token]);

  const value = useMemo<RealtimeValue>(
    () => ({ connectionStatus, alertsByCamera, statsByCamera, stateByCamera }),
    [connectionStatus, alertsByCamera, statsByCamera, stateByCamera],
  );

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export function useRealtime(): RealtimeValue {
  const ctx = useContext(RealtimeContext);
  if (!ctx) throw new Error("useRealtime must be used within a RealtimeProvider");
  return ctx;
}
