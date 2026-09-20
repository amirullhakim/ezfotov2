from fastapi import APIRouter

from app.api.routes.admin import (
    router as admin_router,
)

from app.api.routes.auth import (
    router as auth_router,
)

from app.api.routes.client_galleries import (
    router as client_galleries_router,
)

from app.api.routes.event_photo_previews import (
    router as event_photo_previews_router,
)

from app.api.routes.event_photos import (
    router as event_photos_router,
)

from app.api.routes.event_processing import (
    router as event_processing_router,
)

from app.api.routes.event_sales import (
    router as event_sales_router,
)

from app.api.routes.gallery_photos import (
    router as gallery_photos_router,
)

from app.api.routes.gallery_trash import (
    router as gallery_trash_router,
)

from app.api.routes.health import (
    router as health_router,
)

from app.api.routes.internal_gallery_cleanup import (
    router as internal_gallery_cleanup_router,
)

from app.api.routes.onboarding import (
    router as onboarding_router,
)

from app.api.routes.public_event_sales import (
    router as public_event_sales_router,
)

from app.api.routes.public_galleries import (
    router as public_galleries_router,
)

from app.api.routes.public_website import (
    router as public_website_router,
)

from app.api.routes.uploads import (
    router as uploads_router,
)

from app.api.routes.website import (
    router as website_router,
)

from app.api.routes.workspaces import (
    router as workspaces_router,
)


api_router = APIRouter()


api_router.include_router(
    health_router
)

api_router.include_router(
    auth_router
)

api_router.include_router(
    onboarding_router
)

api_router.include_router(
    workspaces_router
)

api_router.include_router(
    admin_router
)

api_router.include_router(
    website_router
)

api_router.include_router(
    public_website_router
)

api_router.include_router(
    uploads_router
)

api_router.include_router(
    client_galleries_router
)

api_router.include_router(
    gallery_photos_router
)

api_router.include_router(
    public_galleries_router
)

api_router.include_router(
    gallery_trash_router
)

api_router.include_router(
    internal_gallery_cleanup_router
)

api_router.include_router(
    event_sales_router
)

api_router.include_router(
    event_photos_router
)

api_router.include_router(
    event_photo_previews_router
)

api_router.include_router(
    event_processing_router
)

api_router.include_router(
    public_event_sales_router
)