import { redirect } from "next/navigation"

import EventDetailManager from "@/components/events/EventDetailManager"

import { createClient } from "@/lib/supabase/server"


export default async function EventDetailPage({
  params,
}: {
  params: Promise<{
    eventId: string
  }>
}) {
  const {
    eventId,
  } =
    await params


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
    <EventDetailManager
      eventId={
        eventId
      }
    />
  )
}