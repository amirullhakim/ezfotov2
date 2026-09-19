import re
import unicodedata
import uuid
from datetime import datetime, timezone

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
)
from sqlalchemy import (
    func,
    select,
)
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.db.session import get_db
from app.models import (
    EventGallery,
    EventPhoto,
)
from app.schemas.event_sale import (
    EventSaleCreate,
    EventSaleUpdate,
)
from app.services.service_access import (
    require_workspace_service,
)
from app.services.workspace_access import (
    get_user_workspace,
)


router = APIRouter(
    prefix="/event-sales/events",
    tags=["Event Sales"],
)


# --------------------------------------------------
# WORKSPACE / SERVICE ACCESS
# --------------------------------------------------


def get_event_sales_workspace(
    current_user: dict,
    db: Session,
):
    workspace, membership = (
        get_user_workspace(
            current_user["id"],
            db,
        )
    )

    require_workspace_service(
        workspace.id,
        "EVENT_SALES",
        db,
    )

    return workspace, membership


# --------------------------------------------------
# SLUG HELPERS
# --------------------------------------------------


def normalize_event_slug(
    value: str,
) -> str:
    normalized = unicodedata.normalize(
        "NFKD",
        value,
    )

    normalized = normalized.encode(
        "ascii",
        "ignore",
    ).decode("ascii")

    normalized = normalized.lower()

    normalized = re.sub(
        r"[^a-z0-9]+",
        "-",
        normalized,
    )

    normalized = normalized.strip("-")

    if len(normalized) < 3:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Event address must contain "
                "at least 3 characters."
            ),
        )

    if len(normalized) > 120:
        normalized = normalized[
            :120
        ].rstrip("-")

    return normalized


def ensure_slug_available(
    db: Session,
    workspace_id: uuid.UUID,
    slug: str,
    exclude_event_id: uuid.UUID | None = None,
):
    query = select(
        EventGallery.id
    ).where(
        EventGallery.workspace_id
        == workspace_id,
        EventGallery.slug
        == slug,
    )

    if exclude_event_id is not None:
        query = query.where(
            EventGallery.id
            != exclude_event_id
        )

    existing = db.scalar(
        query
    )

    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "An event with this address "
                "already exists."
            ),
        )


# --------------------------------------------------
# EVENT LOOKUP
# --------------------------------------------------


def parse_event_id(
    event_id: str,
) -> uuid.UUID:
    try:
        return uuid.UUID(
            event_id
        )

    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid event ID.",
        )


def get_workspace_event(
    db: Session,
    workspace_id: uuid.UUID,
    event_id: str,
) -> EventGallery:
    parsed_id = parse_event_id(
        event_id
    )

    event = db.scalar(
        select(
            EventGallery
        ).where(
            EventGallery.id
            == parsed_id,
            EventGallery.workspace_id
            == workspace_id,
        )
    )

    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found.",
        )

    return event


# --------------------------------------------------
# PHOTO / STORAGE STATS
# --------------------------------------------------


def get_event_photo_count(
    db: Session,
    event_id: uuid.UUID,
) -> int:
    value = db.scalar(
        select(
            func.count(
                EventPhoto.id
            )
        ).where(
            EventPhoto.event_id
            == event_id,
            EventPhoto.status
            != "DELETED",
        )
    )

    return int(
        value or 0
    )


def get_ready_photo_count(
    db: Session,
    event_id: uuid.UUID,
) -> int:
    value = db.scalar(
        select(
            func.count(
                EventPhoto.id
            )
        ).where(
            EventPhoto.event_id
            == event_id,
            EventPhoto.status
            == "READY",
        )
    )

    return int(
        value or 0
    )


def get_event_storage_bytes(
    db: Session,
    event_id: uuid.UUID,
) -> int:
    value = db.scalar(
        select(
            func.coalesce(
                func.sum(
                    EventPhoto.size_bytes
                ),
                0,
            )
        ).where(
            EventPhoto.event_id
            == event_id,
            EventPhoto.status
            != "DELETED",
        )
    )

    return int(
        value or 0
    )


