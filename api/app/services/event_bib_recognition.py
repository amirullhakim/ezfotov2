from __future__ import annotations

import os
import re

from pathlib import Path

import cv2
import easyocr
import numpy as np

from ultralytics import YOLO


DEFAULT_MODEL_PATH = (
    Path(__file__)
    .resolve()
    .parents[1]
    / "ai_models"
    / "best.pt"
)


YOLO_CONFIDENCE = float(
    os.getenv(
        "EVENT_BIB_YOLO_CONFIDENCE",
        "0.40",
    )
)

OCR_MIN_CONFIDENCE = float(
    os.getenv(
        "EVENT_BIB_OCR_MIN_CONFIDENCE",
        "0.20",
    )
)

OCR_ALLOWLIST = (
    "0123456789"
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
)


_yolo_model: YOLO | None = None

_ocr_reader: easyocr.Reader | None = None


def _model_path() -> Path:
    configured = os.getenv(
        "EVENT_BIB_MODEL_PATH"
    )

    if configured:
        return (
            Path(configured)
            .expanduser()
            .resolve()
        )

    return DEFAULT_MODEL_PATH.resolve()


def get_yolo_model() -> YOLO:
    global _yolo_model

    if _yolo_model is not None:
        return _yolo_model

    path = _model_path()

    if not path.exists():
        raise RuntimeError(
            "Bib detection model was not found at "
            f"{path}."
        )

    _yolo_model = YOLO(
        str(path)
    )

    return _yolo_model


def get_ocr_reader() -> easyocr.Reader:
    global _ocr_reader

    if _ocr_reader is None:
        _ocr_reader = easyocr.Reader(
            ["en"],
            gpu=False,
        )

    return _ocr_reader


def normalize_bib_text(
    value: str,
) -> str:
    cleaned = (
        value
        .upper()
        .strip()
    )

    cleaned = re.sub(
        r"[^A-Z0-9]",
        "",
        cleaned,
    )

    return cleaned[:50]


def decode_image(
    image_bytes: bytes,
) -> np.ndarray:
    encoded = np.frombuffer(
        image_bytes,
        dtype=np.uint8,
    )

    image = cv2.imdecode(
        encoded,
        cv2.IMREAD_COLOR,
    )

    if image is None:
        raise RuntimeError(
            "Image could not be decoded for bib recognition."
        )

    return image


def preprocess_bib_crop(
    crop: np.ndarray,
) -> list[np.ndarray]:
    if crop.size == 0:
        return []

    gray = cv2.cvtColor(
        crop,
        cv2.COLOR_BGR2GRAY,
    )

    height, width = (
        gray.shape[:2]
    )

    target_width = max(
        width * 3,
        360,
    )

    scale = (
        target_width
        / max(
            width,
            1,
        )
    )

    resized = cv2.resize(
        gray,
        None,
        fx=scale,
        fy=scale,
        interpolation=
            cv2.INTER_CUBIC,
    )

    blurred = cv2.GaussianBlur(
        resized,
        (
            3,
            3,
        ),
        0,
    )

    _, otsu = cv2.threshold(
        blurred,
        0,
        255,
        (
            cv2.THRESH_BINARY
            + cv2.THRESH_OTSU
        ),
    )

    inverted = cv2.bitwise_not(
        otsu
    )

    return [
        resized,
        otsu,
        inverted,
    ]


def best_ocr_result(
    crop: np.ndarray,
) -> tuple[
    str | None,
    str | None,
    float | None,
]:
    reader = get_ocr_reader()

    best_raw: str | None = None
    best_normalized: str | None = None
    best_confidence = -1.0

    variants = preprocess_bib_crop(
        crop
    )

    for variant in variants:
        results = reader.readtext(
            variant,
            detail=1,
            paragraph=False,
            allowlist=
                OCR_ALLOWLIST,
        )

        for result in results:
            if len(result) < 3:
                continue

            raw_text = str(
                result[1]
            ).strip()

            confidence = float(
                result[2]
            )

            normalized = normalize_bib_text(
                raw_text
            )

            if not normalized:
                continue

            if confidence < OCR_MIN_CONFIDENCE:
                continue

            if confidence > best_confidence:
                best_raw = raw_text
                best_normalized = normalized
                best_confidence = confidence

    if (
        best_raw is None
        or best_normalized is None
    ):
        return (
            None,
            None,
            None,
        )

    return (
        best_raw,
        best_normalized,
        max(
            0.0,
            min(
                1.0,
                best_confidence,
            ),
        ),
    )


def recognize_bibs(
    image_bytes: bytes,
) -> list[dict]:
    image = decode_image(
        image_bytes
    )

    model = get_yolo_model()

    prediction = model.predict(
        source=image,
        conf=
            YOLO_CONFIDENCE,
        verbose=False,
        device="cpu",
    )

    detections: list[dict] = []

    if not prediction:
        return detections

    result = prediction[0]

    boxes = result.boxes

    if boxes is None:
        return detections

    height, width = (
        image.shape[:2]
    )

    coordinates = (
        boxes.xyxy
        .cpu()
        .tolist()
    )

    confidences = (
        boxes.conf
        .cpu()
        .tolist()
    )

    for (
        coordinates_item,
        detection_confidence,
    ) in zip(
        coordinates,
        confidences,
    ):
        x1, y1, x2, y2 = (
            coordinates_item
        )

        x1 = max(
            0,
            min(
                width - 1,
                int(
                    round(
                        x1
                    )
                ),
            ),
        )

        y1 = max(
            0,
            min(
                height - 1,
                int(
                    round(
                        y1
                    )
                ),
            ),
        )

        x2 = max(
            x1 + 1,
            min(
                width,
                int(
                    round(
                        x2
                    )
                ),
            ),
        )

        y2 = max(
            y1 + 1,
            min(
                height,
                int(
                    round(
                        y2
                    )
                ),
            ),
        )

        crop = image[
            y1:y2,
            x1:x2,
        ]

        (
            raw_text,
            bib_number,
            ocr_confidence,
        ) = best_ocr_result(
            crop
        )

        if not bib_number:
            continue

        detections.append(
            {
                "bib_number":
                    bib_number,

                "raw_text":
                    raw_text,

                "detection_confidence":
                    max(
                        0.0,
                        min(
                            1.0,
                            float(
                                detection_confidence
                            ),
                        ),
                    ),

                "ocr_confidence":
                    ocr_confidence,

                "bbox_x1":
                    x1,

                "bbox_y1":
                    y1,

                "bbox_x2":
                    x2,

                "bbox_y2":
                    y2,
            }
        )

    return detections