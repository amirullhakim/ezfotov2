"use client"

import {
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  Globe2,
  Loader2,
  LockKeyhole,
  Sparkles,
  X,
} from "lucide-react"
import { useRouter } from "next/navigation"
import {
  FormEvent,
  useEffect,
  useState,
} from "react"

import { EzfotooBrand } from "@/components/brand/EzfotooBrand"
import { apiFetch } from "@/lib/api"


type Props = {
  initialFullName: string
  email: string
}


type SlugResponse = {
  slug: string
  available: boolean
}


type WorkspaceResponse = {
  onboarded: boolean
}


function createSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-")
}


export default function OnboardingForm({
  initialFullName,
  email,
}: Props) {
  const router = useRouter()

  const [fullName, setFullName] =
    useState(initialFullName)

  const [businessName, setBusinessName] =
    useState("")

  const [slug, setSlug] =
    useState("")

  const [slugWasEdited, setSlugWasEdited] =
    useState(false)

  const [checkingSlug, setCheckingSlug] =
    useState(false)

  const [slugAvailable, setSlugAvailable] =
    useState<boolean | null>(null)

  const [loading, setLoading] =
    useState(false)

  const [error, setError] =
    useState("")


  useEffect(() => {
    async function checkExistingWorkspace() {
      try {
        const result =
          await apiFetch<WorkspaceResponse>(
            "/api/workspaces/me"
          )

        if (result.onboarded) {
          router.replace("/dashboard")
        }
      } catch {
        // User can continue onboarding.
      }
    }

    checkExistingWorkspace()
  }, [router])


  useEffect(() => {
    if (!slugWasEdited) {
      setSlug(
        createSlug(businessName)
      )
    }
  }, [
    businessName,
    slugWasEdited,
  ])


  useEffect(() => {
    if (slug.length < 3) {
      setSlugAvailable(null)
      return
    }

    setCheckingSlug(true)
    setSlugAvailable(null)

    const timer = setTimeout(
      async () => {
        try {
          const result =
            await apiFetch<SlugResponse>(
              `/api/onboarding/slug/${encodeURIComponent(slug)}`
            )

          setSlugAvailable(
            result.available
          )
        } catch {
          setSlugAvailable(null)
        } finally {
          setCheckingSlug(false)
        }
      },
      450
    )

    return () => {
      clearTimeout(timer)
    }
  }, [slug])


  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault()

    setError("")

    if (!slugAvailable) {
      setError(
        "Please choose an available workspace address."
      )
      return
    }

    setLoading(true)

    try {
      await apiFetch(
        "/api/onboarding/complete",
        {
          method: "POST",
          body: JSON.stringify({
            full_name: fullName,
            business_name: businessName,
            slug,
          }),
        }
      )

      router.push("/dashboard")
      router.refresh()

    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to create workspace."
      )

      setLoading(false)
    }
  }


  return (
    <main className="min-h-screen bg-[#F7FAFB]">

      <header className="border-b border-[#E6EEF0] bg-white/90 backdrop-blur">
        <div className="ez-container flex h-[76px] items-center justify-between">

          <EzfotooBrand />

          <div className="text-right">
            <p className="text-sm font-semibold text-[#304B55]">
              {email}
            </p>

            <p className="mt-0.5 text-xs text-[#82939A]">
              New photographer account
            </p>
          </div>

        </div>
      </header>


      <section className="ez-container py-14 lg:py-20">

        <div className="mx-auto max-w-[1080px]">

          <div className="mb-12 max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#CDEDEF] bg-[#F0FBFC] px-4 py-2 text-sm font-semibold text-[#087F8C]">
              <Sparkles className="h-4 w-4" />
              Workspace setup
            </div>

            <h1 className="text-[42px] font-semibold leading-[1.08] tracking-[-0.045em] text-[#112D38]">
              Set up your photography business.
            </h1>

            <p className="mt-5 max-w-xl text-[16px] leading-7 text-[#667A83]">
              Your workspace will become the home for
              your website, client galleries and event
              photo sales.
            </p>
          </div>


          <div className="grid gap-8 lg:grid-cols-[1fr_340px]">

            <form
              onSubmit={handleSubmit}
              className="ez-card p-7 sm:p-9"
            >

              {error && (
                <div className="mb-7 rounded-2xl border border-[#F0CDD1] bg-[#FFF7F8] px-4 py-3 text-sm text-[#A6424E]">
                  {error}
                </div>
              )}


              <div className="space-y-7">

                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-[#0CA8B7]" />

                    <label className="text-sm font-semibold text-[#314C56]">
                      Your name
                    </label>
                  </div>

                  <input
                    value={fullName}
                    onChange={(event) =>
                      setFullName(
                        event.target.value
                      )
                    }
                    required
                    className="h-12 w-full rounded-xl border border-[#DCE7EA] bg-white px-4 text-[#183640] outline-none transition focus:border-[#33C7D3] focus:ring-4 focus:ring-[#1CC9D8]/10"
                  />
                </div>


                <div>
                  <label className="mb-2 block text-sm font-semibold text-[#314C56]">
                    Photography business name
                  </label>

                  <input
                    value={businessName}
                    onChange={(event) =>
                      setBusinessName(
                        event.target.value
                      )
                    }
                    required
                    placeholder="Mirul Photography"
                    className="h-12 w-full rounded-xl border border-[#DCE7EA] bg-white px-4 text-[#183640] outline-none transition placeholder:text-[#A8B5BA] focus:border-[#33C7D3] focus:ring-4 focus:ring-[#1CC9D8]/10"
                  />

                  <p className="mt-2 text-xs leading-5 text-[#89999F]">
                    This is the public name customers
                    will see.
                  </p>
                </div>


                <div>
                  <label className="mb-2 block text-sm font-semibold text-[#314C56]">
                    EZFOTOO address
                  </label>

                  <div className="flex overflow-hidden rounded-xl border border-[#DCE7EA] bg-white focus-within:border-[#33C7D3] focus-within:ring-4 focus-within:ring-[#1CC9D8]/10">

                    <input
                      value={slug}
                      onChange={(event) => {
                        setSlugWasEdited(true)

                        setSlug(
                          createSlug(
                            event.target.value
                          )
                        )
                      }}
                      required
                      minLength={3}
                      maxLength={60}
                      placeholder="mirulphotography"
                      className="h-12 min-w-0 flex-1 bg-transparent px-4 text-[#183640] outline-none"
                    />

                    <div className="flex items-center border-l border-[#E5ECEE] bg-[#F6F9FA] px-4 text-sm font-medium text-[#697E86]">
                      .ezfotoo.com
                    </div>

                  </div>


                  <div className="mt-3 min-h-5">

                    {checkingSlug && (
                      <div className="flex items-center gap-2 text-xs font-medium text-[#758990]">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Checking availability...
                      </div>
                    )}


                    {!checkingSlug &&
                      slugAvailable === true && (
                        <div className="flex items-center gap-2 text-xs font-semibold text-[#188366]">
                          <Check className="h-3.5 w-3.5" />
                          {slug}.ezfotoo.com is available
                        </div>
                      )}


                    {!checkingSlug &&
                      slugAvailable === false && (
                        <div className="flex items-center gap-2 text-xs font-semibold text-[#B74B55]">
                          <X className="h-3.5 w-3.5" />
                          This address is already taken
                        </div>
                      )}

                  </div>
                </div>

              </div>


              <div className="mt-9 flex items-center justify-between border-t border-[#ECF1F2] pt-7">

                <div className="hidden items-center gap-2 text-xs text-[#82939A] sm:flex">
                  <LockKeyhole className="h-4 w-4" />
                  Secure workspace setup
                </div>

                <button
                  type="submit"
                  disabled={
                    loading ||
                    !slugAvailable
                  }
                  className="ml-auto flex h-12 items-center justify-center gap-2 rounded-xl bg-[#073B4C] px-6 font-semibold text-white shadow-[0_12px_24px_rgba(7,59,76,0.14)] transition hover:bg-[#0B5363] disabled:cursor-not-allowed disabled:opacity-50"
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

              </div>

            </form>


            <aside className="space-y-4">

              <div className="ez-card p-6">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#0A909D]">
                  Your workspace
                </p>

                <h2 className="mt-3 text-xl font-semibold tracking-[-0.025em] text-[#15333D]">
                  {businessName ||
                    "Your Photography"}
                </h2>

                <div className="mt-5 flex items-center gap-3 rounded-xl border border-[#E3ECEF] bg-[#F8FBFB] p-3">

                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#E2F7F8]">
                    <Globe2 className="h-4 w-4 text-[#079BA9]" />
                  </div>

                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#84969D]">
                      Reserved address
                    </p>

                    <p className="truncate text-sm font-semibold text-[#31515B]">
                      {slug
                        ? `${slug}.ezfotoo.com`
                        : "yourname.ezfotoo.com"}
                    </p>
                  </div>

                </div>
              </div>


              <div className="rounded-[22px] border border-[#D5EFF1] bg-[#F0FBFC] p-6">

                <CheckCircle2 className="h-6 w-6 text-[#0BA3B1]" />

                <h3 className="mt-4 font-semibold text-[#163A44]">
                  Ready for growth
                </h3>

                <p className="mt-2 text-sm leading-6 text-[#607981]">
                  Your website, galleries and event
                  sales will all live inside this
                  workspace as you activate them.
                </p>

              </div>

            </aside>

          </div>

        </div>

      </section>

    </main>
  )
}