def get_all_event_photo_rows_count(
    db: Session,
    event_id: uuid.UUID,
) -> int:
    value = db.scalar(
        select(
            func.count(
                EventPhoto.id
            )
        ).where(
            EventPhoto.event_id
            == event_id,
        )
    )

    return int(
        value or 0
    )


# --------------------------------------------------
# VALIDATION
# --------------------------------------------------


def validate_sales_end_at(
    value: datetime | None,
):
    if value is None:
        return

    if (
        value.tzinfo is None
        or value.utcoffset() is None
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Sales end time must "
                "include a timezone."
            ),
        )


def validate_live_event(
    event_status: str,
    allow_browse: bool,
    allow_bib_search: bool,
    allow_face_search: bool,
):
    if event_status != "LIVE":
        return

    if not any(
        (
            allow_browse,
            allow_bib_search,
            allow_face_search,
        )
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "A LIVE event must enable "
                "at least one customer "
                "discovery method."
            ),
        )


# --------------------------------------------------
# RESPONSE
# --------------------------------------------------


def event_response(
    db: Session,
    event: EventGallery,
):
    now = datetime.now(
        timezone.utc
    )

    sales_deadline_passed = (
        event.sales_end_at is not None
        and event.sales_end_at <= now
    )

    sales_open = (
        event.status == "LIVE"
        and not sales_deadline_passed
    )

    return {
        "id":
            event.id,

        "workspace_id":
            event.workspace_id,

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

        "allow_browse":
            event.allow_browse,

        "allow_bib_search":
            event.allow_bib_search,

        "allow_face_search":
            event.allow_face_search,

        "price_per_photo_cents":
            event.price_per_photo_cents,

        "price_per_photo_rm":
            (
                event.price_per_photo_cents
                / 100
            ),

        "currency":
            event.currency,

        "bundle_enabled":
            event.bundle_enabled,

        "bundle_quantity":
            event.bundle_quantity,

        "bundle_price_cents":
            event.bundle_price_cents,

        "bundle_price_rm":
            (
                event.bundle_price_cents
                / 100
            ),

        "sales_end_at":
            event.sales_end_at,

        "sales_open":
            sales_open,

        "photo_count":
            get_event_photo_count(
                db,
                event.id,
            ),

        "ready_photo_count":
            get_ready_photo_count(
                db,
                event.id,
            ),

        "storage_bytes":
            get_event_storage_bytes(
                db,
                event.id,
            ),

        "created_at":
            event.created_at,

        "updated_at":
            event.updated_at,
    }


# --------------------------------------------------
# LIST EVENTS
# --------------------------------------------------


@router.get("")
def list_events(
    current_user: dict = Depends(
        get_current_user
    ),
    db: Session = Depends(
        get_db
    ),
):
    workspace, _ = (
        get_event_sales_workspace(
            current_user,
            db,
        )
    )

    events = db.scalars(
        select(
            EventGallery
        )
        .where(
            EventGallery.workspace_id
            == workspace.id
        )
        .order_by(
            EventGallery.created_at.desc()
        )
    ).all()

    return {
        "events": [
            event_response(
                db,
                event,
            )
            for event in events
        ],
    }


