import { redirect } from "next/navigation"

import EventManager from "@/components/events/EventManager"

import { createClient } from "@/lib/supabase/server"


export default async function EventsPage() {
  const supabase =
    await createClient()

  const {
    data: {
      user,
    },
  } =
    await supabase.auth.getUser()


  if (!user) {
    redirect(
      "/login"
    )
  }


  return (
    <EventManager />
  )
}