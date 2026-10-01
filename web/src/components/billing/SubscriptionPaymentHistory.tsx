"use client"

import { useEffect, useState, type FormEvent } from "react"
import { ChevronLeft, ChevronRight, CreditCard, Loader2, RefreshCw } from "lucide-react"
import DashboardPage, { dashboardButtonClass, dashboardCardClass, formatDashboardMoney } from "@/components/dashboard/DashboardPage"
import { apiFetch } from "@/lib/api"

type Payment = {
  order_number: string; workspace_name: string; service_code: string
  plan_name: string; payer_email: string; currency: string; total_cents: number
  status: string; payment_provider: string; payment_reference: string | null
  created_at: string; paid_at: string | null; activated_at: string | null
  period_start: string | null; period_end: string | null; activation_pending: boolean
}
type History = { orders: Payment[]; pagination: { page: number; total: number; total_pages: number } }
const statuses = ["PENDING_PAYMENT", "PAID", "PAYMENT_FAILED", "CANCELLED", "EXPIRED", "REFUNDED"]
const labels: Record<string, string> = {
  PENDING_PAYMENT: "Pending payment", PAID: "Paid", PAYMENT_FAILED: "Payment failed",
  CANCELLED: "Cancelled", EXPIRED: "Expired", REFUNDED: "Refunded",
}
const filterClass = "h-10 rounded-xl border border-[#D4E2E5] bg-white px-3 text-sm text-[#45656F] outline-none focus:border-[#0A929F]"
function date(value: string | null) {
  return value ? new Date(value).toLocaleDateString("en-MY", { dateStyle: "medium", timeZone: "Asia/Kuala_Lumpur" }) : "—"
}

