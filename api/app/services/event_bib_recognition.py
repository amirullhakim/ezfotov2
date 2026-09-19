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


# --------------------------------------------------
# MODELS
# --------------------------------------------------


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


# --------------------------------------------------
# BIB NORMALIZATION
# --------------------------------------------------


def clean_ocr_text(
    value: str,
) -> str:
    """
    Keep only uppercase letters and digits.
    """

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


def normalize_numeric_confusions(
    value: str,
) -> str:
    """
    Correct conservative OCR mistakes.

    Examples:
        O7  -> 07
        O23 -> 023

    We only turn O into zero when the candidate
    otherwise looks numeric. We do NOT turn:

        M90038 -> M90038

    into something else.
    """

    if not value:
        return value

    if re.fullmatch(
        r"[O0-9]+",
        value,
    ):
        return value.replace(
            "O",
            "0",
        )

    return value


def is_valid_bib_candidate(
    value: str,
) -> bool:
    """
    Apply practical bib-number filtering.

    Valid examples:
        07
        564
        1024
        A1024
        M90038
        HM204

    Rejected examples:
        B
        V
        M
        PHOTO
        RACE
    """

    if not value:
        return False

    # Isolated OCR characters are normally
    # logos, shirt graphics or noise.
    if len(value) < 2:
        return False

    # Keep bibs within a practical range.
    if len(value) > 16:
        return False

    # Most useful bib identifiers must contain
    # at least one actual digit.
    if not any(
        character.isdigit()
        for character in value
    ):
        return False

    # Only alphanumeric identifiers.
    if not value.isalnum():
        return False

    return True


def normalize_bib_text(
    value: str,
) -> str | None:
    cleaned = clean_ocr_text(
        value
    )

    cleaned = (
        normalize_numeric_confusions(
            cleaned
        )
    )

    if not is_valid_bib_candidate(
        cleaned
    ):
        return None

    return cleaned


# --------------------------------------------------
# IMAGE
# --------------------------------------------------


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


# --------------------------------------------------
# BIB CROP PREPROCESSING
# --------------------------------------------------


def preprocess_bib_crop(
    crop: np.ndarray,
) -> list[np.ndarray]:
    if crop.size == 0:
        return []

    gray = cv2.cvtColor(
        crop,
        cv2.COLOR_BGR2GRAY,
    )

    _, width = (
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

    # Slight contrast normalization.
    equalized = cv2.equalizeHist(
        resized
    )

    blurred = cv2.GaussianBlur(
        equalized,
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

    adaptive = cv2.adaptiveThreshold(
        blurred,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        31,
        9,
    )

    return [
        resized,
        equalized,
        otsu,
        inverted,
        adaptive,
    ]


# --------------------------------------------------
# OCR
# --------------------------------------------------


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

            if (
                confidence
                < OCR_MIN_CONFIDENCE
            ):
                continue

            normalized = (
                normalize_bib_text(
                    raw_text
                )
            )

            if not normalized:
                continue

            if (
                confidence
                > best_confidence
            ):
                best_raw = (
                    raw_text
                )

                best_normalized = (
                    normalized
                )

                best_confidence = (
                    confidence
                )

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


# --------------------------------------------------
# YOLO + OCR
# --------------------------------------------------


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

    if not prediction:
        return []

    result = prediction[0]

    boxes = result.boxes

    if boxes is None:
        return []

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

    detections: list[dict] = []


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


    # --------------------------------------------------
    # DEDUPLICATE
    # --------------------------------------------------
    #
    # If multiple boxes / preprocessing variants
    # produce the same bib, keep the strongest one.
    #

    best_by_bib: dict[
        str,
        dict,
    ] = {}


    for detection in detections:
        bib_number = detection[
            "bib_number"
        ]

        existing = (
            best_by_bib.get(
                bib_number
            )
        )

        if existing is None:
            best_by_bib[
                bib_number
            ] = detection

            continue


        existing_score = (
            float(
                existing[
                    "detection_confidence"
                ]
                or 0
            )
            *
            float(
                existing[
                    "ocr_confidence"
                ]
                or 0
            )
        )

        candidate_score = (
            float(
                detection[
                    "detection_confidence"
                ]
                or 0
            )
            *
            float(
                detection[
                    "ocr_confidence"
                ]
                or 0
            )
        )

        if (
            candidate_score
            > existing_score
        ):
            best_by_bib[
                bib_number
            ] = detection


    return list(
        best_by_bib.values()
    )