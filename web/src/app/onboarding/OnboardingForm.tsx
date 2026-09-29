"use client"

import {
  ArrowRight,
  CheckCircle2,
  Globe2,
  Loader2,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { FormEvent, useEffect, useState } from "react"

import { EzfotooBrand } from "@/components/brand/EzfotooBrand"
import WorkspaceAddressField, {
  AddressAvailability,
  checkWorkspaceAddress,
  suggestWorkspaceSlug,
} from "@/components/WorkspaceAddressField"
import { apiFetch } from "@/lib/api"

type Props = {
  initialFullName: string
  initialBusinessName?: string
  initialSlug?: string
  email: string
}

const inputClass =
  "h-12 w-full rounded-xl border border-[#DCE7EA] bg-white px-4 text-[#183640] outline-none transition placeholder:text-[#A8B5BA] focus:border-[#33C7D3] focus:ring-4 focus:ring-[#1CC9D8]/10"

export default function OnboardingForm({
  initialFullName,
  initialBusinessName = "",
  initialSlug = "",
  email,
}: Props) {
  const router = useRouter()

  const [fullName, setFullName] = useState(initialFullName)
  const [businessName, setBusinessName] =
    useState(initialBusinessName)

  const [slug, setSlug] = useState(
    initialSlug || suggestWorkspaceSlug(initialBusinessName)
  )

  const [slugEdited, setSlugEdited] =
    useState(Boolean(initialSlug))

  const [availability, setAvailability] =
    useState<AddressAvailability | null>(null)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const ready =
    availability?.slug === slug && availability.available

  useEffect(() => {
    let active = true

    async function checkWorkspace() {
      try {
        const workspace = await apiFetch<{
          onboarded: boolean
        }>("/api/workspaces/me")

        if (active && workspace.onboarded) {
          router.replace("/dashboard")
        }
      } catch {
        // Submission will report any remaining
        // connection or access error.
      }
    }

    void checkWorkspace()

    return () => {
      active = false
    }
  }, [router])

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault()
    if (loading) return

    setError("")

    const name = fullName.trim().replace(/\s+/g, " ")
    const business = businessName.trim().replace(/\s+/g, " ")

    if (name.length < 2 || business.length < 2) {
      setError(
        "Your name and business name must each contain at least 2 characters."
      )
      return
    }

    setLoading(true)

    try {
      const checked = await checkWorkspaceAddress(slug)
      setAvailability(checked)

      if (!checked.available) {
        setError(
          checked.reason ||
            "Please choose another workspace address."
        )
        setLoading(false)
        return
      }

      await apiFetch("/api/onboarding/complete", {
        method: "POST",
        body: JSON.stringify({
          full_name: name,
          business_name: business,
          slug: checked.slug,
        }),
      })

      router.replace("/dashboard")
      router.refresh()
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to create your workspace. Please try again."
      )
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#F7FAFB]">
      <header className="border-b border-[#E6EEF0] bg-white">
        <div className="ez-container flex min-h-[76px] flex-wrap items-center justify-between gap-3 py-3">
          <EzfotooBrand />
          <p className="break-all text-sm text-[#667A83]">
            {email}
          </p>
        </div>
      </header>

      <section className="ez-container py-10 lg:py-16">
        <div className="mx-auto max-w-[1000px]">
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#0A929F]">
            Workspace setup
          </p>

          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#112D38] sm:text-4xl">
            {initialSlug
              ? "Your workspace is almost ready."
              : "Create your workspace."}
          </h1>

          <p className="mt-4 max-w-xl text-sm leading-6 text-[#667A83]">
            {initialSlug
              ? "Review the details you chose during registration, then finish setup."
              : "Choose the business name and address your customers will see."}
          </p>

          <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_300px]">
            <form
              onSubmit={handleSubmit}
              className="ez-card space-y-6 p-6 sm:p-8"
            >
              {error && (
                <div
                  role="alert"
                  className="rounded-xl border border-[#F0CDD1] bg-[#FFF7F8] px-4 py-3 text-sm text-[#A6424E]"
                >
                  {error}
                </div>
              )}

              <div>
                <label
                  htmlFor="onboarding-name"
                  className="mb-2 block text-sm font-semibold text-[#314C56]"
                >
                  Your name
                </label>
                <input
                  id="onboarding-name"
                  value={fullName}
                  onChange={(event) =>
                    setFullName(event.target.value)
                  }
                  required
                  minLength={2}
                  maxLength={255}
                  disabled={loading}
                  autoComplete="name"
                  className={inputClass}
                />
              </div>

              <div>
                <label
                  htmlFor="onboarding-business"
                  className="mb-2 block text-sm font-semibold text-[#314C56]"
                >
                  Business or studio name
                </label>
                <input
                  id="onboarding-business"
                  value={businessName}
                  onChange={(event) => {
                    setBusinessName(event.target.value)

                    if (!slugEdited) {
                      setSlug(
                        suggestWorkspaceSlug(event.target.value)
                      )
                      setAvailability(null)
                    }
                  }}
                  required
                  minLength={2}
                  maxLength={255}
                  disabled={loading}
                  autoComplete="organization"
                  placeholder="Mirul Photography"
                  className={inputClass}
                />
              </div>

              <WorkspaceAddressField
                value={slug}
                onChange={(value) => {
                  setSlugEdited(true)
                  setSlug(value)
                  setAvailability(null)
                }}
                result={availability}
                onResult={setAvailability}
                disabled={loading}
              />

              <button
                type="submit"
                disabled={loading || !ready}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#073B4C] px-6 font-semibold text-white transition hover:bg-[#0B5363] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating workspace...
                  </>
                ) : (
                  <>
                    Create workspace
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>

            <aside className="space-y-4">
              <div className="ez-card p-6">
                <Globe2 className="h-6 w-6 text-[#0A929F]" />

                <p className="mt-5 text-xs font-bold uppercase tracking-wide text-[#82939A]">
                  Your workspace
                </p>

                <h2 className="mt-2 break-words text-xl font-semibold text-[#15333D]">
                  {businessName || "Your photography business"}
                </h2>

                <p className="mt-3 break-all text-sm text-[#087F8C]">
                  {availability?.slug === slug
                    ? availability.hostname
                    : `${slug || "your-studio"}.ezfotoo.com`}
                </p>
              </div>

              <div className="rounded-3xl border border-[#D5EFF1] bg-[#F0FBFC] p-6">
                <CheckCircle2 className="h-6 w-6 text-[#0BA3B1]" />

                <h3 className="mt-4 font-semibold text-[#163A44]">
                  Room for your business to grow
                </h3>

                <p className="mt-2 text-sm leading-6 text-[#607981]">
                  Manage your website, client galleries and
                  event photo sales from one workspace as you
                  activate each service.
                </p>
              </div>
            </aside>
          </div>
        </div>
      </section>
    </main>
  )
}