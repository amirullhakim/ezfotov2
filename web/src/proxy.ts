import {
  NextResponse,
  type NextRequest,
} from "next/server"

import { updateSession } from "@/lib/supabase/proxy"


const ROOT_DOMAIN =
  "ezfotoo.com"


const RESERVED_SUBDOMAINS =
  new Set([
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
    request.headers.get(
      "host"
    ) ??
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
    !hostname.endsWith(
      suffix
    )
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
    getHostname(
      request
    )

  const pathname =
    request.nextUrl.pathname


  // --------------------------------------------------
  // ROOT MARKETING DOMAIN
  // --------------------------------------------------

  if (
    (
      hostname ===
        ROOT_DOMAIN ||
      hostname ===
        `www.${ROOT_DOMAIN}`
    ) &&
    isAppPath(
      pathname
    )
  ) {
    const url =
      request.nextUrl.clone()

    url.hostname =
      `app.${ROOT_DOMAIN}`

    url.protocol =
      "https:"

    return NextResponse.redirect(
      url
    )
  }


  // --------------------------------------------------
  // PHOTOGRAPHER APP
  // --------------------------------------------------

  if (
    hostname ===
      `app.${ROOT_DOMAIN}` &&
    pathname === "/"
  ) {
    const url =
      request.nextUrl.clone()

    url.pathname =
      "/login"

    return NextResponse.redirect(
      url
    )
  }


  // --------------------------------------------------
  // TENANT DOMAIN
  // --------------------------------------------------

  const tenantSlug =
    getTenantSlug(
      hostname
    )


  if (tenantSlug) {

    // Prevent rewriting an already-internal
    // tenant route.
    if (
      pathname.startsWith(
        "/site/"
      )
    ) {
      return NextResponse.next()
    }


    // ----------------------------------------------
    // CLIENT GALLERY
    // ----------------------------------------------
    //
    // tenant.ezfotoo.com/gallery/wedding
    //
    // internally becomes:
    //
    // /site/tenant/gallery/wedding
    //
    if (
      pathname.startsWith(
        "/gallery/"
      )
    ) {
      const url =
        request.nextUrl.clone()

      url.pathname =
        `/site/${tenantSlug}${pathname}`

      return NextResponse.rewrite(
        url
      )
    }


    // ----------------------------------------------
    // EVENT SALES
    // ----------------------------------------------
    //
    // tenant.ezfotoo.com/event/kl-marathon-2026
    //
    // internally becomes:
    //
    // /site/tenant/event/kl-marathon-2026
    //
    if (
      pathname.startsWith(
        "/event/"
      )
    ) {
      const url =
        request.nextUrl.clone()

      url.pathname =
        `/site/${tenantSlug}${pathname}`

      return NextResponse.rewrite(
        url
      )
    }


    // ----------------------------------------------
    // PHOTOGRAPHER WEBSITE
    // ----------------------------------------------
    //
    // tenant.ezfotoo.com/
    //
    // internally becomes:
    //
    // /site/tenant
    //
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