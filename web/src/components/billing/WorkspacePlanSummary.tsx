"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { CreditCard, Loader2, RefreshCw } from "lucide-react"
import { apiFetch } from "@/lib/api"

type Subscription = {
  id: string
  service_code: string
  plan_name: string
  effective_status: string
  eligible: boolean
  current_period_end: string | null
}
type Entitlement = {
  eligible: boolean
  expires_at: string | null
  sources: { subscription_id: string; included: boolean; service_code: string }[]
}
type BillingSnapshot = {
  subscriptions: Subscription[]
  subscription_entitlements: Record<string, Entitlement>
}
const services = [
  { code: "WEBSITE", name: "Website" },
  { code: "CLIENT_GALLERY", name: "Client Gallery" },
  { code: "EVENT_SALES", name: "Event Sales" },
]
function expiryLabel(value: string | null) {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return date.toLocaleDateString("en-MY", {
    day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kuala_Lumpur",
  })
}

export default function WorkspacePlanSummary() {
  const [data, setData] = useState<BillingSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    let active = true
    setLoading(true)
    setError("")
    apiFetch<BillingSnapshot>("/api/billing/subscriptions", { cache: "no-store" })
      .then((snapshot) => { if (active) setData(snapshot) })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "Unable to load your plans.")
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [retry])

  return (
    <section className="rounded-[24px] border border-[#DFE8EA] bg-white p-6 shadow-[0_12px_40px_rgba(8,47,60,0.04)] lg:p-7" aria-label="Current service plans">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#81949B]">Subscriptions</p>
          <h2 className="mt-2 text-xl font-semibold text-[#163741]">Your plans</h2>
        </div>
        <Link href="/dashboard/billing" className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#D4E2E5] px-4 text-sm font-semibold text-[#45666F] transition hover:bg-[#F6FAFA]">
          <CreditCard className="h-4 w-4" /> Manage billing
        </Link>
      </div>
      {loading ? (
        <p className="mt-6 flex items-center gap-2 text-sm text-[#6A7E86]" role="status"><Loader2 className="h-4 w-4 animate-spin" /> Loading your plans...</p>
      ) : error ? (
        <div className="mt-5 rounded-xl bg-[#FFF6F7] p-4">
          <p className="text-sm text-[#A44D57]" role="alert">{error}</p>
          <button type="button" onClick={() => setRetry((value) => value + 1)} className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-[#45666F]"><RefreshCw className="h-4 w-4" /> Try again</button>
        </div>
      ) : data ? (
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {services.map((service) => {
            const entitlement = data.subscription_entitlements[service.code]
            const direct = data.subscriptions.find((subscription) => subscription.service_code === service.code && subscription.eligible)
            const includedSource = entitlement?.sources.find((source) => source.included)
            const included = data.subscriptions.find((subscription) => subscription.id === includedSource?.subscription_id)
            const previous = data.subscriptions.find((subscription) => subscription.service_code === service.code)
            const active = entitlement?.eligible === true
            const plan = direct ?? (active ? included : previous)
            const date = expiryLabel(active ? entitlement.expires_at : previous?.current_period_end ?? null)
            return (
              <div key={service.code} className="rounded-2xl border border-[#E5ECEE] bg-[#FBFCFC] p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-[#284750]">{service.name}</p>
                  <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${active ? "bg-[#E7F8F3] text-[#16856F]" : "bg-[#EEF2F3] text-[#70868E]"}`}>
                    {active ? "ACTIVE" : previous?.effective_status === "EXPIRED" ? "EXPIRED" : "INACTIVE"}
                  </span>
                </div>
                <p className="mt-3 text-sm font-medium text-[#173640]">{plan?.plan_name || "No active plan"}</p>
                {active && !direct && included && <p className="mt-1 text-xs text-[#0A929F]">Website publishing included</p>}
                {date && <p className="mt-2 text-xs text-[#6A7E86]">{active ? "Access until" : previous?.effective_status === "EXPIRED" ? "Period ended" : "Period ends"} {date}</p>}
                {!active && <Link href="/dashboard/billing" className="mt-3 inline-block text-xs font-semibold text-[#0A929F]">{previous ? "Review plan" : "Choose a plan"}</Link>}
              </div>
            )
          })}
        </div>
      ) : null}
    </section>
  )
}
