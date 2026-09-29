"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { FormEvent, useState } from "react"
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  Globe2,
  Loader2,
  MailCheck,
} from "lucide-react"

import { AuthShell } from "@/components/AuthShell"
import WorkspaceAddressField, {
  AddressAvailability,
  checkWorkspaceAddress,
  suggestWorkspaceSlug,
} from "@/components/WorkspaceAddressField"
import { createClient } from "@/lib/supabase/client"

const inputClass =
  "h-12 w-full rounded-xl border border-[#DCE7EA] bg-white px-4 text-[15px] text-[#183640] outline-none transition placeholder:text-[#A8B5BA] focus:border-[#33C7D3] focus:ring-4 focus:ring-[#1CC9D8]/10"

export default function RegisterPage() {
  const router = useRouter()
  const supabase = createClient()

  const [step, setStep] = useState<1 | 2>(1)
  const [businessName, setBusinessName] = useState("")
  const [slug, setSlug] = useState("")
  const [slugEdited, setSlugEdited] = useState(false)

  const [availability, setAvailability] =
    useState<AddressAvailability | null>(null)

  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)

  const addressAvailable =
    availability?.slug === slug && availability.available

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault()
    if (loading) return

    setError("")

    const business = businessName.trim().replace(/\s+/g, " ")

    if (business.length < 2) {
      setStep(1)
      setError(
        "Enter a business name with at least 2 characters."
      )
      return
    }

    setLoading(true)

    try {
      const checked = await checkWorkspaceAddress(slug)
      setAvailability(checked)

      if (!checked.available) {
        setStep(1)
        setError(
          checked.reason ||
            "Please choose another workspace address."
        )
        return
      }

      if (step === 1) {
        setStep(2)
        return
      }

      const name = fullName.trim().replace(/\s+/g, " ")

      if (name.length < 2) {
        setError(
          "Enter your full name using at least 2 characters."
        )
        return
      }

      const { data, error: signUpError } =
        await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo:
              `${window.location.origin}/auth/callback?next=/onboarding`,
            data: {
              full_name: name,
              workspace_business_name: business,
              workspace_slug: checked.slug,
            },
          },
        })

      if (signUpError) throw signUpError

      setPassword("")

      if (data.session) {
        router.replace("/onboarding")
        router.refresh()
      } else {
        setSuccess(true)
      }
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to continue. Please try again."
      )
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <AuthShell>
        <div className="rounded-3xl border border-[#DDEBED] bg-white p-7 sm:p-9">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#E4F8F9]">
            <MailCheck className="h-7 w-7 text-[#0CA8B7]" />
          </div>

          <h1 className="mt-6 text-3xl font-semibold tracking-tight text-[#112D38]">
            Check your email
          </h1>

          <p className="mt-3 leading-7 text-[#667A83]">
            Use the verification link sent to{" "}
            <strong className="break-all font-semibold text-[#314C56]">
              {email.trim()}
            </strong>{" "}
            to continue.
          </p>

          <div className="mt-6 rounded-2xl bg-[#F2FAFB] p-4">
            <p className="font-semibold text-[#234650]">
              {businessName.trim()}
            </p>
            <p className="mt-1 break-all text-sm text-[#087F8C]">
              {availability?.hostname || `${slug}.ezfotoo.com`}
            </p>
          </div>

          <p className="mt-4 text-sm leading-6 text-[#82939A]">
            Your workspace details will be ready to review
            after verification. Availability is checked again
            when you finish setup.
          </p>

          <Link
            href="/login"
            className="mt-7 inline-flex items-center gap-2 font-semibold text-[#087F8C]"
          >
            Back to sign in
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell>
      <ol
        aria-label="Registration progress"
        className="mb-8 flex items-center gap-4 text-sm"
      >
        <li
          aria-current={step === 1 ? "step" : undefined}
          className="flex items-center gap-2 font-semibold text-[#087F8C]"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#E3F7F8]">
            {step === 2 ? <Check className="h-4 w-4" /> : "1"}
          </span>
          Workspace
        </li>

        <li
          aria-hidden="true"
          className="h-px flex-1 bg-[#DCE9EC]"
        />

        <li
          aria-current={step === 2 ? "step" : undefined}
          className={`flex items-center gap-2 font-semibold ${
            step === 2 ? "text-[#087F8C]" : "text-[#94A4AA]"
          }`}
        >
          <span
            className={`flex h-8 w-8 items-center justify-center rounded-full ${
              step === 2 ? "bg-[#E3F7F8]" : "bg-[#F1F5F6]"
            }`}
          >
            2
          </span>
          Account
        </li>
      </ol>

      <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#0CA8B7]">
        Your business, on EZFOTOO
      </p>

      <h1 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-[#112D38] sm:text-4xl">
        {step === 1
          ? "Choose your workspace."
          : "Create your account."}
      </h1>

      <p className="mt-3 text-sm leading-6 text-[#667A83]">
        {step === 1
          ? "Choose your business name and address."
          : "One account to manage your website, galleries and event photo sales."}
      </p>

      <form onSubmit={handleSubmit} className="mt-7 space-y-5">
        {error && (
          <div
            role="alert"
            className="rounded-xl border border-[#F0CDD1] bg-[#FFF7F8] px-4 py-3 text-sm text-[#A6424E]"
          >
            {error}
          </div>
        )}

        {step === 1 ? (
          <>
            <div>
              <label
                htmlFor="business-name"
                className="mb-2 block text-sm font-semibold text-[#314C56]"
              >
                Business or studio name
              </label>

              <input
                id="business-name"
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
          </>
        ) : (
          <>
            <div className="flex items-start gap-3 rounded-2xl border border-[#D7ECEF] bg-[#F2FAFB] p-4">
              <Globe2 className="mt-1 h-5 w-5 shrink-0 text-[#0A929F]" />

              <div className="min-w-0 flex-1">
                <p className="font-semibold text-[#234650]">
                  {businessName.trim()}
                </p>
                <p className="mt-1 break-all text-xs text-[#087F8C]">
                  {availability?.hostname ||
                    `${slug}.ezfotoo.com`}
                </p>
              </div>

              <button
                type="button"
                disabled={loading}
                onClick={() => {
                  setStep(1)
                  setError("")
                }}
                className="text-xs font-semibold text-[#087F8C] hover:underline"
              >
                Edit
              </button>
            </div>

            <div>
              <label
                htmlFor="full-name"
                className="mb-2 block text-sm font-semibold text-[#314C56]"
              >
                Full name
              </label>
              <input
                id="full-name"
                value={fullName}
                onChange={(event) =>
                  setFullName(event.target.value)
                }
                required
                minLength={2}
                maxLength={255}
                disabled={loading}
                autoComplete="name"
                placeholder="Your full name"
                className={inputClass}
              />
            </div>

            <div>
              <label
                htmlFor="register-email"
                className="mb-2 block text-sm font-semibold text-[#314C56]"
              >
                Email address
              </label>
              <input
                id="register-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                disabled={loading}
                autoComplete="email"
                placeholder="you@example.com"
                className={inputClass}
              />
            </div>

            <div>
              <label
                htmlFor="register-password"
                className="mb-2 block text-sm font-semibold text-[#314C56]"
              >
                Password
              </label>

              <div className="relative">
                <input
                  id="register-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) =>
                    setPassword(event.target.value)
                  }
                  required
                  minLength={8}
                  disabled={loading}
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                  className={`${inputClass} pr-12`}
                />

                <button
                  type="button"
                  aria-label={
                    showPassword ? "Hide password" : "Show password"
                  }
                  aria-pressed={showPassword}
                  onClick={() =>
                    setShowPassword((value) => !value)
                  }
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-2 text-[#7B8E95] hover:bg-[#F1F7F8]"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          </>
        )}

        <button
          type="submit"
          disabled={
            loading || (step === 1 && !addressAvailable)
          }
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#073B4C] px-5 font-semibold text-white shadow-[0_12px_24px_rgba(7,59,76,0.14)] transition hover:bg-[#0B5363] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {step === 1
                ? "Checking address..."
                : "Creating account..."}
            </>
          ) : (
            <>
              {step === 1 ? "Continue" : "Create account"}
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>

        {step === 2 && (
          <button
            type="button"
            disabled={loading}
            onClick={() => {
              setStep(1)
              setError("")
            }}
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#71858C]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to workspace
          </button>
        )}
      </form>

      <p className="mt-7 text-center text-sm text-[#758990]">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-semibold text-[#087F8C] hover:text-[#073B4C]"
        >
          Sign in
        </Link>
      </p>
    </AuthShell>
  )
}