export default function SubscriptionPaymentHistory({ admin = false, refreshKey = 0 }: { admin?: boolean; refreshKey?: number }) {
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState("")
  const [service, setService] = useState("")
  const [searchInput, setSearchInput] = useState("")
  const [search, setSearch] = useState("")
  const [retry, setRetry] = useState(0)
  const [data, setData] = useState<History | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let active = true
    setLoading(true)
    setError("")
    setData(null)
    const params = new URLSearchParams({ page: String(page), page_size: "20" })
    if (status) params.set("payment_status", status)
    if (service) params.set("service_code", service)
    if (admin && search) params.set("search", search)
    void apiFetch<History>(`/api/${admin ? "admin/billing" : "billing"}/history?${params}`).then((result) => {
      if (!active) return
      if (page > result.pagination.total_pages) { setPage(result.pagination.total_pages); return }
      setData(result)
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : "Unable to load subscription payments.")
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [admin, page, status, service, search, retry, refreshKey])

  function submitSearch(event: FormEvent) {
    event.preventDefault()
    setPage(1)
    setSearch(searchInput.trim())
    setRetry((value) => value + 1)
  }

  return (
    <section className={`${dashboardCardClass} mt-8 overflow-hidden`} aria-labelledby="subscription-history-title">
      <div className="flex flex-wrap items-start justify-between gap-4 p-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#0A929F]">Subscription billing</p>
          <h2 id="subscription-history-title" className="mt-2 text-xl font-semibold text-[#173943]">Payment history</h2>
          <p className="mt-2 text-sm text-[#70868E]">{admin ? "Plan purchases and renewals across all workspaces." : "Your plan purchases and renewals."}</p>
          <p className="mt-1 text-xs text-[#70868E]">Separate from customer photo purchases. Dates shown in Malaysia time.</p>
        </div>
        <button type="button" disabled={loading} className={dashboardButtonClass} onClick={() => setRetry((value) => value + 1)}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-3 border-t border-[#E7EEF0] px-6 py-4">
        <select aria-label="Filter payment status" className={filterClass} value={status} onChange={(event) => { setPage(1); setStatus(event.target.value) }}>
          <option value="">All payment statuses</option>{statuses.map((value) => <option key={value} value={value}>{labels[value]}</option>)}
        </select>
        <select aria-label="Filter service" className={filterClass} value={service} onChange={(event) => { setPage(1); setService(event.target.value) }}>
          <option value="">All services</option><option value="WEBSITE">Website</option><option value="CLIENT_GALLERY">Client Gallery</option><option value="EVENT_SALES">Event Sales</option>
        </select>
        {admin && <form className="flex flex-wrap gap-2" onSubmit={submitSearch}>
          <input aria-label="Search subscription payments" className={`${filterClass} w-64 max-w-full`} value={searchInput} maxLength={100} placeholder="Workspace, email or order number" onChange={(event) => setSearchInput(event.target.value)} />
          <button type="submit" className={dashboardButtonClass}>Search</button>
        </form>}
      </div>
      {loading ? <div className="flex items-center gap-3 p-6 text-sm text-[#607B84]" role="status"><Loader2 className="h-4 w-4 animate-spin" />Loading payments...</div>
        : error ? <div className="p-6"><p role="alert" className="text-sm text-red-700">{error}</p><button type="button" className={`${dashboardButtonClass} mt-3`} onClick={() => setRetry((value) => value + 1)}>Try again</button></div>
        : data && data.orders.length === 0 ? <p className="p-6 text-sm text-[#607B84]">No subscription payments match these filters.</p>
        : data ? <>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-y border-[#E7EEF0] bg-[#F8FBFC] text-xs uppercase tracking-wide text-[#70868E]"><tr>
                <th className="px-6 py-4">Order / plan</th>{admin && <th className="px-6 py-4">Workspace / payer</th>}
                <th className="px-6 py-4">Amount</th><th className="px-6 py-4">Payment</th><th className="px-6 py-4">Paid period</th><th className="px-6 py-4">Reference</th>
              </tr></thead>
              <tbody className="divide-y divide-[#E7EEF0]">{data.orders.map((order) => <tr key={order.order_number}>
                <td className="px-6 py-4"><p className="font-semibold text-[#284750]">{order.plan_name}</p><p className="mt-1 text-xs text-[#70868E]">{order.order_number}</p><p className="mt-1 text-xs text-[#70868E]">Created {date(order.created_at)}</p></td>
                {admin && <td className="px-6 py-4"><p className="font-semibold text-[#284750]">{order.workspace_name}</p><p className="mt-1 break-all text-xs text-[#70868E]">{order.payer_email}</p></td>}
                <td className="whitespace-nowrap px-6 py-4 font-semibold text-[#284750]">{formatDashboardMoney(order.total_cents, order.currency)}</td>
                <td className="px-6 py-4"><span className={`inline-block whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${order.status === "PAID" ? "bg-[#E3F5EF] text-[#187D62]" : "bg-[#F1F4F5] text-[#607B84]"}`}>{labels[order.status] || order.status}</span><p className="mt-2 text-xs text-[#70868E]">{order.paid_at ? `Paid ${date(order.paid_at)}` : "Not paid"}</p>{order.activation_pending && <p className="mt-1 text-xs text-amber-700">Activation pending</p>}</td>
                <td className="px-6 py-4 text-[#607B84]">{order.period_start && order.period_end ? <><span className="block whitespace-nowrap">{date(order.period_start)}</span><span className="block whitespace-nowrap">to {date(order.period_end)}</span></> : "—"}</td>
                <td className="max-w-xs px-6 py-4"><p className="text-xs font-semibold text-[#607B84]">{order.payment_provider}</p><p className="mt-1 break-all font-mono text-xs text-[#70868E]">{order.payment_reference || "—"}</p></td>
              </tr>)}</tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E7EEF0] px-6 py-4 text-sm text-[#607B84]">
            <span>{data.pagination.total} orders · Page {page} of {data.pagination.total_pages}</span>
            <div className="flex gap-2"><button type="button" disabled={page <= 1} className={dashboardButtonClass} onClick={() => setPage((value) => value - 1)}><ChevronLeft className="h-4 w-4" />Previous</button><button type="button" disabled={page >= data.pagination.total_pages} className={dashboardButtonClass} onClick={() => setPage((value) => value + 1)}>Next<ChevronRight className="h-4 w-4" /></button></div>
          </div>
        </> : null}
    </section>
  )
}

export function AdminSubscriptionDashboard() {
  return <DashboardPage title="Subscriptions" section="Platform Admin" icon={<CreditCard className="h-4 w-4" />} backHref="/admin" backLabel="Back to platform dashboard" eyebrow="Subscription billing" heading="Subscription payments" description="Review workspace plan purchases, payment status and paid periods."><SubscriptionPaymentHistory admin /></DashboardPage>
}
