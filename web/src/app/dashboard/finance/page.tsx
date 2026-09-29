import { redirect } from "next/navigation"

import FinanceDashboard from "@/components/finance/FinanceDashboard"
import { createClient } from "@/lib/supabase/server"


export default async function FinancePage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  return <FinanceDashboard />
}