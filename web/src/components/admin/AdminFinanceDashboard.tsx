"use client"

import { useEffect, useState } from "react"
import {
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Loader2,
  ShieldCheck,
} from "lucide-react"

import DashboardPage, {
  DashboardMetric,
  dashboardButtonClass,
  dashboardCardClass,
  formatDashboardMoney as money,
} from "@/components/dashboard/DashboardPage"

import { apiFetch } from "@/lib/api"

type Finance = {
  currency: string
  summary: {
    recorded_payments: number
    photo_sales_cents: number
    service_fees_cents: number
    total_collected_cents: number
    commission_recorded_payments: number
    commission_missing_payments: number
    commission_cents: number | null
    photographer_share_cents: number | null
    platform_share_cents: number | null
  }
  coverage: {
    paid_orders: number
    paid_orders_recorded: number
    paid_orders_missing: number
  }
  workspaces: {
    id: string
    name: string
    slug: string
    recorded_payments: number
    photo_sales_cents: number
    service_fees_cents: number
    total_collected_cents: number
    commission_recorded_payments: number
    commission_missing_payments: number
    commission_cents: number | null
    photographer_share_cents: number | null
    platform_share_cents: number | null
  }[]
  transactions: {
    order_number: string
    workspace_name: string
    paid_at: string
    source: string
    photo_sales_cents: number
    service_fee_cents: number
    total_cents: number
    pricing_plan_code: string | null
    pricing_plan_name: string | null
    commission_bps: number | null
    commission_cents: number | null
    photographer_share_cents: number | null
    platform_share_cents: number | null
  }[]
  pagination: {
    page: number
    page_size: number
    total: number
    total_pages: number
  }
}

function shareMoney(cents: number | null, currency = "MYR") {
  return cents === null ? "—" : money(cents, currency)
}

