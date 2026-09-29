"use client"

import { CheckCircle2, Loader2, XCircle } from "lucide-react"
import { useEffect, useState } from "react"

export type AddressAvailability = {
  slug: string
  available: boolean
  hostname: string
  reason: string | null
}

export function suggestWorkspaceSlug(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "")
}

export async function checkWorkspaceAddress(
  slug: string,
  signal?: AbortSignal
): Promise<AddressAvailability> {
  const baseUrl =
    process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "")

  if (!baseUrl) {
    throw new Error(
      "Address checking is unavailable. Please try again later."
    )
  }

  const controller = new AbortController()
  const abort = () => controller.abort()

  if (signal?.aborted) controller.abort()
  signal?.addEventListener("abort", abort, { once: true })

  const timer = window.setTimeout(abort, 12000)

  try {
    const response = await fetch(
      `${baseUrl}/api/onboarding/slug/${encodeURIComponent(slug)}`,
      {
        cache: "no-store",
        signal: controller.signal,
      }
    )

    if (!response.ok) {
      throw new Error(
        "Unable to check this address. Please try again."
      )
    }

    return (await response.json()) as AddressAvailability
  } catch (error) {
    if (signal?.aborted) throw error

    if (controller.signal.aborted) {
      throw new Error(
        "The availability check timed out. Please try again."
      )
    }

    throw error
  } finally {
    window.clearTimeout(timer)
    signal?.removeEventListener("abort", abort)
  }
}

type Props = {
  value: string
  onChange: (value: string) => void
  result: AddressAvailability | null
  onResult: (result: AddressAvailability | null) => void
  disabled?: boolean
}

export default function WorkspaceAddressField({
  value,
  onChange,
  result,
  onResult,
  disabled = false,
}: Props) {
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState("")
  const [retry, setRetry] = useState(0)

  const valid =
    value.length >= 3 &&
    value.length <= 60 &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)

  const current = result?.slug === value ? result : null

  useEffect(() => {
    const controller = new AbortController()

    onResult(null)
    setError("")
    setChecking(valid)

    if (!valid) {
      return () => controller.abort()
    }

    const timer = window.setTimeout(async () => {
      try {
        const response = await checkWorkspaceAddress(
          value,
          controller.signal
        )

        if (!controller.signal.aborted) {
          onResult(response)
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setError(
            error instanceof Error
              ? error.message
              : "Unable to check availability."
          )
        }
      } finally {
        if (!controller.signal.aborted) {
          setChecking(false)
        }
      }
    }, 450)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [value, valid, retry, onResult])

  return (
    <div>
      <label
        htmlFor="workspace-address"
        className="mb-2 block text-sm font-semibold text-[#314C56]"
      >
        Workspace address
      </label>

      <div className="flex overflow-hidden rounded-xl border border-[#DCE7EA] bg-white focus-within:border-[#33C7D3] focus-within:ring-4 focus-within:ring-[#1CC9D8]/10">
        <input
          id="workspace-address"
          value={value}
          onChange={(event) =>
            onChange(event.target.value.toLowerCase())
          }
          required
          minLength={3}
          maxLength={60}
          disabled={disabled}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          aria-describedby="address-feedback address-note"
          placeholder="your-studio"
          className="h-12 min-w-0 flex-1 bg-transparent px-4 text-sm text-[#183640] outline-none"
        />

        <span className="flex shrink-0 items-center border-l border-[#E5ECEE] bg-[#F6F9FA] px-3 text-sm text-[#697E86]">
          .ezfotoo.com
        </span>
      </div>

      <div
        id="address-feedback"
        aria-live="polite"
        className="mt-3 min-h-5 text-xs leading-5"
      >
        {!value ? (
          <p className="text-[#82939A]">
            Choose an address for your photography business.
          </p>
        ) : !valid ? (
          <p className="text-[#A6424E]">
            Use 3–60 letters or numbers, with single hyphens
            between words.
          </p>
        ) : checking ? (
          <p className="flex items-center gap-2 text-[#71858C]">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Checking availability...
          </p>
        ) : error ? (
          <p className="text-[#A6424E]">
            {error}{" "}
            <button
              type="button"
              disabled={disabled}
              onClick={() => setRetry((n) => n + 1)}
              className="font-semibold underline"
            >
              Retry
            </button>
          </p>
        ) : current?.available ? (
          <p className="flex items-start gap-2 text-[#188366]">
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span className="break-all">
              {current.hostname} is available
            </span>
          </p>
        ) : current ? (
          <p className="flex items-start gap-2 text-[#A6424E]">
            <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {current.reason || "This address is unavailable."}
          </p>
        ) : null}
      </div>

      <p
        id="address-note"
        className="mt-2 text-xs leading-5 text-[#82939A]"
      >
        Your address is secured when you finish creating your
        workspace.
      </p>
    </div>
  )
}