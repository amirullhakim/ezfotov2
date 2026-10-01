"use client"

import { useEffect, useState } from "react"
import { Activity, Loader2, RefreshCw } from "lucide-react"
import { apiFetch } from "@/lib/api"
import { dashboardCardClass } from "@/components/dashboard/DashboardPage"

type Health = { ok: boolean; database: string; environment?: string; version?: string }

export default function AdminSystemStatus({ refreshKey = 0 }: { refreshKey?: number }) {
  const [health, setHealth] = useState<Health | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [checkedAt, setCheckedAt] = useState("")
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    let active = true
    setLoading(true)
    setError("")
    apiFetch<Health>("/api/health", { cache: "no-store" })
      .then((result) => { if (active) setHealth(result) })
      .catch((cause: unknown) => {
        if (active) {
          setHealth(null)
          setError(cause instanceof Error ? cause.message : "Unable to check API status.")
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false)
          setCheckedAt(new Date().toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kuala_Lumpur" }))
        }
      })
    return () => { active = false }
  }, [retry, refreshKey])
  const healthy = health?.ok === true && health.database === "connected"
  return (
    <section id="system" className={`${dashboardCardClass} scroll-mt-28 p-6`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#E8F8F9]"><Activity className="h-5 w-5 text-[#0798A6]" /></div>
        <button type="button" disabled={loading} onClick={() => setRetry((value) => value + 1)} aria-label="Refresh system status" className="rounded-xl border border-[#D4E2E5] p-2 text-[#45666F] transition hover:bg-[#F6FAFA] disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /></button>
      </div>
      <p className="mt-5 text-xs font-bold uppercase tracking-[0.14em] text-[#81949B]">System status</p>
      <h3 className="mt-2 text-lg font-semibold text-[#183A44]">{loading ? "Checking connection" : healthy ? "API and database available" : "Status needs attention"}</h3>
      {loading ? <p role="status" className="mt-4 flex items-center gap-2 text-sm text-[#71858C]"><Loader2 className="h-4 w-4 animate-spin" /> Checking...</p> : error ? <p role="alert" className="mt-4 text-sm text-[#A44D57]">{error}</p> : health ? (
        <dl className="mt-5 space-y-3 text-sm">
          <div className="flex justify-between gap-3"><dt className="text-[#71858C]">API</dt><dd className={`font-semibold ${health.ok ? "text-[#16856F]" : "text-[#A44D57]"}`}>{health.ok ? "Available" : "Unavailable"}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-[#71858C]">Database</dt><dd className={`font-semibold ${health.database === "connected" ? "text-[#16856F]" : "text-[#A44D57]"}`}>{health.database === "connected" ? "Connected" : "Not connected"}</dd></div>
          {health.environment && <div className="flex justify-between gap-3"><dt className="text-[#71858C]">Environment</dt><dd className="font-semibold capitalize text-[#35545D]">{health.environment}</dd></div>}
          {health.version && <div className="flex justify-between gap-3"><dt className="text-[#71858C]">Version</dt><dd className="font-semibold text-[#35545D]">{health.version}</dd></div>}
        </dl>
      ) : null}
      {checkedAt && <p className="mt-5 text-xs text-[#899A9F]">Last checked {checkedAt} MYT</p>}
    </section>
  )
}
