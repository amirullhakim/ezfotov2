import { redirect } from "next/navigation"

import PlatformAdminDashboard from "@/components/admin/PlatformAdminDashboard"
import { createClient } from "@/lib/supabase/server"


export default async function AdminPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  return (
    <PlatformAdminDashboard
      email={user.email ?? ""}
    />
  )
}