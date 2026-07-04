#!/bin/sh
set -u

ASSET_DIR=/assets
SAMPLE="$ASSET_DIR/sample.mp4"
TARGET="${RTSP_TARGET:-rtsp://mediamtx:8554/test}"

# If the user mounted or docker-cp'd their own clip in, prefer it.
# Otherwise try to download one (best effort), otherwise fall back to a
# synthetically generated test pattern so this never hard-depends on the network.
if [ ! -f "$SAMPLE" ] && [ -n "${SAMPLE_VIDEO_URL:-}" ]; then
  echo "[rtsp-source] downloading sample video from $SAMPLE_VIDEO_URL"
  curl -fsSL -o "$SAMPLE.tmp" "$SAMPLE_VIDEO_URL" && mv "$SAMPLE.tmp" "$SAMPLE" \
    || { echo "[rtsp-source] download failed, will use synthetic pattern"; rm -f "$SAMPLE.tmp"; }
fi

# Give mediamtx a moment to start listening.
sleep 3

while true; do
  if [ -f "$SAMPLE" ]; then
    echo "[rtsp-source] looping $SAMPLE -> $TARGET"
    ffmpeg -nostdin -re -stream_loop -1 -i "$SAMPLE" \
      -c:v libx264 -preset veryfast -tune zerolatency -pix_fmt yuv420p -g 50 -an \
      -f rtsp -rtsp_transport tcp "$TARGET"
  else
    echo "[rtsp-source] no sample video available, publishing synthetic test pattern -> $TARGET"
    ffmpeg -nostdin -re \
      -f lavfi -i "testsrc2=size=1280x720:rate=25" \
      -c:v libx264 -preset veryfast -tune zerolatency -pix_fmt yuv420p -g 50 -an \
      -f rtsp -rtsp_transport tcp "$TARGET"
  fi
  echo "[rtsp-source] ffmpeg exited, retrying in 3s"
  sleep 3
done
