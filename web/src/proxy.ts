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


const APP_PATHS = [
  "/login",
  "/register",
  "/auth",
  "/onboarding",
  "/dashboard",
  "/admin",
]


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


function isAppPath(
  pathname: string
) {
  return APP_PATHS.some(
    (path) =>
      pathname === path ||
      pathname.startsWith(
        `${path}/`
      )
  )
}


export async function proxy(
  request: NextRequest
) {
  const hostname =
    getHostname(request)

  const pathname =
    request.nextUrl.pathname


  // --------------------------------------------------
  // ROOT MARKETING DOMAIN
  // --------------------------------------------------
  //
  // ezfotoo.com/dashboard
  //          ↓
  // app.ezfotoo.com/dashboard
  //
  if (
    (
      hostname === ROOT_DOMAIN ||
      hostname === `www.${ROOT_DOMAIN}`
    ) &&
    isAppPath(pathname)
  ) {
    const url =
      request.nextUrl.clone()

    url.hostname =
      `app.${ROOT_DOMAIN}`

    url.protocol = "https:"

    return NextResponse.redirect(
      url
    )
  }


  // --------------------------------------------------
  // PHOTOGRAPHER APP
  // --------------------------------------------------
  //
  // app.ezfotoo.com
  //      ↓
  // app.ezfotoo.com/login
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
  // TENANT PHOTOGRAPHER WEBSITE
  // --------------------------------------------------
  //
  // mirulphotography.ezfotoo.com
  //               ↓
  // /site/mirulphotography
  //
  const tenantSlug =
    getTenantSlug(hostname)


  if (tenantSlug) {
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
  // SUPABASE SESSION
  // --------------------------------------------------
  return await updateSession(
    request
  )
}


export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}