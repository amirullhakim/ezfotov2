from __future__ import annotations

import math

from starlette.concurrency import (
    run_in_threadpool,
)

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Request,
    status,
)

from sqlalchemy import (
    select,
)

from sqlalchemy.orm import (
    Session,
)

from app.db.session import (
    get_db,
)

from app.models import (
    EventFaceEmbedding,
    EventPhoto,
)

from app.api.routes.public_event_sales import (
    get_public_event_workspace,
    get_public_live_event,
    public_photo_conditions,
    public_photo_response,
)


router = APIRouter(
    prefix="/public/events",
    tags=["Public Event Face Search"],
)


# --------------------------------------------------
# CONFIGURATION
# --------------------------------------------------


MAX_SELFIE_SIZE_BYTES = (
    10
    * 1024
    * 1024
)

ALLOWED_SELFIE_CONTENT_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
}


# We start conservatively.
#
# This can be tuned later using real EZFOTOO
# event data and false-match testing.
MIN_COSINE_SIMILARITY = 0.45


MAX_MATCHED_PHOTOS = 60


EXPECTED_EMBEDDING_DIMENSIONS = 512


# --------------------------------------------------
# FACE EXTRACTION
# --------------------------------------------------


def extract_selfie_embedding(
    selfie_bytes: bytes,
) -> list[float]:
    """
    Import DeepFace lazily.

    This prevents TensorFlow / DeepFace from being
    loaded into the FastAPI process during normal API
    startup. It is loaded only when selfie search is
    actually used.

    For now, the largest usable face detected in the
    selfie is selected.
    """

    from app.services.event_face_recognition import (
        recognize_faces,
    )


    faces = recognize_faces(
        selfie_bytes
    )


    if not faces:
        raise ValueError(
            "No clear face was detected in the selfie."
        )


    # recognize_faces() sorts larger / clearer faces
    # first, so index 0 is our preferred selfie face.
    embedding = faces[0].get(
        "embedding"
    )


    if not embedding:
        raise ValueError(
            "Unable to create a face embedding "
            "from the selfie."
        )


    embedding_values = [
        float(
            value
        )
        for value in embedding
    ]


    if (
        len(
            embedding_values
        )
        != EXPECTED_EMBEDDING_DIMENSIONS
    ):
        raise ValueError(
            "The selfie produced an invalid "
            "face embedding."
        )


    return embedding_values


# --------------------------------------------------
# COSINE SIMILARITY
# --------------------------------------------------


def cosine_similarity(
    first: list[float],
    second: list[float],
) -> float:
    if (
        len(first)
        != len(second)
        or not first
    ):
        return -1.0


    dot_product = 0.0

    first_squared = 0.0
    second_squared = 0.0


    for (
        first_value,
        second_value,
    ) in zip(
        first,
        second,
    ):
        first_float = float(
            first_value
        )

        second_float = float(
            second_value
        )


        dot_product += (
            first_float
            * second_float
        )


        first_squared += (
            first_float
            * first_float
        )


        second_squared += (
            second_float
            * second_float
        )


    if (
        first_squared <= 0
        or second_squared <= 0
    ):
        return -1.0


    denominator = (
        math.sqrt(
            first_squared
        )
        * math.sqrt(
            second_squared
        )
    )


    if denominator <= 0:
        return -1.0


    similarity = (
        dot_product
        / denominator
    )


    return max(
        -1.0,
        min(
            1.0,
            similarity,
        ),
    )


# --------------------------------------------------
# SELFIE SEARCH
# --------------------------------------------------


