import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.core.config import settings
from app.db.session import get_db
from app.models import (
    Domain,
    Profile,
    Service,
    Workspace,
    WorkspaceMember,
    WorkspaceService,
)
from app.schemas.onboarding import (
    CompleteOnboardingRequest,
    CompleteOnboardingResponse,
    SlugAvailabilityResponse,
)
from app.services.vercel_domains import (
    VercelDomainProvisionError,
    provision_vercel_domain,
)


logger = logging.getLogger(__name__)


router = APIRouter(
    prefix="/onboarding",
    tags=["Onboarding"],
)


def utc_now() -> datetime:
    return datetime.now(
        timezone.utc
    )


@router.get(
    "/slug/{slug}",
    response_model=SlugAvailabilityResponse,
)
def check_slug_availability(
    slug: str,
    current_user: dict = Depends(
        get_current_user
    ),
    db: Session = Depends(get_db),
):
    normalized_slug = (
        slug.strip().lower()
    )

    existing_workspace = db.scalar(
        select(Workspace).where(
            Workspace.slug
            == normalized_slug
        )
    )

    return {
        "slug": normalized_slug,
        "available":
            existing_workspace
            is None,
    }


@router.post(
    "/complete",
    response_model=CompleteOnboardingResponse,
    status_code=status.HTTP_201_CREATED,
)
def complete_onboarding(
    payload: CompleteOnboardingRequest,
    current_user: dict = Depends(
        get_current_user
    ),
    db: Session = Depends(get_db),
):
    try:
        auth_user_id = uuid.UUID(
            current_user["id"]
        )

    except (
        KeyError,
        ValueError,
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=(
                "Invalid authenticated user."
            ),
        )


    email = current_user.get(
        "email"
    )

    normalized_slug = (
        payload.slug.strip().lower()
    )


    # --------------------------------------------------
    # EXISTING WORKSPACE CHECK
    # --------------------------------------------------

    existing_membership = db.scalar(
        select(
            WorkspaceMember
        ).where(
            WorkspaceMember.profile_id
            == auth_user_id
        )
    )

    if existing_membership:
        existing_workspace = db.get(
            Workspace,
            existing_membership.workspace_id,
        )

        if existing_workspace:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "Your account already has "
                    "a workspace."
                ),
            )


    # --------------------------------------------------
    # SLUG CHECK
    # --------------------------------------------------

    existing_slug = db.scalar(
        select(Workspace).where(
            Workspace.slug
            == normalized_slug
        )
    )

    if existing_slug:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "This workspace address "
                "is already taken."
            ),
        )


    root_domain = (
        settings.vercel_root_domain
        or "ezfotoo.com"
    ).strip().lower()


    hostname = (
        f"{normalized_slug}."
        f"{root_domain}"
    )


    # --------------------------------------------------
    # DOMAIN RESERVATION CHECK
    # --------------------------------------------------

    existing_domain = db.scalar(
        select(Domain).where(
            Domain.hostname
            == hostname
        )
    )

    if existing_domain:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "This domain is "
                "already reserved."
            ),
        )


    # --------------------------------------------------
    # CREATE WORKSPACE
    # --------------------------------------------------
    #
    # IMPORTANT:
    #
    # Database creation is committed BEFORE
    # talking to Vercel.
    #
    # A temporary Vercel failure must never
    # destroy a photographer's workspace.
    #
    try:
        profile = db.get(
            Profile,
            auth_user_id,
        )


        if profile is None:
            profile = Profile(
                id=auth_user_id,
                full_name=(
                    payload.full_name
                ),
                email=email,
                is_platform_admin=False,
                is_active=True,
            )

            db.add(profile)

        else:
            profile.full_name = (
                payload.full_name
            )

            if email:
                profile.email = email


        workspace = Workspace(
            name=(
                payload.business_name
            ),
            business_name=(
                payload.business_name
            ),
            slug=normalized_slug,
            status="ACTIVE",
            is_onboarded=True,
        )

        db.add(workspace)
        db.flush()


        membership = WorkspaceMember(
            workspace_id=workspace.id,
            profile_id=profile.id,
            role="OWNER",
            status="ACTIVE",
        )

        db.add(membership)


        domain = Domain(
            workspace_id=workspace.id,
            hostname=hostname,
            domain_type="SUBDOMAIN",
            is_primary=True,

            # Remains false until Vercel
            # confirms ownership verification.
            is_verified=False,
        )

        db.add(domain)


        services = db.scalars(
            select(Service).where(
                Service.is_active.is_(
                    True
                )
            )
        ).all()


        for service in services:
            db.add(
                WorkspaceService(
                    workspace_id=(
                        workspace.id
                    ),
                    service_id=(
                        service.id
                    ),
                    status="INACTIVE",
                    activated_at=None,
                    expires_at=None,
                )
            )


        db.commit()

        db.refresh(workspace)
        db.refresh(membership)
        db.refresh(domain)


    except IntegrityError:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Workspace or domain "
                "already exists."
            ),
        )


    except Exception:
        db.rollback()
        raise


    # --------------------------------------------------
    # VERCEL DOMAIN PROVISIONING
    # --------------------------------------------------
    #
    # Cloudflare already has:
    #
    # *.ezfotoo.com → Vercel
    #
    # Therefore we only need to register the
    # individual hostname with the Vercel project.
    #
    # Failure here MUST NOT undo the workspace.
    #
    try:
        vercel_domain = (
            provision_vercel_domain(
                hostname
            )
        )


        # Vercel's "verified" field represents
        # whether domain ownership verification
        # is complete.
        #
        # With our parent EZFOTOO domain already
        # owned/configured, tenant subdomains
        # should normally be verified immediately.
        if (
            vercel_domain.get(
                "verified"
            )
            is True
        ):
            domain.is_verified = True

            db.commit()
            db.refresh(domain)


        logger.info(
            "Provisioned Vercel domain %s "
            "for workspace %s.",
            hostname,
            workspace.id,
        )


    except VercelDomainProvisionError as exc:
        # Workspace stays completely valid.
        #
        # Domain remains is_verified=False so
        # we can identify/retry provisioning
        # later rather than losing onboarding.
        logger.exception(
            "Workspace %s was created, "
            "but Vercel domain provisioning "
            "failed for %s: %s",
            workspace.id,
            hostname,
            exc,
        )


    return {
        "workspace_id":
            str(workspace.id),

        "workspace_name":
            workspace.name,

        "workspace_slug":
            workspace.slug,

        "hostname":
            hostname,

        "role":
            membership.role,
    }