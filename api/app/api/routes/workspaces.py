import uuid
import logging

from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy.exc import IntegrityError

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.core.config import settings
from app.schemas.onboarding import normalize_workspace_slug
from app.services.workspace_access import get_user_workspace
from app.services.vercel_domains import VercelDomainProvisionError, provision_vercel_domain

from app.db.session import get_db
from app.models import (
    Domain,
    Profile,
    Service,
    Workspace,
    WorkspaceMember,
    WorkspaceService,
)


router = APIRouter(
    prefix="/workspaces",
    tags=["Workspaces"],
)


@router.get("/me")
def get_my_workspace(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        auth_user_id = uuid.UUID(current_user["id"])
    except (KeyError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authenticated user.",
        )

    membership = db.scalar(
        select(WorkspaceMember).where(
            WorkspaceMember.profile_id == auth_user_id,
            WorkspaceMember.status == "ACTIVE",
        )
    )

    if not membership:
        return {
            "onboarded": False,
            "workspace": None,
        }

    workspace = db.get(
        Workspace,
        membership.workspace_id,
    )

    if not workspace:
        return {
            "onboarded": False,
            "workspace": None,
        }

    service_rows = (
        db.execute(
            select(
                Service.code,
                Service.name,
                WorkspaceService.status,
                WorkspaceService.activated_at,
                WorkspaceService.expires_at,
            )
            .join(
                WorkspaceService,
                WorkspaceService.service_id == Service.id,
            )
            .where(
                WorkspaceService.workspace_id == workspace.id
            )
            .order_by(Service.name)
        )
        .mappings()
        .all()
    )

    primary_domain = db.scalar(
        select(Domain)
        .where(
            Domain.workspace_id == workspace.id,
            Domain.is_primary.is_(True),
        )
    )

    return {
        "onboarded": True,
        "workspace": {
            "id": str(workspace.id),
            "name": workspace.name,
            "business_name": workspace.business_name,
            "slug": workspace.slug,
            "status": workspace.status,
            "is_onboarded": workspace.is_onboarded,
            "role": membership.role,
            "domain": {
                "hostname": primary_domain.hostname,
                "type": primary_domain.domain_type,
                "verified": primary_domain.is_verified,
            }
            if primary_domain
            else None,
            "services": [
                {
                    "code": row["code"],
                    "name": row["name"],
                    "status": row["status"],
                    "activated_at": row["activated_at"],
                    "expires_at": row["expires_at"],
                }
                for row in service_rows
            ],
        },
    }

# Settings use the same membership resolution as billing and other workspace APIs.
logger = logging.getLogger(__name__)


class ProfileSettingsUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    full_name: str = Field(min_length=2, max_length=255)

    @field_validator("full_name", mode="before")
    @classmethod
    def clean_name(cls, value):
        return " ".join(value.split()) if isinstance(value, str) else value


class WorkspaceSettingsUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(min_length=2, max_length=255)
    business_name: str = Field(min_length=2, max_length=255)

    @field_validator("name", "business_name", mode="before")
    @classmethod
    def clean_name(cls, value):
        return " ".join(value.split()) if isinstance(value, str) else value


class WorkspaceAddressUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    slug: str = Field(min_length=3, max_length=60)
    confirm_link_change: bool = False

    @field_validator("slug", mode="before")
    @classmethod
    def clean_slug(cls, value):
        slug = normalize_workspace_slug(value) if isinstance(value, str) else value
        # Also reserve infrastructure hosts used by the frontend proxy.
        if slug in {"media", "jobs"}:
            raise ValueError("This workspace address is reserved.")
        return slug


def _settings_profile(current_user: dict, db: Session) -> Profile:
    try:
        user_id = uuid.UUID(current_user["id"])
    except (KeyError, TypeError, ValueError):
        raise HTTPException(401, "Invalid authenticated user.")
    profile = db.get(Profile, user_id)
    if profile is None or not profile.is_active:
        raise HTTPException(403, "An active EZFOTOO profile is required.")
    return profile


def _settings_owner(current_user: dict, db: Session) -> Workspace:
    _settings_profile(current_user, db)
    workspace, membership = get_user_workspace(current_user["id"], db)
    if membership.role != "OWNER" or workspace.status != "ACTIVE":
        raise HTTPException(403, "Only the owner of an active workspace can change these settings.")
    # Serialize name/address changes within the workspace.
    return db.scalar(select(Workspace).where(Workspace.id == workspace.id).with_for_update())


def _settings_snapshot(current_user: dict, db: Session) -> dict:
    profile = _settings_profile(current_user, db)
    workspace, membership = get_user_workspace(current_user["id"], db)
    root_domain = (settings.vercel_root_domain or "ezfotoo.com").strip().lower()
    hostname = f"{workspace.slug}.{root_domain}"
    domain = db.scalar(select(Domain).where(
        Domain.workspace_id == workspace.id, Domain.hostname == hostname,
    ))
    return {
        "profile": {"full_name": profile.full_name or "", "email": current_user.get("email") or profile.email or ""},
        "workspace": {
            "name": workspace.name, "business_name": workspace.business_name or workspace.name,
            "slug": workspace.slug, "hostname": hostname, "root_domain": root_domain,
            "domain_verified": bool(domain and domain.is_verified), "role": membership.role,
        },
        "can_manage_workspace": membership.role == "OWNER" and workspace.status == "ACTIVE",
    }


@router.get("/me/settings")
def get_workspace_settings(
    response: Response,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    response.headers["Cache-Control"] = "no-store"
    return _settings_snapshot(current_user, db)


@router.patch("/me/profile")
def update_my_profile(
    payload: ProfileSettingsUpdate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    profile = _settings_profile(current_user, db)
    get_user_workspace(current_user["id"], db)
    try:
        profile.full_name = payload.full_name
        db.commit()
    except Exception:
        db.rollback()
        raise
    return _settings_snapshot(current_user, db)


@router.patch("/me/settings")
def update_workspace_settings(
    payload: WorkspaceSettingsUpdate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    workspace = _settings_owner(current_user, db)
    try:
        workspace.name = payload.name
        workspace.business_name = payload.business_name
        db.commit()
    except Exception:
        db.rollback()
        raise
    return _settings_snapshot(current_user, db)


@router.get("/me/address/{slug}")
def check_workspace_settings_address(
    slug: str,
    response: Response,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _settings_profile(current_user, db)
    workspace, _ = get_user_workspace(current_user["id"], db)
    try:
        normalized = normalize_workspace_slug(slug)
        if normalized in {"media", "jobs"}:
            raise ValueError("This workspace address is reserved.")
    except ValueError as exc:
        raise HTTPException(422, str(exc))
    root_domain = (settings.vercel_root_domain or "ezfotoo.com").strip().lower()
    hostname = f"{normalized}.{root_domain}"
    conflict = db.scalar(select(Workspace.id).where(
        Workspace.slug == normalized, Workspace.id != workspace.id,
    ))
    domain = db.scalar(select(Domain).where(Domain.hostname == hostname))
    available = conflict is None and (
        domain is None or (domain.workspace_id == workspace.id and domain.domain_type == "SUBDOMAIN")
    )
    response.headers["Cache-Control"] = "no-store"
    return {
        "available": available, "hostname": hostname,
        "reason": None if available else "This workspace address is already taken.",
    }


@router.patch("/me/address")
def update_workspace_address(
    payload: WorkspaceAddressUpdate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    workspace = _settings_owner(current_user, db)
    if payload.slug == workspace.slug:
        db.rollback()
        return _settings_snapshot(current_user, db)
    if not payload.confirm_link_change:
        raise HTTPException(422, "Confirm that changing the address changes your shared website and gallery links.")
    root_domain = (settings.vercel_root_domain or "ezfotoo.com").strip().lower()
    hostname = f"{payload.slug}.{root_domain}"
    # Old hostnames remain reserved to the workspace, preventing reassignment.
    conflict = db.scalar(select(Workspace.id).where(Workspace.slug == payload.slug))
    domain = db.scalar(select(Domain).where(Domain.hostname == hostname))
    if conflict is not None or (domain is not None and domain.workspace_id != workspace.id):
        raise HTTPException(409, "This workspace address is already taken.")
    if domain is not None and domain.domain_type != "SUBDOMAIN":
        raise HTTPException(409, "This address is reserved for another domain configuration.")
    try:
        if domain is None:
            domain = Domain(workspace_id=workspace.id, hostname=hostname,
                            domain_type="SUBDOMAIN", is_primary=False, is_verified=False)
            db.add(domain)
        db.flush()  # Reserve the unique hostname before contacting Vercel.
        # Do not change the current address unless the new host is ready.
        try:
            provisioned = provision_vercel_domain(hostname)
        except VercelDomainProvisionError:
            logger.warning("Workspace address provisioning failed for workspace %s", workspace.id)
            raise HTTPException(503, "The new address could not be connected. Your current address is unchanged. Please try again.")
        if provisioned.get("verified") is not True:
            raise HTTPException(503, "The new address is awaiting domain verification. Your current address is unchanged.")
        primary_domain = db.scalar(select(Domain).where(
            Domain.workspace_id == workspace.id, Domain.is_primary.is_(True),
        ))
        if primary_domain is None or primary_domain.domain_type == "SUBDOMAIN":
            if primary_domain is not None:
                primary_domain.is_primary = False
                db.flush()
            domain.is_primary = True
        domain.is_verified = True
        workspace.slug = payload.slug
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "This workspace address is already taken. Choose another address.")
    except Exception:
        db.rollback()
        raise
    return _settings_snapshot(current_user, db)