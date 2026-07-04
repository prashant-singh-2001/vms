import io
from pathlib import Path

import ultralytics
from fastapi.testclient import TestClient
from PIL import Image

from app import app

client = TestClient(app)


def _make_jpeg_bytes(color, size=(320, 240)) -> bytes:
    image = Image.new("RGB", size, color=color)
    buf = io.BytesIO()
    image.save(buf, format="JPEG")
    return buf.getvalue()


def test_health():
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json() == {"ok": True}


def test_detect_on_blank_image_returns_no_detections():
    jpeg_bytes = _make_jpeg_bytes((128, 128, 128))
    res = client.post("/detect", files={"frame": ("frame.jpg", jpeg_bytes, "image/jpeg")})
    assert res.status_code == 200
    assert res.json()["detections"] == []


def test_detect_rejects_invalid_image():
    res = client.post("/detect", files={"frame": ("frame.jpg", b"not-an-image", "image/jpeg")})
    assert res.status_code == 400


def test_detect_finds_people_in_bundled_sample():
    # ultralytics ships this sample (a bus with several pedestrians) with the
    # package itself, so this needs no network access and is a real detection.
    sample_path = Path(ultralytics.__file__).parent / "assets" / "bus.jpg"
    with open(sample_path, "rb") as f:
        res = client.post("/detect", files={"frame": ("bus.jpg", f.read(), "image/jpeg")})

    assert res.status_code == 200
    detections = res.json()["detections"]
    assert len(detections) >= 1
    for d in detections:
        assert d["label"] == "person"
        assert 0.0 <= d["box"]["x"] <= 1.0
        assert 0.0 <= d["box"]["y"] <= 1.0
        assert 0.0 <= d["box"]["w"] <= 1.0
        assert 0.0 <= d["box"]["h"] <= 1.0
