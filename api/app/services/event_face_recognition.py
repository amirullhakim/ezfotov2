from __future__ import annotations

import os

import cv2
import numpy as np

from deepface import DeepFace


FACE_MODEL_NAME = "ArcFace"

FACE_DETECTOR_BACKEND = os.getenv(
    "EVENT_FACE_DETECTOR_BACKEND",
    "retinaface",
)

FACE_MIN_CONFIDENCE = float(
    os.getenv(
        "EVENT_FACE_MIN_CONFIDENCE",
        "0.70",
    )
)

MAX_FACES_PER_PHOTO = int(
    os.getenv(
        "EVENT_MAX_FACES_PER_PHOTO",
        "30",
    )
)

EXPECTED_ARCFACE_DIMENSIONS = 512


# --------------------------------------------------
# IMAGE
# --------------------------------------------------


def decode_face_image(
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
            "Image could not be decoded for face recognition."
        )

    return image


# --------------------------------------------------
# MODEL
# --------------------------------------------------


def warm_up_arcface() -> None:
    """
    Load/download the ArcFace model ahead of
    processing so model setup errors happen
    before a production batch starts.
    """

    DeepFace.build_model(
        FACE_MODEL_NAME
    )


# --------------------------------------------------
# FACE EXTRACTION
# --------------------------------------------------


def recognize_faces(
    image_bytes: bytes,
) -> list[dict]:
    """
    Detect faces and generate ArcFace embeddings.

    One photograph may contain many runners,
    therefore multiple embeddings can be
    returned for a single EventPhoto.
    """

    image = decode_face_image(
        image_bytes
    )

    try:
        representations = (
            DeepFace.represent(
                img_path=image,
                model_name=
                    FACE_MODEL_NAME,
                detector_backend=
                    FACE_DETECTOR_BACKEND,
                enforce_detection=True,
                align=True,
                normalization="ArcFace",
            )
        )

    except ValueError:
        # No valid face detected.
        #
        # This is not considered a processing
        # failure because many event photographs
        # legitimately contain no usable face.
        return []

    except Exception as exc:
        raise RuntimeError(
            "ArcFace processing failed."
        ) from exc


    if isinstance(
        representations,
        dict,
    ):
        representations = [
            representations
        ]


    faces: list[dict] = []


    for representation in representations:
        embedding = representation.get(
            "embedding"
        )

        if not embedding:
            continue


        embedding_values = [
            float(value)
            for value in embedding
        ]


        if (
            len(
                embedding_values
            )
            != EXPECTED_ARCFACE_DIMENSIONS
        ):
            raise RuntimeError(
                "ArcFace returned an unexpected "
                f"embedding size of "
                f"{len(embedding_values)}."
            )


        facial_area = (
            representation.get(
                "facial_area"
            )
            or {}
        )


        x = int(
            facial_area.get(
                "x",
                0,
            )
            or 0
        )

        y = int(
            facial_area.get(
                "y",
                0,
            )
            or 0
        )

        width = int(
            facial_area.get(
                "w",
                0,
            )
            or 0
        )

        height = int(
            facial_area.get(
                "h",
                0,
            )
            or 0
        )


        if (
            width <= 0
            or height <= 0
        ):
            continue


        raw_confidence = (
            representation.get(
                "face_confidence"
            )
        )


        confidence: float | None

        if raw_confidence is None:
            confidence = None

        else:
            confidence = max(
                0.0,
                min(
                    1.0,
                    float(
                        raw_confidence
                    ),
                ),
            )


        if (
            confidence is not None
            and confidence
            < FACE_MIN_CONFIDENCE
        ):
            continue


        faces.append(
            {
                "embedding":
                    embedding_values,

                "detection_confidence":
                    confidence,

                "bbox_x1":
                    x,

                "bbox_y1":
                    y,

                "bbox_x2":
                    x + width,

                "bbox_y2":
                    y + height,

                "area":
                    width * height,
            }
        )


    # Prefer larger / clearer faces if a photo
    # contains more people than our indexing limit.
    faces.sort(
        key=lambda item: (
            item["area"],
            item[
                "detection_confidence"
            ]
            or 0,
        ),
        reverse=True,
    )


    limited = faces[
        :MAX_FACES_PER_PHOTO
    ]


    # Remove internal sorting helper before
    # storing the result.
    for face in limited:
        face.pop(
            "area",
            None,
        )


    # Stable face_index within this photograph.
    for index, face in enumerate(
        limited
    ):
        face[
            "face_index"
        ] = index


    return limited