@router.post(
    "/{workspace_slug}/{event_slug}/selfie-search"
)
async def search_public_event_by_selfie(
    workspace_slug: str,
    event_slug: str,

    request: Request,

    db: Session = Depends(
        get_db
    ),
):
    # ----------------------------------------------
    # EVENT ACCESS
    # ----------------------------------------------

    workspace = (
        get_public_event_workspace(
            db=db,
            workspace_slug=
                workspace_slug,
        )
    )


    event = get_public_live_event(
        db=db,
        workspace=
            workspace,
        event_slug=
            event_slug,
    )


    if not event.allow_face_search:
        raise HTTPException(
            status_code=
                status.HTTP_403_FORBIDDEN,
            detail=(
                "Selfie search is disabled "
                "for this event."
            ),
        )


    # ----------------------------------------------
    # CONTENT TYPE
    # ----------------------------------------------

    content_type = (
        request.headers.get(
            "content-type"
        )
        or ""
    )


    # Ignore optional charset / parameters.
    content_type = (
        content_type
        .split(
            ";",
            1,
        )[0]
        .strip()
        .lower()
    )


    if (
        content_type
        not in
        ALLOWED_SELFIE_CONTENT_TYPES
    ):
        raise HTTPException(
            status_code=
                status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=(
                "Upload a JPEG, PNG, or WebP selfie."
            ),
        )


    # ----------------------------------------------
    # CONTENT LENGTH
    # ----------------------------------------------

    content_length = (
        request.headers.get(
            "content-length"
        )
    )


    if content_length:
        try:
            declared_size = int(
                content_length
            )

        except ValueError:
            declared_size = 0


        if (
            declared_size
            > MAX_SELFIE_SIZE_BYTES
        ):
            raise HTTPException(
                status_code=
                    status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=(
                    "The selfie must be 10 MB or smaller."
                ),
            )


    # ----------------------------------------------
    # READ INTO MEMORY
    # ----------------------------------------------

    selfie_bytes = (
        await request.body()
    )


    if not selfie_bytes:
        raise HTTPException(
            status_code=
                status.HTTP_400_BAD_REQUEST,
            detail=
                "The selfie file is empty.",
        )


    if (
        len(
            selfie_bytes
        )
        > MAX_SELFIE_SIZE_BYTES
    ):
        raise HTTPException(
            status_code=
                status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=(
                "The selfie must be 10 MB or smaller."
            ),
        )


    # ----------------------------------------------
    # SELFIE ARCFACE EMBEDDING
    # ----------------------------------------------
    #
    # Run the heavy CPU work in FastAPI's thread
    # pool instead of blocking the async event loop.
    #

    try:
        selfie_embedding = (
            await run_in_threadpool(
                extract_selfie_embedding,
                selfie_bytes,
            )
        )

    except ValueError as exc:
        raise HTTPException(
            status_code=
                status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=
                str(exc),
        ) from exc

    except Exception as exc:
        raise HTTPException(
            status_code=
                status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=(
                "Unable to process the selfie."
            ),
        ) from exc


    # The raw selfie bytes are not saved anywhere.
    #
    # Once this request completes, Python can reclaim
    # the in-memory request data.
    selfie_bytes = b""


    # ----------------------------------------------
    # LOAD EVENT FACE INDEX
    # ----------------------------------------------

    rows = db.execute(
        select(
            EventFaceEmbedding,
            EventPhoto,
        )
        .join(
            EventPhoto,
            EventPhoto.id
            == EventFaceEmbedding.photo_id,
        )
        .where(
            *public_photo_conditions(
                event
            ),

            EventFaceEmbedding.workspace_id
            == workspace.id,

            EventFaceEmbedding.event_id
            == event.id,
        )
    ).all()


    # ----------------------------------------------
    # BEST SCORE PER PHOTO
    # ----------------------------------------------
    #
    # One event photograph can contain many faces.
    # We keep only the highest-scoring face for each
    # photo.
    #

    best_by_photo: dict[
        str,
        tuple[
            float,
            EventPhoto,
        ],
    ] = {}


    for (
        face,
        photo,
    ) in rows:
        embedding = (
            face.embedding
        )


        if not embedding:
            continue


        stored_embedding = [
            float(
                value
            )
            for value in embedding
        ]


        if (
            len(
                stored_embedding
            )
            != EXPECTED_EMBEDDING_DIMENSIONS
        ):
            continue


        similarity = (
            cosine_similarity(
                selfie_embedding,
                stored_embedding,
            )
        )


        if (
            similarity
            < MIN_COSINE_SIMILARITY
        ):
            continue


        photo_key = str(
            photo.id
        )


        existing = (
            best_by_photo.get(
                photo_key
            )
        )


        if (
            existing is None
            or similarity
            > existing[0]
        ):
            best_by_photo[
                photo_key
            ] = (
                similarity,
                photo,
            )


    # ----------------------------------------------
    # SORT BEST MATCHES
    # ----------------------------------------------

    ranked = sorted(
        best_by_photo.values(),
        key=lambda item:
            item[0],
        reverse=True,
    )


    ranked = ranked[
        :MAX_MATCHED_PHOTOS
    ]


    # ----------------------------------------------
    # PUBLIC PHOTO RESPONSES
    # ----------------------------------------------

    public_photos: list[dict] = []


    for (
        similarity,
        photo,
    ) in ranked:
        item = public_photo_response(
            photo
        )


        if not item:
            continue


        # Useful for our initial tuning.
        #
        # It is not an identity probability.
        item[
            "similarity"
        ] = round(
            similarity,
            4,
        )


        public_photos.append(
            item
        )


    return {
        "event_id":
            str(event.id),

        "total":
            len(
                public_photos
            ),

        "threshold":
            MIN_COSINE_SIMILARITY,

        "photos":
            public_photos,

        "privacy": {
            "selfie_stored":
                False,

            "message": (
                "The uploaded selfie is processed "
                "for this search and is not stored "
                "by EZFOTOO."
            ),
        },
    }