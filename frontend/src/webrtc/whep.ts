import { API_URL, getToken } from "../api/client";

/**
 * Negotiates a WHEP (WebRTC-HTTP Egress Protocol) session: create a
 * recvonly offer, wait for ICE gathering to finish (non-trickle, matching
 * the worker's pion side), POST it to the api's WHEP proxy, and apply the
 * returned SDP answer. Resolves once the peer connection is set up; media
 * arrives asynchronously via the returned connection's ontrack handler.
 */
export async function negotiateWhep(cameraId: string, videoEl: HTMLVideoElement): Promise<RTCPeerConnection> {
  const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
  pc.addTransceiver("video", { direction: "recvonly" });

  pc.ontrack = (event) => {
    videoEl.srcObject = event.streams[0] ?? new MediaStream([event.track]);
  };

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  await waitForIceGatheringComplete(pc);

  const token = getToken();
  const res = await fetch(`${API_URL}/cameras/${cameraId}/whep`, {
    method: "POST",
    headers: {
      "Content-Type": "application/sdp",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: pc.localDescription!.sdp,
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    pc.close();
    throw new Error(`Stream negotiation failed (${res.status}): ${detail || res.statusText}`);
  }

  const answerSdp = await res.text();
  await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });
  return pc;
}

function waitForIceGatheringComplete(pc: RTCPeerConnection): Promise<void> {
  if (pc.iceGatheringState === "complete") return Promise.resolve();
  return new Promise((resolve) => {
    const check = () => {
      if (pc.iceGatheringState === "complete") {
        pc.removeEventListener("icegatheringstatechange", check);
        resolve();
      }
    };
    pc.addEventListener("icegatheringstatechange", check);
  });
}
