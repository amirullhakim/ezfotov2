import { redirect } from "next/navigation"

import AdminFinanceDashboard from "@/components/admin/AdminFinanceDashboard"
import { createClient } from "@/lib/supabase/server"

export default async function AdminFinancePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  return <AdminFinanceDashboard />
}