export default function AdminFinanceDashboard() {
  const [page, setPage] = useState(1)
  const [refreshKey, setRefreshKey] = useState(0)
  const [data, setData] = useState<Finance | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let active = true

    async function load() {
      setLoading(true)
      setError("")

      try {
        const result = await apiFetch<Finance>(
          `/api/admin/finance?page=${page}&page_size=20`
        )
        if (active) setData(result)
      } catch (reason) {
        if (active) {
          setError(
            reason instanceof Error
              ? reason.message
              : "Unable to load finance records."
          )
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    void load()

    return () => {
      active = false
    }
  }, [page, refreshKey])

  return (
    <DashboardPage
      title="Finance"
      section="Platform Admin"
      icon={<ShieldCheck className="h-4 w-4" />}
      backHref="/admin"
      backLabel="Back to platform dashboard"
      eyebrow="Platform commerce"
      heading="Event Sales finance"
      description="Verified payment records across all workspaces."
      actions={
        <button
          type="button"
          onClick={() => setRefreshKey((value) => value + 1)}
          disabled={loading}
          className={dashboardButtonClass}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      }
      summary={
        <span className="rounded-full border border-[#D5E9EC] bg-white px-4 py-2 text-xs font-semibold text-[#55747E]">
          Currency: {data?.currency ?? "MYR"}
        </span>
      }
    >
        {error && (
          <p
            role="alert"
            className="mt-7 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
          >
            {error}
          </p>
        )}

        {loading && (
          <div className="mt-8 flex items-center gap-3 text-sm text-[#607B84]">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading finance...
          </div>
        )}

        {data && !loading && !error && (
          <>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[
                [
                  "Recorded payments",
                  String(data.summary.recorded_payments),
                ],
                ["Photo sales", money(data.summary.photo_sales_cents)],
                ["Commission", shareMoney(data.summary.commission_cents)],
                ["Service fees", money(data.summary.service_fees_cents)],
                ["Platform share", shareMoney(data.summary.platform_share_cents)],
                ["Photographer share", shareMoney(data.summary.photographer_share_cents)],
                [
                  "Total collected",
                  money(data.summary.total_collected_cents),
                ],
              ].map(([label, value]) => (
                <DashboardMetric key={label} label={label} value={value} />
              ))}
            </div>

            <p className="mt-4 text-xs leading-5 text-[#667F87]">
              Platform share includes saved commission and service fees.
              These are recorded allocations; refunds, payment costs and payouts
              are not deducted.
            </p>

          {data.summary.commission_missing_payments > 0 && (
            <p className="mt-4 text-xs leading-5 text-[#6C838B]">
              Commission and share totals cover {data.summary.commission_recorded_payments} payments.
              {" "}{data.summary.commission_missing_payments} older payments have no saved commission breakdown.
              Their photo sales and collected amounts remain included.
            </p>
          )}

            {data.coverage.paid_orders_missing > 0 && (
              <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
                {data.coverage.paid_orders_missing} older paid orders are
                not included in these ledger totals.
              </div>
            )}

            <section className={`${dashboardCardClass} mt-8 overflow-hidden`}>
              <div className="border-b border-[#E7EEF0] p-6">
                <h2 className="text-xl font-semibold">Workspaces</h2>
                <p className="mt-1 text-xs text-[#6A7E86]">
                  Workspaces with recorded payments
                </p>
              </div>

              {data.workspaces.length === 0 ? (
                <p className="p-6 text-sm text-[#6A7E86]">
                  No recorded payments yet.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1100px] text-left text-sm">
                    <thead className="bg-[#F6F9FA] text-xs uppercase tracking-wide text-[#718991]">
                      <tr>
                        <th className="px-6 py-3">Workspace</th>
                        <th className="px-6 py-3">Payments</th>
                        <th className="px-6 py-3">Photo sales</th>
                        <th className="px-6 py-3">Service fees</th>
                        <th className="px-6 py-3">Commission</th>
                        <th className="px-6 py-3">Photographer share</th>
                        <th className="px-6 py-3">Platform share</th>
                        <th className="px-6 py-3">Collected</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E7EEF0]">
                      {data.workspaces.map((item) => (
                        <tr key={item.id}>
                          <td className="px-6 py-4 font-semibold">
                            {item.name}
                            <span className="block text-xs font-normal text-[#718991]">
                              {item.slug}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            {item.recorded_payments}
                          </td>
                          <td className="px-6 py-4">
                            {money(item.photo_sales_cents)}
                          </td>
                          <td className="px-6 py-4">
                            {money(item.service_fees_cents)}
                          </td>
                          <td className="whitespace-nowrap px-6 py-4">
                            {shareMoney(item.commission_cents)}
                          </td>
                          <td className="whitespace-nowrap px-6 py-4">
                            {shareMoney(item.photographer_share_cents)}
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 font-semibold">
                            {shareMoney(item.platform_share_cents)}
                          </td>
                          <td className="px-6 py-4 font-semibold">
                            {money(item.total_collected_cents)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className={`${dashboardCardClass} mt-7 overflow-hidden`}>
              <div className="border-b border-[#E7EEF0] p-6">
                <h2 className="text-xl font-semibold">Payment records</h2>
                <p className="mt-1 text-xs text-[#6A7E86]">
                  {data.pagination.total} verified payments
                </p>
              </div>

              {data.transactions.length === 0 ? (
                <p className="p-6 text-sm text-[#6A7E86]">
                  No records on this page.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1200px] text-left text-sm">
                    <thead className="bg-[#F6F9FA] text-xs uppercase tracking-wide text-[#718991]">
                      <tr>
                        <th className="px-6 py-3">Order / workspace</th>
                        <th className="px-6 py-3">Paid</th>
                        <th className="px-6 py-3">Photo sales</th>
                        <th className="px-6 py-3">Service fee</th>
                        <th className="px-6 py-3">Commission</th>
                        <th className="px-6 py-3">Photographer share</th>
                        <th className="px-6 py-3">Platform share</th>
                        <th className="px-6 py-3">Collected</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E7EEF0]">
                      {data.transactions.map((item) => (
                        <tr key={item.order_number}>
                          <td className="px-6 py-4 font-semibold">
                            {item.order_number}
                            <span className="block text-xs font-normal text-[#718991]">
                              {item.workspace_name}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-[#607B84]">
                            {new Date(item.paid_at).toLocaleString(
                              "en-MY",
                              {
                                dateStyle: "medium",
                                timeStyle: "short",
                                timeZone: "Asia/Kuala_Lumpur",
                              }
                            )}
                          </td>
                          <td className="px-6 py-4">
                            {money(item.photo_sales_cents)}
                          </td>
                          <td className="px-6 py-4">
                            {money(item.service_fee_cents)}
                          </td>
                          <td className="whitespace-nowrap px-6 py-4">
                            {shareMoney(item.commission_cents)}
                            {item.commission_bps !== null && <span className="block text-xs text-[#718991]">{item.commission_bps / 100}%</span>}
                          </td>
                          <td className="whitespace-nowrap px-6 py-4">
                            {shareMoney(item.photographer_share_cents)}
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 font-semibold">
                            {shareMoney(item.platform_share_cents)}
                          </td>
                          <td className="px-6 py-4 font-semibold">
                            {money(item.total_cents)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {data.pagination.total_pages > 1 && (
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E7EEF0] px-6 py-4 text-sm">
                  <button
                    type="button"
                    disabled={page <= 1 || loading}
                    onClick={() => setPage(page - 1)}
                    className={dashboardButtonClass}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </button>
                  <span>
                    Page {page} of {data.pagination.total_pages}
                  </span>
                  <button
                    type="button"
                    disabled={
                      page >= data.pagination.total_pages || loading
                    }
                    onClick={() => setPage(page + 1)}
                    className={dashboardButtonClass}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </section>
          </>
        )}
    </DashboardPage>
  )
}
