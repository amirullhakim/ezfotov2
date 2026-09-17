from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # --------------------------------------------------
    # Application
    # --------------------------------------------------
    app_name: str = "EZFOTOO API"
    app_version: str = "2.0.0"
    app_environment: str = "development"
    debug: bool = True

    # --------------------------------------------------
    # API
    # --------------------------------------------------
    api_host: str = "0.0.0.0"
    api_port: int = 8000

    # --------------------------------------------------
    # Frontend
    # --------------------------------------------------
    frontend_url: str = "http://localhost:3000"

    # --------------------------------------------------
    # Database
    # --------------------------------------------------
    database_url: str | None = None

    # --------------------------------------------------
    # Supabase
    # --------------------------------------------------
    supabase_url: str | None = None
    supabase_publishable_key: str | None = None
    supabase_secret_key: str | None = None

    # --------------------------------------------------
    # Cloudflare R2 - Public Media
    # --------------------------------------------------
    r2_account_id: str | None = None
    r2_access_key_id: str | None = None
    r2_secret_access_key: str | None = None
    r2_bucket_name: str | None = None
    r2_public_url: str | None = None

    # --------------------------------------------------
    # Cloudflare R2 - Private Media
    # --------------------------------------------------
    r2_private_access_key_id: str | None = None
    r2_private_secret_access_key: str | None = None
    r2_private_bucket_name: str | None = None

    # --------------------------------------------------
    # Vercel
    # --------------------------------------------------
    vercel_access_token: str | None = None
    vercel_project_id: str | None = None
    vercel_root_domain: str = "ezfotoo.com"

    # --------------------------------------------------
    # Redis
    # --------------------------------------------------
    redis_url: str | None = None

    # --------------------------------------------------
    # Email
    # --------------------------------------------------
    resend_api_key: str | None = None

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()