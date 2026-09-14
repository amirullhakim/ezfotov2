import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import OnboardingForm from "./OnboardingForm"


export default async function OnboardingPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const fullName =
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : ""

  return (
    <OnboardingForm
      initialFullName={fullName}
      email={user.email ?? ""}
    />
  )
}