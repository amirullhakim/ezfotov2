import { notFound } from "next/navigation"

import PublicPhotographySite from "@/components/website/PublicPhotographySite"


type PageProps = {
  params: Promise<{
    slug: string
  }>
}


export default async function PublicSitePage({
  params,
}: PageProps) {
  const { slug } = await params

  const apiUrl =
    process.env.NEXT_PUBLIC_API_URL ??
    "http://127.0.0.1:8000"


  const response = await fetch(
    `${apiUrl}/api/public/sites/${encodeURIComponent(slug)}`,
    {
      cache: "no-store",
    }
  )


  if (response.status === 404) {
    notFound()
  }


  if (!response.ok) {
    throw new Error(
      "Unable to load photographer website."
    )
  }


  const site = await response.json()


  return (
    <PublicPhotographySite
      site={site}
    />
  )
}
