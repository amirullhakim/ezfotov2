import { notFound } from "next/navigation"

import PublicClientGallery from "@/components/galleries/PublicClientGallery"


type PageProps = {
  params: Promise<{
    slug: string
    gallerySlug: string
  }>

  searchParams: Promise<{
    t?: string | string[]
  }>
}


export default async function PublicGalleryPage({
  params,
  searchParams,
}: PageProps) {
  const {
    slug,
    gallerySlug,
  } = await params


  const query =
    await searchParams


  const rawToken =
    query.t


  const privateToken =
    Array.isArray(
      rawToken
    )
      ? rawToken[0]
      : rawToken


  const apiUrl =
    process.env
      .NEXT_PUBLIC_API_URL ??
    "http://127.0.0.1:8000"


  let endpoint =
    `${apiUrl}` +
    `/api/public/galleries/` +
    `${encodeURIComponent(slug)}/` +
    `${encodeURIComponent(gallerySlug)}`


  if (privateToken) {
    endpoint +=
      `?t=${encodeURIComponent(
        privateToken
      )}`
  }


  const response =
    await fetch(
      endpoint,
      {
        cache: "no-store",
      }
    )


  if (
    response.status === 404
  ) {
    notFound()
  }


  let initialError = ""


  if (
    response.status === 403 ||
    response.status === 410
  ) {
    try {
      const body =
        await response.json()

      initialError =
        typeof body.detail ===
        "string"
          ? body.detail
          : "Gallery unavailable."

    } catch {
      initialError =
        "Gallery unavailable."
    }


    return (
      <PublicClientGallery
        workspaceSlug={
          slug
        }
        gallerySlug={
          gallerySlug
        }
        privateToken={
          privateToken ?? null
        }
        initialData={
          null
        }
        initialError={
          initialError
        }
      />
    )
  }


  if (!response.ok) {
    throw new Error(
      "Unable to load client gallery."
    )
  }


  const gallery =
    await response.json()


  return (
    <PublicClientGallery
      workspaceSlug={
        slug
      }
      gallerySlug={
        gallerySlug
      }
      privateToken={
        privateToken ?? null
      }
      initialData={
        gallery
      }
      initialError=""
    />
  )
}