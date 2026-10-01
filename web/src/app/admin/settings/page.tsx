import { redirect } from "next/navigation"
import AdminSettingsDashboard from "@/components/admin/AdminSettingsDashboard"
import { createClient } from "@/lib/supabase/server"

export default async function AdminSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")
  // The admin API independently checks the active platform-admin profile.
  return <AdminSettingsDashboard />
}
