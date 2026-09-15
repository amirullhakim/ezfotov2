from fastapi import APIRouter

from app.api.routes.admin import router as admin_router
from app.api.routes.auth import router as auth_router
from app.api.routes.health import router as health_router
from app.api.routes.onboarding import router as onboarding_router
from app.api.routes.public_website import router as public_website_router
from app.api.routes.uploads import router as uploads_router
from app.api.routes.website import router as website_router
from app.api.routes.workspaces import router as workspaces_router


api_router = APIRouter()

api_router.include_router(health_router)
api_router.include_router(auth_router)
api_router.include_router(onboarding_router)
api_router.include_router(workspaces_router)
api_router.include_router(admin_router)
api_router.include_router(website_router)
api_router.include_router(public_website_router)
api_router.include_router(uploads_router)