import io
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, File, HTTPException, UploadFile
from PIL import Image

from model import DetectResponse, detect_persons, load_model


@asynccontextmanager
async def lifespan(_app: FastAPI):
    load_model()  # warm up so the first real request isn't slow
    yield


app = FastAPI(title="vms-detector", lifespan=lifespan)


@app.get("/health")
def health() -> dict:
    return {"ok": True}


@app.post("/detect", response_model=DetectResponse)
async def detect(frame: UploadFile = File(...)) -> DetectResponse:
    raw = await frame.read()
    try:
        image = Image.open(io.BytesIO(raw)).convert("RGB")
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"invalid image: {exc}") from exc
    return detect_persons(image)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", "8000")))
