import { redirect } from "next/navigation"

import GalleryManager from "@/components/galleries/GalleryManager"
import { createClient } from "@/lib/supabase/server"


export default async function GalleriesPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  return <GalleryManager />
}