import { redirect } from "next/navigation"

import WebsiteStudio from "@/components/website/WebsiteStudio"
import { createClient } from "@/lib/supabase/server"


export default async function WebsitePage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  return <WebsiteStudio />
}