# --------------------------------------------------
# CREATE EVENT
# --------------------------------------------------


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
)
def create_event(
    payload: EventSaleCreate,
    current_user: dict = Depends(
        get_current_user
    ),
    db: Session = Depends(
        get_db
    ),
):
    workspace, _ = (
        get_event_sales_workspace(
            current_user,
            db,
        )
    )

    source_slug = (
        payload.slug
        if payload.slug
        else payload.title
    )

    slug = normalize_event_slug(
        source_slug
    )

    ensure_slug_available(
        db=db,
        workspace_id=workspace.id,
        slug=slug,
    )

    validate_sales_end_at(
        payload.sales_end_at
    )

    validate_live_event(
        event_status=payload.status,
        allow_browse=payload.allow_browse,
        allow_bib_search=payload.allow_bib_search,
        allow_face_search=payload.allow_face_search,
    )

    event = EventGallery(
        workspace_id=
            workspace.id,

        title=
            payload.title.strip(),

        slug=
            slug,

        description=(
            payload.description.strip()
            if payload.description
            else None
        ),

        event_date=
            payload.event_date,

        location=(
            payload.location.strip()
            if payload.location
            else None
        ),

        status=
            payload.status,

        allow_browse=
            payload.allow_browse,

        allow_bib_search=
            payload.allow_bib_search,

        allow_face_search=
            payload.allow_face_search,

        price_per_photo_cents=
            payload.price_per_photo_cents,

        currency=
            payload.currency,

        bundle_enabled=
            payload.bundle_enabled,

        bundle_quantity=
            payload.bundle_quantity,

        bundle_price_cents=
            payload.bundle_price_cents,

        sales_end_at=
            payload.sales_end_at,
    )

    db.add(
        event
    )

    try:
        db.commit()

        db.refresh(
            event
        )

    except IntegrityError:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Event could not be created "
                "because its address "
                "already exists."
            ),
        )

    return event_response(
        db,
        event,
    )


# --------------------------------------------------
# GET SINGLE EVENT
# --------------------------------------------------


@router.get(
    "/{event_id}"
)
def get_event(
    event_id: str,
    current_user: dict = Depends(
        get_current_user
    ),
    db: Session = Depends(
        get_db
    ),
):
    workspace, _ = (
        get_event_sales_workspace(
            current_user,
            db,
        )
    )

    event = get_workspace_event(
        db=db,
        workspace_id=
            workspace.id,
        event_id=
            event_id,
    )

    return event_response(
        db,
        event,
    )


# --------------------------------------------------
# UPDATE EVENT
# --------------------------------------------------


