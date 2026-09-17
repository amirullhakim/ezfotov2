from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import settings


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description=(
        "Backend API for the EZFOTOO "
        "photography business platform."
    ),
    debug=settings.debug,
)


# --------------------------------------------------
# CORS
# --------------------------------------------------
#
# Explicit origins:
# - local development
# - main marketing domain
# - photographer application
# - stable Vercel deployment
#
# Tenant photographer domains are allowed through
# allow_origin_regex below.
#
# Example:
# mirulphotography.ezfotoo.com
# testphotographyxxxx.ezfotoo.com
#
allowed_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://ezfotoo.com",
    "https://www.ezfotoo.com",
    "https://app.ezfotoo.com",
    "https://ezfotoo.vercel.app",
]


if settings.frontend_url:
    frontend_origin = (
        str(
            settings.frontend_url
        )
        .rstrip("/")
    )

    if (
        frontend_origin
        not in allowed_origins
    ):
        allowed_origins.append(
            frontend_origin
        )


app.add_middleware(
    CORSMiddleware,

    allow_origins=
        allowed_origins,

    # Allow photographer tenant subdomains:
    #
    # photographer.ezfotoo.com
    #
    # but exclude infrastructure/reserved
    # subdomains.
    allow_origin_regex=(
        r"^https://"
        r"(?!(?:www|app|api|media|jobs|admin|support)"
        r"\.ezfotoo\.com$)"
        r"[a-z0-9-]+\.ezfotoo\.com$"
    ),

    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get(
    "/",
    tags=["Root"],
)
def root():
    return {
        "name":
            settings.app_name,

        "version":
            settings.app_version,

        "message":
            "EZFOTOO API is running.",
    }


app.include_router(
    api_router,
    prefix="/api",
)