"use client"

import Link from "next/link"
import { FormEvent, useState } from "react"
import {
  ArrowRight,
  Eye,
  EyeOff,
  Loader2,
} from "lucide-react"
import { useRouter } from "next/navigation"

import { AuthShell } from "@/components/AuthShell"
import { apiFetch } from "@/lib/api"
import { createClient } from "@/lib/supabase/client"


type AccountResponse = {
  id: string
  email: string | null
  is_platform_admin: boolean
}

type WorkspaceResponse = {
  onboarded: boolean
}


export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")

  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  const [error, setError] = useState("")


  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault()

    if (loading) return

    setError("")
    setLoading(true)

    try {
      const { error: signInError } =
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        })

      if (signInError) {
        setError(signInError.message)
        setLoading(false)
        return
      }

      const account = await apiFetch<AccountResponse>(
        "/api/auth/me"
      )

      if (account.is_platform_admin) {
        router.replace("/admin")
        router.refresh()
        return
      }

      const workspace = await apiFetch<WorkspaceResponse>(
        "/api/workspaces/me"
      )

      router.replace(
        workspace.onboarded
          ? "/dashboard"
          : "/onboarding"
      )
      router.refresh()

    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to open your account. Please try again."
      )
      setLoading(false)
    }
  }


  return (
    <AuthShell>
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.15em] text-[#0CA8B7]">
          Welcome back
        </p>

        <h1 className="mt-3 text-[36px] font-semibold tracking-[-0.045em] text-[#112D38]">
          Sign in to EZFOTOO
        </h1>

        <p className="mt-3 text-[15px] leading-6 text-[#667A83]">
          Manage your photography business from one workspace.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="mt-9 space-y-5"
      >
        {error && (
          <div
            role="alert"
            className="rounded-2xl border border-[#F0CDD1] bg-[#FFF7F8] px-4 py-3 text-sm text-[#A6424E]"
          >
            {error}
          </div>
        )}

        <div>
          <label
            htmlFor="login-email"
            className="mb-2 block text-sm font-semibold text-[#314C56]"
          >
            Email address
          </label>

          <input
            id="login-email"
            type="email"
            value={email}
            onChange={(event) =>
              setEmail(event.target.value)
            }
            required
            disabled={loading}
            autoComplete="email"
            placeholder="you@example.com"
            className="h-12 w-full rounded-xl border border-[#DCE7EA] bg-white px-4 text-[15px] text-[#183640] outline-none transition placeholder:text-[#A8B5BA] focus:border-[#33C7D3] focus:ring-4 focus:ring-[#1CC9D8]/10"
          />
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <label
              htmlFor="login-password"
              className="text-sm font-semibold text-[#314C56]"
            >
              Password
            </label>

            <button
              type="button"
              className="text-xs font-semibold text-[#0A8A97]"
            >
              Forgot password?
            </button>
          </div>

          <div className="relative">
            <input
              id="login-password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) =>
                setPassword(event.target.value)
              }
              required
              disabled={loading}
              autoComplete="current-password"
              className="h-12 w-full rounded-xl border border-[#DCE7EA] bg-white px-4 pr-12 text-[15px] text-[#183640] outline-none transition focus:border-[#33C7D3] focus:ring-4 focus:ring-[#1CC9D8]/10"
            />

            <button
              type="button"
              aria-label={
                showPassword
                  ? "Hide password"
                  : "Show password"
              }
              aria-pressed={showPassword}
              onClick={() =>
                setShowPassword((value) => !value)
              }
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-2 text-[#7B8E95] transition hover:bg-[#F1F7F8]"
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
          type="submit"
          disabled={loading}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#073B4C] font-semibold text-white shadow-[0_12px_24px_rgba(7,59,76,0.14)] transition hover:bg-[#0B5363] disabled:opacity-60"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Signing in...
            </>
          ) : (
            <>
              Sign in
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </form>

      <p className="mt-7 text-center text-sm text-[#758990]">
        New to EZFOTOO?{" "}
        <Link
          href="/register"
          className="font-semibold text-[#087F8C]"
        >
          Create account
        </Link>
      </p>
    </AuthShell>
  )
}