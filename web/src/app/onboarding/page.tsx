import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"


import OnboardingForm from "./OnboardingForm"


type WorkspaceResponse = {
  onboarded: boolean

  workspace: {
    id: string
    name: string
    slug: string
  } | null
}


export default async function OnboardingPage() {
  const supabase =
    await createClient()


  const {
    data: { user },
  } =
    await supabase.auth.getUser()


  if (!user) {
    redirect("/login")
  }


  const {
    data: { session },
  } =
    await supabase.auth.getSession()


  // -----------------------------------------------
  // EXISTING PHOTOGRAPHER
  // -----------------------------------------------
  //
  // If this account already owns/belongs to
  // a workspace, onboarding should never appear.
  //
  if (session?.access_token) {
    try {
      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL


      if (apiUrl) {
        const response =
          await fetch(
            `${apiUrl}/api/workspaces/me`,
            {
              headers: {
                Authorization:
                  `Bearer ${session.access_token}`,
              },

              cache: "no-store",
            }
          )


        if (response.ok) {
          const workspace =
            (await response.json()) as WorkspaceResponse


          if (
            workspace.onboarded &&
            workspace.workspace
          ) {
            redirect("/dashboard")
          }
        }
      }
    } catch (error) {
      // Do not treat a temporary API problem as
      // proof that the user needs a new workspace.
      //
      // The onboarding form/API still protects
      // against duplicate workspace creation.
      console.error(
        "Unable to check onboarding status:",
        error
      )
    }
  }


  const fullName =
    typeof user.user_metadata
      ?.full_name === "string"
      ? user.user_metadata.full_name
      : ""


  return (
    <OnboardingForm
      initialFullName={fullName}
      email={user.email ?? ""}
    />
  )
}