@router.patch(
    "/{event_id}"
)
def update_event(
    event_id: str,
    payload: EventSaleUpdate,
    current_user: dict = Depends(
        get_current_user
    ),
    db: Session = Depends(
        get_db
    ),
):
    workspace, _ = (
        get_event_sales_workspace(
            current_user,
            db,
        )
    )

    event = get_workspace_event(
        db=db,
        workspace_id=
            workspace.id,
        event_id=
            event_id,
    )

    values = payload.model_dump(
        exclude_unset=True
    )


    # --------------------------------------------------
    # TITLE
    # --------------------------------------------------

    if "title" in values:
        if values["title"] is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "Event title cannot "
                    "be empty."
                ),
            )

        cleaned_title = (
            values["title"].strip()
        )

        if not cleaned_title:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "Event title cannot "
                    "be empty."
                ),
            )

        event.title = (
            cleaned_title
        )


    # --------------------------------------------------
    # SLUG
    # --------------------------------------------------

    if "slug" in values:
        if not values["slug"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "Event address cannot "
                    "be empty."
                ),
            )

        new_slug = (
            normalize_event_slug(
                values["slug"]
            )
        )

        ensure_slug_available(
            db=db,
            workspace_id=
                workspace.id,
            slug=
                new_slug,
            exclude_event_id=
                event.id,
        )

        event.slug = (
            new_slug
        )


    # --------------------------------------------------
    # OPTIONAL BASIC FIELDS
    # --------------------------------------------------

    if "description" in values:
        description = (
            values["description"]
        )

        event.description = (
            description.strip()
            if description
            else None
        )


    if "event_date" in values:
        event.event_date = (
            values["event_date"]
        )


    if "location" in values:
        location = (
            values["location"]
        )

        event.location = (
            location.strip()
            if location
            else None
        )


    # --------------------------------------------------
    # SALES DEADLINE
    # --------------------------------------------------

    if "sales_end_at" in values:
        validate_sales_end_at(
            values["sales_end_at"]
        )

        event.sales_end_at = (
            values["sales_end_at"]
        )


    # --------------------------------------------------
    # NON-NULL SETTINGS
    # --------------------------------------------------

    required_update_fields = (
        "status",
        "allow_browse",
        "allow_bib_search",
        "allow_face_search",
        "price_per_photo_cents",
        "currency",
        "bundle_enabled",
        "bundle_quantity",
        "bundle_price_cents",
    )

    for field_name in (
        required_update_fields
    ):
        if (
            field_name in values
            and values[field_name]
            is None
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"{field_name} "
                    "cannot be null."
                ),
            )


    if "status" in values:
        event.status = (
            values["status"]
        )


    if "allow_browse" in values:
        event.allow_browse = (
            values["allow_browse"]
        )


    if "allow_bib_search" in values:
        event.allow_bib_search = (
            values[
                "allow_bib_search"
            ]
        )


    if "allow_face_search" in values:
        event.allow_face_search = (
            values[
                "allow_face_search"
            ]
        )


    if (
        "price_per_photo_cents"
        in values
    ):
        event.price_per_photo_cents = (
            values[
                "price_per_photo_cents"
            ]
        )


    if "currency" in values:
        event.currency = (
            values["currency"]
        )


    if "bundle_enabled" in values:
        event.bundle_enabled = (
            values["bundle_enabled"]
        )


    if "bundle_quantity" in values:
        event.bundle_quantity = (
            values["bundle_quantity"]
        )


    if "bundle_price_cents" in values:
        event.bundle_price_cents = (
            values[
                "bundle_price_cents"
            ]
        )


    # --------------------------------------------------
    # VALIDATE FINAL EVENT CONFIGURATION
    # --------------------------------------------------

    validate_live_event(
        event_status=
            event.status,

        allow_browse=
            event.allow_browse,

        allow_bib_search=
            event.allow_bib_search,

        allow_face_search=
            event.allow_face_search,
    )


    try:
        db.commit()

        db.refresh(
            event
        )

    except IntegrityError:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Event could not be updated "
                "because its address "
                "already exists."
            ),
        )

    return event_response(
        db,
        event,
    )


# --------------------------------------------------
# DELETE EVENT
# --------------------------------------------------


@router.delete(
    "/{event_id}"
)
def delete_event(
    event_id: str,
    current_user: dict = Depends(
        get_current_user
    ),
    db: Session = Depends(
        get_db
    ),
):
    workspace, _ = (
        get_event_sales_workspace(
            current_user,
            db,
        )
    )

    event = get_workspace_event(
        db=db,
        workspace_id=
            workspace.id,
        event_id=
            event_id,
    )


    # A LIVE customer-facing event should first be
    # closed before deletion.
    if event.status == "LIVE":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "A LIVE event cannot be "
                "deleted. Close the event first."
            ),
        )


    # --------------------------------------------------
    # SAFE DELETE RULE
    # --------------------------------------------------
    #
    # Event photos live in private R2.
    #
    # We must not rely on a database CASCADE alone,
    # because doing so could leave R2 objects orphaned.
    #
    # Once Phase 3B photo management exists, event
    # deletion will use an explicit storage cleanup
    # workflow.
    #
    photo_rows = (
        get_all_event_photo_rows_count(
            db,
            event.id,
        )
    )

    if photo_rows > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "This event contains photo "
                "records and cannot be deleted "
                "yet. Remove its photos first."
            ),
        )


    deleted_id = str(
        event.id
    )

    deleted_title = (
        event.title
    )

    db.delete(
        event
    )

    db.commit()

    return {
        "ok": True,
        "deleted": True,
        "event_id": deleted_id,
        "title": deleted_title,
    }