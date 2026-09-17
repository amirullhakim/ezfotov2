from fastapi import APIRouter

from app.api.routes.admin import router as admin_router
from app.api.routes.auth import router as auth_router
from app.api.routes.client_galleries import (
    router as client_galleries_router,
)
from app.api.routes.gallery_photos import (
    router as gallery_photos_router,
)
from app.api.routes.health import router as health_router
from app.api.routes.onboarding import router as onboarding_router
from app.api.routes.public_galleries import (
    router as public_galleries_router,
)
from app.api.routes.public_website import (
    router as public_website_router,
)
from app.api.routes.uploads import router as uploads_router
from app.api.routes.website import router as website_router
from app.api.routes.workspaces import router as workspaces_router
from app.api.routes.gallery_trash import (
    router as gallery_trash_router,
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