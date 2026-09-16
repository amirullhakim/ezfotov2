import logging
from typing import Any
from urllib.parse import quote

import httpx

from app.core.config import settings


logger = logging.getLogger(__name__)


class VercelDomainProvisionError(Exception):
    """Raised when EZFOTOO cannot provision a tenant domain in Vercel."""


def _require_vercel_config() -> tuple[str, str]:
    if not settings.vercel_access_token:
        raise VercelDomainProvisionError(
            "VERCEL_ACCESS_TOKEN is not configured."
        )

    if not settings.vercel_project_id:
        raise VercelDomainProvisionError(
            "VERCEL_PROJECT_ID is not configured."
        )

    return (
        settings.vercel_access_token,
        settings.vercel_project_id,
    )


def _headers() -> dict[str, str]:
    access_token, _ = _require_vercel_config()

    return {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
    }


def _project_domain_url(
    hostname: str | None = None,
) -> str:
    _, project_id = _require_vercel_config()

    encoded_project_id = quote(
        project_id,
        safe="",
    )

    base_url = (
        "https://api.vercel.com/v9/projects/"
        f"{encoded_project_id}/domains"
    )

    if hostname:
        encoded_hostname = quote(
            hostname,
            safe="",
        )

        return (
            f"{base_url}/"
            f"{encoded_hostname}"
        )

    return base_url


def get_vercel_project_domain(
    hostname: str,
) -> dict[str, Any] | None:
    """
    Return the Vercel project-domain record if this
    hostname is already attached to the EZFOTOO project.
    """

    try:
        response = httpx.get(
            _project_domain_url(
                hostname
            ),
            headers=_headers(),
            timeout=15.0,
        )

    except httpx.HTTPError as exc:
        raise VercelDomainProvisionError(
            "Unable to contact Vercel."
        ) from exc

    if response.status_code == 404:
        return None

    if response.status_code != 200:
        raise VercelDomainProvisionError(
            _extract_vercel_error(
                response
            )
        )

    return response.json()


def provision_vercel_domain(
    hostname: str,
) -> dict[str, Any]:
    """
    Attach a photographer hostname such as
    mirulphotography.ezfotoo.com to the EZFOTOO
    Vercel project.

    This function is idempotent:
    if the hostname is already attached to the
    project, it returns the existing domain record.
    """

    normalized_hostname = (
        hostname.strip().lower()
    )

    if not normalized_hostname:
        raise VercelDomainProvisionError(
            "Hostname is required."
        )

    existing = (
        get_vercel_project_domain(
            normalized_hostname
        )
    )

    if existing:
        return existing

    try:
        response = httpx.post(
            _project_domain_url(),
            headers=_headers(),
            json={
                "name": normalized_hostname,
            },
            timeout=20.0,
        )

    except httpx.HTTPError as exc:
        raise VercelDomainProvisionError(
            "Unable to contact Vercel."
        ) from exc

    if response.status_code in {
        200,
        201,
    }:
        return response.json()

    # Vercel may report that the domain already
    # exists. Before treating that as success,
    # verify that it is actually attached to OUR
    # EZFOTOO project.
    try:
        payload = response.json()
    except ValueError:
        payload = {}

    error = payload.get(
        "error",
        {}
    )

    error_code = error.get(
        "code"
    )

    if error_code in {
        "not_modified",
        "already_exists",
    }:
        existing = (
            get_vercel_project_domain(
                normalized_hostname
            )
        )

        if existing:
            return existing

    raise VercelDomainProvisionError(
        _extract_vercel_error(
            response
        )
    )


def _extract_vercel_error(
    response: httpx.Response,
) -> str:
    try:
        payload = response.json()

    except ValueError:
        return (
            "Vercel domain provisioning failed "
            f"with HTTP {response.status_code}."
        )

    error = payload.get(
        "error"
    )

    if isinstance(error, dict):
        message = error.get(
            "message"
        )

        code = error.get(
            "code"
        )

        if message and code:
            return (
                f"{message} "
                f"({code})"
            )

        if message:
            return str(message)

    return (
        "Vercel domain provisioning failed "
        f"with HTTP {response.status_code}."
    )