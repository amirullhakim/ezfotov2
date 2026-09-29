import { redirect } from "next/navigation"

import SalesAnalytics from "@/components/analytics/SalesAnalytics"
import { createClient } from "@/lib/supabase/server"

export default async function AnalyticsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  return <SalesAnalytics />
}