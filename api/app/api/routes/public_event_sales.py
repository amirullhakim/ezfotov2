from __future__ import annotations

import re

from datetime import (
    datetime,
    timezone,
)

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
    status,
)

from sqlalchemy import (
    func,
    select,
)

from sqlalchemy.orm import (
    Session,
)

from app.db.session import (
    get_db,
)

from app.models import (
    EventBibDetection,
    EventGallery,
    EventPhoto,
    Service,
    Workspace,
    WorkspaceService,
)

from app.services.private_storage import (
    PrivateStorageError,
    generate_private_view_url,
)


router = APIRouter(
    prefix="/public/events",
    tags=["Public Event Sales"],
)


PREVIEW_URL_EXPIRES_SECONDS = 600

DEFAULT_PHOTO_LIMIT = 24
MAX_PHOTO_LIMIT = 60

MAX_BIB_SEARCH_RESULTS = 120


# --------------------------------------------------
# NORMALIZATION
# --------------------------------------------------


def normalize_slug(
    value: str,
) -> str:
    return (
        value
        .strip()
        .lower()
    )


def normalize_public_bib(
    value: str,
) -> str | None:
    """
    Lightweight public bib normalization.

    Examples:

    M90006 -> M90006
    m90006 -> M90006
    M 90006 -> M90006
    O7 -> 07

    We intentionally avoid importing the heavy
    YOLO / EasyOCR module into the public API.
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


    if re.fullmatch(
        r"[O0-9]+",
        cleaned,
    ):
        cleaned = cleaned.replace(
            "O",
            "0",
        )


    if (
        len(cleaned) < 2
        or len(cleaned) > 16
    ):
        return None


    if not any(
        character.isdigit()
        for character in cleaned
    ):
        return None


    return cleaned


# --------------------------------------------------
# PUBLIC WORKSPACE ACCESS
# --------------------------------------------------


def get_public_event_workspace(
    db: Session,
    workspace_slug: str,
) -> Workspace:
    slug = normalize_slug(
        workspace_slug
    )


    workspace = db.scalar(
        select(
            Workspace
        ).where(
            Workspace.slug
            == slug,

            Workspace.status
            == "ACTIVE",
        )
    )


    if not workspace:
        raise HTTPException(
            status_code=
                status.HTTP_404_NOT_FOUND,
            detail=
                "Event not found.",
        )


    active_service = db.scalar(
        select(
            WorkspaceService
        )
        .join(
            Service,
            Service.id
            == WorkspaceService.service_id,
        )
        .where(
            WorkspaceService.workspace_id
            == workspace.id,

            Service.code
            == "EVENT_SALES",

            WorkspaceService.status
            == "ACTIVE",
        )
    )


    if not active_service:
        raise HTTPException(
            status_code=
                status.HTTP_404_NOT_FOUND,
            detail=
                "Event not found.",
        )


    return workspace


# --------------------------------------------------
# PUBLIC EVENT LOOKUP
# --------------------------------------------------


def get_public_live_event(
    db: Session,
    workspace: Workspace,
    event_slug: str,
) -> EventGallery:
    slug = normalize_slug(
        event_slug
    )


    event = db.scalar(
        select(
            EventGallery
        ).where(
            EventGallery.workspace_id
            == workspace.id,

            EventGallery.slug
            == slug,

            EventGallery.status
            == "LIVE",
        )
    )


    if not event:
        raise HTTPException(
            status_code=
                status.HTTP_404_NOT_FOUND,
            detail=
                "Event not found.",
        )


    return event


# --------------------------------------------------
# SALES STATUS
# --------------------------------------------------


def event_sales_open(
    event: EventGallery,
) -> bool:
    if (
        event.status
        != "LIVE"
    ):
        return False


    if (
        event.sales_end_at
        is None
    ):
        return True


    return (
        event.sales_end_at
        > datetime.now(
            timezone.utc
        )
    )


# --------------------------------------------------
# MONEY
# --------------------------------------------------


def cents_to_rm(
    cents: int | None,
) -> float:
    return round(
        float(
            cents or 0
        )
        / 100,
        2,
    )


# --------------------------------------------------
# PUBLIC PHOTO FILTER
# --------------------------------------------------


def public_photo_conditions(
    event: EventGallery,
):
    return (
        EventPhoto.workspace_id
        == event.workspace_id,

        EventPhoto.event_id
        == event.id,

        EventPhoto.status
        == "READY",

        EventPhoto.is_visible
        .is_(
            True
        ),

        EventPhoto.deleted_at
        .is_(
            None
        ),

        EventPhoto.preview_object_key
        .is_not(
            None
        ),
    )


# --------------------------------------------------
# PUBLIC PHOTO RESPONSE
# --------------------------------------------------


def public_photo_response(
    photo: EventPhoto,
) -> dict | None:
    if not photo.preview_object_key:
        return None


    try:
        preview_url = (
            generate_private_view_url(
                object_key=
                    photo.preview_object_key,

                expires_seconds=
                    PREVIEW_URL_EXPIRES_SECONDS,
            )
        )

    except PrivateStorageError:
        return None


    return {
        "id":
            str(photo.id),

        "width":
            photo.width,

        "height":
            photo.height,

        "preview_url":
            preview_url,

        "preview_url_expires_in":
            PREVIEW_URL_EXPIRES_SECONDS,
    }


# --------------------------------------------------
# PUBLIC EVENT RESPONSE
# --------------------------------------------------


def public_event_response(
    db: Session,
    workspace: Workspace,
    event: EventGallery,
) -> dict:
    ready_photo_count = db.scalar(
        select(
            func.count(
                EventPhoto.id
            )
        ).where(
            *public_photo_conditions(
                event
            )
        )
    )


    return {
        "workspace": {
            "name":
                workspace.name,

            "slug":
                workspace.slug,
        },

        "event": {
            "id":
                str(event.id),

            "title":
                event.title,

            "slug":
                event.slug,

            "description":
                event.description,

            "event_date":
                event.event_date,

            "location":
                event.location,

            "status":
                event.status,

            "photo_count":
                int(
                    ready_photo_count
                    or 0
                ),

            "discovery": {
                "browse":
                    bool(
                        event.allow_browse
                    ),

                "bib_search":
                    bool(
                        event.allow_bib_search
                    ),

                "face_search":
                    bool(
                        event.allow_face_search
                    ),
            },

            "pricing": {
                "currency":
                    event.currency,

                "price_per_photo_cents":
                    event.price_per_photo_cents,

                "price_per_photo_rm":
                    cents_to_rm(
                        event.price_per_photo_cents
                    ),

                "bundle_enabled":
                    bool(
                        event.bundle_enabled
                    ),

                "bundle_quantity":
                    event.bundle_quantity,

                "bundle_price_cents":
                    event.bundle_price_cents,

                "bundle_price_rm":
                    cents_to_rm(
                        event.bundle_price_cents
                    ),
            },

            "sales": {
                "open":
                    event_sales_open(
                        event
                    ),

                "ends_at":
                    event.sales_end_at,
            },
        },
    }


# --------------------------------------------------
# GET PUBLIC EVENT
# --------------------------------------------------


@router.get(
    "/{workspace_slug}/{event_slug}"
)
def get_public_event(
    workspace_slug: str,
    event_slug: str,

    db: Session = Depends(
        get_db
    ),
):
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


    return public_event_response(
        db=db,
        workspace=
            workspace,
        event=
            event,
    )


# --------------------------------------------------
# BROWSE PHOTOS
# --------------------------------------------------


@router.get(
    "/{workspace_slug}/{event_slug}/photos"
)
def list_public_event_photos(
    workspace_slug: str,
    event_slug: str,

    limit: int = Query(
        default=
            DEFAULT_PHOTO_LIMIT,
        ge=1,
        le=
            MAX_PHOTO_LIMIT,
    ),

    offset: int = Query(
        default=0,
        ge=0,
    ),

    db: Session = Depends(
        get_db
    ),
):
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


    if not event.allow_browse:
        raise HTTPException(
            status_code=
                status.HTTP_403_FORBIDDEN,
            detail=(
                "Browsing is disabled "
                "for this event."
            ),
        )


    total = db.scalar(
        select(
            func.count(
                EventPhoto.id
            )
        ).where(
            *public_photo_conditions(
                event
            )
        )
    )


    photos = list(
        db.scalars(
            select(
                EventPhoto
            )
            .where(
                *public_photo_conditions(
                    event
                )
            )
            .order_by(
                EventPhoto.sort_order
                .asc(),

                EventPhoto.created_at
                .asc(),
            )
            .offset(
                offset
            )
            .limit(
                limit
            )
        )
    )


    public_photos: list[dict] = []


    for photo in photos:
        item = public_photo_response(
            photo
        )

        if item:
            public_photos.append(
                item
            )


    total_value = int(
        total or 0
    )


    next_offset = (
        offset
        + len(photos)
    )


    return {
        "event_id":
            str(event.id),

        "total":
            total_value,

        "limit":
            limit,

        "offset":
            offset,

        "returned":
            len(
                public_photos
            ),

        "has_more":
            next_offset
            < total_value,

        "photos":
            public_photos,
    }


# --------------------------------------------------
# BIB SEARCH
# --------------------------------------------------


@router.get(
    "/{workspace_slug}/{event_slug}/bib-search"
)
def search_public_event_by_bib(
    workspace_slug: str,
    event_slug: str,

    bib: str = Query(
        min_length=1,
        max_length=50,
    ),

    db: Session = Depends(
        get_db
    ),
):
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


    if not event.allow_bib_search:
        raise HTTPException(
            status_code=
                status.HTTP_403_FORBIDDEN,
            detail=(
                "Bib search is disabled "
                "for this event."
            ),
        )


    normalized_bib = (
        normalize_public_bib(
            bib
        )
    )


    if not normalized_bib:
        raise HTTPException(
            status_code=
                status.HTTP_400_BAD_REQUEST,
            detail=(
                "Enter a valid bib number."
            ),
        )


    total = db.scalar(
        select(
            func.count(
                func.distinct(
                    EventPhoto.id
                )
            )
        )
        .select_from(
            EventPhoto
        )
        .join(
            EventBibDetection,
            EventBibDetection.photo_id
            == EventPhoto.id,
        )
        .where(
            *public_photo_conditions(
                event
            ),

            EventBibDetection.workspace_id
            == workspace.id,

            EventBibDetection.event_id
            == event.id,

            EventBibDetection.bib_number
            == normalized_bib,
        )
    )


    photos = list(
        db.scalars(
            select(
                EventPhoto
            )
            .join(
                EventBibDetection,
                EventBibDetection.photo_id
                == EventPhoto.id,
            )
            .where(
                *public_photo_conditions(
                    event
                ),

                EventBibDetection.workspace_id
                == workspace.id,

                EventBibDetection.event_id
                == event.id,

                EventBibDetection.bib_number
                == normalized_bib,
            )
            .distinct()
            .order_by(
                EventPhoto.sort_order
                .asc(),

                EventPhoto.created_at
                .asc(),
            )
            .limit(
                MAX_BIB_SEARCH_RESULTS
            )
        )
    )


    public_photos: list[dict] = []


    for photo in photos:
        item = public_photo_response(
            photo
        )

        if item:
            public_photos.append(
                item
            )


    return {
        "event_id":
            str(event.id),

        "query":
            bib,

        "bib_number":
            normalized_bib,

        "total":
            int(
                total or 0
            ),

        "returned":
            len(
                public_photos
            ),

        "truncated":
            int(
                total or 0
            )
            > MAX_BIB_SEARCH_RESULTS,

        "photos":
            public_photos,
    }