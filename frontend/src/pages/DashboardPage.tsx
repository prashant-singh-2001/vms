import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { deleteCamera, listCameras } from "../api/cameras";
import { useAuth } from "../auth/AuthContext";
import { CameraFormModal } from "../components/CameraFormModal";
import { CameraTile } from "../components/CameraTile";
import type { Camera } from "../types/camera";
import { useRealtime } from "../ws/RealtimeContext";

export function DashboardPage() {
  const { username, logout } = useAuth();
  const { connectionStatus } = useRealtime();
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ["cameras"], queryFn: listCameras });

  const [modalOpen, setModalOpen] = useState(false);
  const [editingCamera, setEditingCamera] = useState<Camera | null>(null);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteCamera(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["cameras"] }),
  });

  function openCreate() {
    setEditingCamera(null);
    setModalOpen(true);
  }

  function openEdit(camera: Camera) {
    setEditingCamera(camera);
    setModalOpen(true);
  }

  return (
    <div className="dashboard">
      <header className="dashboard__header">
        <h1>Camera Dashboard</h1>
        <div className="dashboard__header-actions">
          <span className={`ws-badge ws-badge--${connectionStatus}`}>Realtime: {connectionStatus}</span>
          <span className="dashboard__username">{username}</span>
          <button onClick={openCreate}>+ Add camera</button>
          <button onClick={logout}>Log out</button>
        </div>
      </header>

      {isLoading && <p>Loading cameras…</p>}
      {error && <p className="error">{(error as Error).message}</p>}

      {data && data.cameras.length === 0 && (
        <p className="dashboard__empty">No cameras yet. Add one to get started.</p>
      )}

      <div className="camera-grid">
        {data?.cameras.map((camera) => (
          <CameraTile
            key={camera.id}
            camera={camera}
            onEdit={() => openEdit(camera)}
            onDelete={() => {
              if (confirm(`Delete camera "${camera.name}"?`)) deleteMutation.mutate(camera.id);
            }}
          />
        ))}
      </div>

      {modalOpen && <CameraFormModal camera={editingCamera} onClose={() => setModalOpen(false)} />}
    </div>
  );
}
