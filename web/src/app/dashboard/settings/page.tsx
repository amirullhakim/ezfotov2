import { redirect } from "next/navigation"
import WorkspaceSettings from "@/components/settings/WorkspaceSettings"
import { createClient } from "@/lib/supabase/server"

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")
  return <WorkspaceSettings />
}
