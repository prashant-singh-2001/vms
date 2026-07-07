"""
Person detection via YOLOv8n (ultralytics). See docs/EVENT_FORMAT.md for the
exact response shape this must produce - boxes normalized to [0, 1].
"""

import os
from typing import List, Optional

import numpy as np
from PIL import Image, ImageDraw
from pydantic import BaseModel
from ultralytics import YOLO

CONFIDENCE_THRESHOLD = float(os.environ.get("CONFIDENCE_THRESHOLD", "0.5"))
YOLO_MODEL = os.environ.get("YOLO_MODEL", "yolov8n.pt")
PERSON_CLASS_ID = 0  # COCO class 0 = "person"


class Box(BaseModel):
    x: float
    y: float
    w: float
    h: float


class Detection(BaseModel):
    label: str
    confidence: float
    box: Box


class DetectResponse(BaseModel):
    detections: List[Detection]


_model: Optional[YOLO] = None


def load_model() -> YOLO:
    global _model
    if _model is None:
        _model = YOLO(YOLO_MODEL)
    return _model


def detect_persons(image: Image.Image) -> DetectResponse:
    model = load_model()
    width, height = image.size
    results = model.predict(
        source=np.array(image),
        classes=[PERSON_CLASS_ID],
        conf=CONFIDENCE_THRESHOLD,
        verbose=False,
    )

    detections: List[Detection] = []
    for result in results:
        boxes = result.boxes
        if boxes is None:
            continue
        for xyxy, conf in zip(boxes.xyxy.tolist(), boxes.conf.tolist()):
            x1, y1, x2, y2 = xyxy
            detections.append(
                Detection(
                    label="person",
                    confidence=float(conf),
                    box=Box(
                        x=max(0.0, x1 / width),
                        y=max(0.0, y1 / height),
                        w=min(1.0, (x2 - x1) / width),
                        h=min(1.0, (y2 - y1) / height),
                    ),
                )
            )
    return DetectResponse(detections=detections)


def annotate_detections(image: Image.Image, detections: DetectResponse) -> Image.Image:
    """Draw bounding boxes on the image."""
    image_copy = image.copy()
    draw = ImageDraw.Draw(image_copy)
    width, height = image.size

    for detection in detections.detections:
        box = detection.box
        x1 = int(box.x * width)
        y1 = int(box.y * height)
        x2 = int((box.x + box.w) * width)
        y2 = int((box.y + box.h) * height)

        draw.rectangle([x1, y1, x2, y2], outline="red", width=2)
        label = f"{detection.label} {detection.confidence:.2f}"
        draw.text((x1, y1 - 10), label, fill="red")

    return image_copy
