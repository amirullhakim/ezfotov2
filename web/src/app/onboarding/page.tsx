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
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const {
    data: { session },
  } = await supabase.auth.getSession()

  let alreadyOnboarded = false

  // Keep redirect outside this try/catch because Next.js
  // implements redirects by throwing a special exception.
  if (session?.access_token) {
    try {
      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "")

      if (apiUrl) {
        const response = await fetch(
          `${apiUrl}/api/workspaces/me`,
          {
            headers: {
              Authorization: `Bearer ${session.access_token}`,
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

  if (alreadyOnboarded) {
    redirect("/dashboard")
  }

  const fullName =
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name.slice(0, 255)
      : ""

  const businessName =
    typeof user.user_metadata?.workspace_business_name === "string"
      ? user.user_metadata.workspace_business_name.slice(0, 255)
      : ""

  const slug =
    typeof user.user_metadata?.workspace_slug === "string"
      ? user.user_metadata.workspace_slug.slice(0, 60)
      : ""

  return (
    <OnboardingForm
      initialFullName={fullName}
      initialBusinessName={businessName}
      initialSlug={slug}
      email={user.email ?? ""}
    />
  )
}