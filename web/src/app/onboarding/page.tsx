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


  let alreadyOnboarded = false


  // --------------------------------------------------
  // CHECK EXISTING WORKSPACE
  // --------------------------------------------------
  //
  // Important:
  // Do NOT call redirect() inside this try/catch.
  // Next.js redirects work by throwing a special
  // NEXT_REDIRECT exception.
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


          alreadyOnboarded =
            workspace.onboarded === true &&
            workspace.workspace !== null
        }
      }

    } catch (error) {
      console.error(
        "Unable to check onboarding status:",
        error
      )
    }
  }


  // --------------------------------------------------
  // EXISTING PHOTOGRAPHER
  // --------------------------------------------------
  //
  // Redirect OUTSIDE the try/catch so Next.js
  // can handle NEXT_REDIRECT correctly.
  //
  if (alreadyOnboarded) {
    redirect("/dashboard")
  }


  // --------------------------------------------------
  // NEW PHOTOGRAPHER
  // --------------------------------------------------

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