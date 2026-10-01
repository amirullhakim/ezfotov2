import { redirect } from "next/navigation"
import { AdminSubscriptionDashboard } from "@/components/billing/SubscriptionPaymentHistory"
import { createClient } from "@/lib/supabase/server"

export default async function AdminBillingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")
  // The API independently requires an active platform-admin profile.
  return <AdminSubscriptionDashboard />
}
