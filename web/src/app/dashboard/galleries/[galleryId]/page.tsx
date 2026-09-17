import { redirect } from "next/navigation"

import GalleryDetailManager from "@/components/galleries/GalleryDetailManager"
import { createClient } from "@/lib/supabase/server"


export default async function GalleryDetailPage({
  params,
}: {
  params: Promise<{
    galleryId: string
  }>
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const {
    galleryId,
  } = await params

  return (
    <GalleryDetailManager
      galleryId={galleryId}
    />
  )
}