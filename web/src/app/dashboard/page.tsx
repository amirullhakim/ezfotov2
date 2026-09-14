import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import WorkspaceDashboard from "@/components/dashboard/WorkspaceDashboard"


export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  return (
    <WorkspaceDashboard
      email={user.email ?? ""}
    />
  )
}