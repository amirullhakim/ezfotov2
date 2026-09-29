import { redirect } from "next/navigation"

import PlatformAdminAccess from "@/components/dashboard/PlatformAdminAccess"
import WorkspaceDashboard from "@/components/dashboard/WorkspaceDashboard"
import { createClient } from "@/lib/supabase/server"


export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  return (
    <>
      <PlatformAdminAccess />

      <WorkspaceDashboard
        email={user.email ?? ""}
      />
    </>
  )
}