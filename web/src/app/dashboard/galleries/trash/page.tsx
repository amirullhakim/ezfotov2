import { redirect } from "next/navigation"

import GalleryTrashManager from "@/components/galleries/GalleryTrashManager"
import { createClient } from "@/lib/supabase/server"


export default async function GalleryTrashPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  return <GalleryTrashManager />
}
