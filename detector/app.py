import io
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, File, HTTPException, UploadFile, Query
from fastapi.responses import StreamingResponse
from PIL import Image

from model import DetectResponse, detect_persons, load_model, annotate_detections


@asynccontextmanager
async def lifespan(_app: FastAPI):
    load_model()  # warm up so the first real request isn't slow
    yield


app = FastAPI(title="vms-detector", lifespan=lifespan)


@app.get("/health")
def health() -> dict:
    return {"ok": True}


@app.post("/detect")
async def detect(frame: UploadFile = File(...), annotate: bool = Query(False)):
    raw = await frame.read()
    try:
        image = Image.open(io.BytesIO(raw)).convert("RGB")
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"invalid image: {exc}") from exc

    detections = detect_persons(image)

    if annotate:
        annotated_image = annotate_detections(image, detections)
        img_bytes = io.BytesIO()
        annotated_image.save(img_bytes, format="PNG")
        img_bytes.seek(0)
        return StreamingResponse(img_bytes, media_type="image/png")

    return detections


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", "8000")))
