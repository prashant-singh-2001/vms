import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { createCamera, updateCamera } from "../api/cameras";
import { ApiError } from "../api/client";
import type { Camera } from "../types/camera";

export function CameraFormModal({ camera, onClose }: { camera: Camera | null; onClose: () => void }) {
  const isEdit = Boolean(camera);
  const [name, setName] = useState(camera?.name ?? "");
  const [rtspUrl, setRtspUrl] = useState(camera?.rtspUrl ?? "");
  const [location, setLocation] = useState(camera?.location ?? "");
  const [enabled, setEnabled] = useState(camera?.enabled ?? true);
  const [error, setError] = useState<string | null>(null);

  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      const input = { name, rtspUrl, location: location || undefined, enabled };
      if (isEdit && camera) return updateCamera(camera.id, input);
      return createCamera(input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cameras"] });
      onClose();
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    },
  });

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{isEdit ? "Edit camera" : "Add camera"}</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            mutation.mutate();
          }}
        >
          <label>
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={128} />
          </label>
          <label>
            RTSP URL
            <input
              value={rtspUrl}
              onChange={(e) => setRtspUrl(e.target.value)}
              required
              placeholder="rtsp://host:port/stream"
            />
          </label>
          <label>
            Location
            <input value={location} onChange={(e) => setLocation(e.target.value)} maxLength={256} />
          </label>
          <label className="checkbox-label">
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
            Enabled
          </label>

          {error && <p className="form-error">{error}</p>}

          <div className="modal__actions">
            <button type="button" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" disabled={mutation.isPending}>
              {isEdit ? "Save" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
