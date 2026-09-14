"use client"

import Link from "next/link"
import { FormEvent, useState } from "react"
import {
  ArrowRight,
  Eye,
  EyeOff,
  Loader2,
  MailCheck,
} from "lucide-react"

import { AuthShell } from "@/components/AuthShell"
import { createClient } from "@/lib/supabase/client"


export default function RegisterPage() {
  const supabase = createClient()

  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")

  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)


  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault()

    setError("")
    setLoading(true)

    const redirectUrl =
      `${window.location.origin}/auth/callback?next=/onboarding`

    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName.trim(),
        },
      },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setSuccess(true)
    setLoading(false)
  }


  if (success) {
    return (
      <AuthShell>
        <div className="ez-card p-8 sm:p-10">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#E4F8F9]">
            <MailCheck className="h-7 w-7 text-[#0CA8B7]" />
          </div>

          <h1 className="mt-7 text-3xl font-semibold tracking-[-0.035em] text-[#112D38]">
            Check your email
          </h1>

          <p className="mt-3 leading-7 text-[#667A83]">
            We sent a verification link to{" "}
            <strong className="font-semibold text-[#314C56]">
              {email}
            </strong>.
          </p>

          <p className="mt-3 text-sm leading-6 text-[#82939A]">
            Verify your email to continue setting up your
            photography workspace.
          </p>

          <Link
            href="/login"
            className="mt-8 inline-flex items-center gap-2 font-semibold text-[#087F8C] transition hover:text-[#073B4C]"
          >
            Back to login
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </AuthShell>
    )
  }


  return (
    <AuthShell>
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.15em] text-[#0CA8B7]">
          Photographer account
        </p>

        <h1 className="mt-3 text-[36px] font-semibold tracking-[-0.045em] text-[#112D38]">
          Create your workspace
        </h1>

        <p className="mt-3 text-[15px] leading-6 text-[#667A83]">
          Start building your photography presence with EZFOTOO.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="mt-9 space-y-5"
      >
        {error && (
          <div className="rounded-2xl border border-[#F0CDD1] bg-[#FFF7F8] px-4 py-3 text-sm text-[#A6424E]">
            {error}
          </div>
        )}

        <div>
          <label className="mb-2 block text-sm font-semibold text-[#314C56]">
            Full name
          </label>

          <input
            value={fullName}
            onChange={(event) =>
              setFullName(event.target.value)
            }
            required
            autoComplete="name"
            placeholder="Amirul Hakim"
            className="h-12 w-full rounded-xl border border-[#DCE7EA] bg-white px-4 text-[15px] text-[#183640] outline-none transition placeholder:text-[#A8B5BA] focus:border-[#33C7D3] focus:ring-4 focus:ring-[#1CC9D8]/10"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-[#314C56]">
            Email address
          </label>

          <input
            type="email"
            value={email}
            onChange={(event) =>
              setEmail(event.target.value)
            }
            required
            autoComplete="email"
            placeholder="you@example.com"
            className="h-12 w-full rounded-xl border border-[#DCE7EA] bg-white px-4 text-[15px] text-[#183640] outline-none transition placeholder:text-[#A8B5BA] focus:border-[#33C7D3] focus:ring-4 focus:ring-[#1CC9D8]/10"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-[#314C56]">
            Password
          </label>

          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) =>
                setPassword(event.target.value)
              }
              required
              minLength={8}
              autoComplete="new-password"
              placeholder="At least 8 characters"
              className="h-12 w-full rounded-xl border border-[#DCE7EA] bg-white px-4 pr-12 text-[15px] text-[#183640] outline-none transition placeholder:text-[#A8B5BA] focus:border-[#33C7D3] focus:ring-4 focus:ring-[#1CC9D8]/10"
            />

            <button
              type="button"
              onClick={() =>
                setShowPassword((value) => !value)
              }
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-2 text-[#7B8E95] transition hover:bg-[#F1F7F8] hover:text-[#31515B]"
              aria-label={
                showPassword
                  ? "Hide password"
                  : "Show password"
              }
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        <button
          disabled={loading}
          type="submit"
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#073B4C] px-5 font-semibold text-white shadow-[0_12px_24px_rgba(7,59,76,0.14)] transition hover:bg-[#0B5363] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Creating account...
            </>
          ) : (
            <>
              Create account
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
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