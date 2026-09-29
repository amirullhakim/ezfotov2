import { redirect } from "next/navigation"

import OrderManager from "@/components/orders/OrderManager"
import { createClient } from "@/lib/supabase/server"


export default async function OrdersPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  return <OrderManager />
}