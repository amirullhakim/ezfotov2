import {
  NextResponse,
  type NextRequest,
} from "next/server"

import { updateSession } from "@/lib/supabase/proxy"


const ROOT_DOMAIN = "ezfotoo.com"


const RESERVED_SUBDOMAINS = new Set([
  "www",
  "app",
  "api",
  "media",
  "jobs",
  "admin",
  "support",
])


function getHostname(
  request: NextRequest
) {
  const forwardedHost =
    request.headers.get(
      "x-forwarded-host"
    )

  const host =
    forwardedHost ??
    request.headers.get("host") ??
    ""

  return host
    .split(":")[0]
    .toLowerCase()
}


function getTenantSlug(
  hostname: string
) {
  const suffix =
    `.${ROOT_DOMAIN}`

  if (
    !hostname.endsWith(suffix)
  ) {
    return null
  }

  const subdomain =
    hostname.slice(
      0,
      -suffix.length
    )

  if (!subdomain) {
    return null
  }

  // Do not treat nested subdomains
  // as photographer workspaces.
  if (
    subdomain.includes(".")
  ) {
    return null
  }

  if (
    RESERVED_SUBDOMAINS.has(
      subdomain
    )
  ) {
    return null
  }

  return subdomain
}


export async function proxy(
  request: NextRequest
) {
  const hostname =
    getHostname(request)

  const pathname =
    request.nextUrl.pathname


  // --------------------------------------------------
  // Photographer application
  // --------------------------------------------------
  //
  // app.ezfotoo.com
  //      ↓
  // /login
  //
  if (
    hostname ===
      `app.${ROOT_DOMAIN}` &&
    pathname === "/"
  ) {
    const url =
      request.nextUrl.clone()

    url.pathname = "/login"

    return NextResponse.redirect(
      url
    )
  }


  // --------------------------------------------------
  // Photographer tenant website
  // --------------------------------------------------
  //
  // mirulphotography.ezfotoo.com
  //               ↓
  // slug = mirulphotography
  //               ↓
  // /site/mirulphotography
  //
  const tenantSlug =
    getTenantSlug(hostname)


  if (tenantSlug) {
    // Prevent any accidental rewrite loop.
    if (
      pathname.startsWith(
        "/site/"
      )
    ) {
      return NextResponse.next()
    }


    const url =
      request.nextUrl.clone()

    url.pathname =
      `/site/${tenantSlug}`

    return NextResponse.rewrite(
      url
    )
  }


  // --------------------------------------------------
  // Normal EZFOTOO application
  // --------------------------------------------------
  //
  // ezfotoo.com
  // app.ezfotoo.com/login
  // app.ezfotoo.com/dashboard
  //
  // Continue using our existing
  // Supabase session handling.
  //
  return await updateSession(
    request
  )
}


export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}