import { redirect } from "next/navigation"

import BillingDashboard from "@/components/billing/BillingDashboard"
import { createClient } from "@/lib/supabase/server"

export default async function BillingPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  return <BillingDashboard />
}