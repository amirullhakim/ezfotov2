"use client"

import { Loader2, RefreshCw } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"

import { apiFetch } from "@/lib/api"
import DashboardPage, {
  dashboardButtonClass,
  dashboardCardClass,
  DashboardMetric,
  formatDashboardMoney as formatMoney,
} from "@/components/dashboard/DashboardPage"

type FinanceResponse = {
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
  transactions: {
    order_number: string
    event_title: string
    order_status: string
    photo_subtotal_cents: number
    service_fee_cents: number
    total_cents: number
    pricing_plan_code: string | null
    pricing_plan_name: string | null
    commission_bps: number | null
    commission_cents: number | null
    photographer_share_cents: number | null
    platform_share_cents: number | null
    paid_at: string
    recorded_at: string
    source: string
  }[]
  pagination: {
    page: number
    page_size: number
    total: number
    total_pages: number
  }
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-MY", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kuala_Lumpur",
  }).format(new Date(value))
}

function shareMoney(cents: number | null, currency = "MYR") {
  return cents === null ? "—" : formatMoney(cents, currency)
}

export default function FinanceDashboard() {
  const [page, setPage] = useState(1)
  const [data, setData] = useState<FinanceResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let active = true

    async function loadFinance() {
      setLoading(true)
      setData(null)
      setError("")

      try {
        const result = await apiFetch<FinanceResponse>(
          `/api/event-sales/finance?page=${page}&page_size=20`
        )
        if (active) setData(result)
      } catch {
        if (active) {
          setError("Unable to load financial records right now.")
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    void loadFinance()

    return () => {
      active = false
    }
  }, [page, reload])

  const currency = data?.currency ?? "MYR"

  return (
    <DashboardPage
      title="Finance"
      heading="Payment overview"
      description="Verified payment records for your workspace."
      actions={
        <button
          type="button"
          onClick={() => setReload((n) => n + 1)}
          disabled={loading}
          className={dashboardButtonClass}
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      }
      summary={
        <span className="inline-flex rounded-full border border-[#DCE7E9] bg-white px-4 py-2 text-xs font-semibold text-[#45666F]">
          Currency: {currency}
        </span>
      }
    >
      {error && (
        <div
          role="alert"
          className="mt-6 rounded-2xl border border-[#F0CDD0] bg-[#FFF7F7] p-4 text-sm text-[#A43C47]"
        >
          {error}{" "}
          <button
            type="button"
            onClick={() => setReload((value) => value + 1)}
            className="font-bold underline"
          >
            Try again
          </button>
        </div>
      )}

      {!data && loading ? (
        <div className="mt-10 flex items-center gap-3 text-sm text-[#617982]">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading finance records...
        </div>
      ) : data ? (
        <>
          <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Photo sales", data.summary.photo_sales_cents],
              ["EZFOTOO commission", data.summary.commission_cents],
              ["Photographer share", data.summary.photographer_share_cents],
              ["Total collected", data.summary.total_collected_cents],
            ].map(([label, cents]) => (
              <DashboardMetric
                key={String(label)}
                label={String(label)}
                value={shareMoney(cents === null ? null : Number(cents), currency)}
              />
            ))}
          </div>

          <p className="mt-4 text-xs leading-5 text-[#6C838B]">
            Photographer share is photo sales less the saved commission.
            Service fees belong to the platform. These are recorded allocations;
            refunds, payment costs and payouts are not deducted.
          </p>

          {data.summary.commission_missing_payments > 0 && (
            <p className="mt-4 text-xs leading-5 text-[#6C838B]">
              Commission and share totals cover {data.summary.commission_recorded_payments} payments.
              {" "}{data.summary.commission_missing_payments} older payments have no saved commission breakdown.
              Their photo sales and collected amounts remain included.
            </p>
          )}

          {data.coverage.paid_orders_missing > 0 && (
            <div className="mt-6 rounded-2xl border border-[#F2DEB8] bg-[#FFF9ED] p-4 text-sm text-[#795D2E]">
              {data.coverage.paid_orders_missing} older paid{" "}
              {data.coverage.paid_orders_missing === 1
                ? "order is"
                : "orders are"}{" "}
              not included in these ledger totals.
            </div>
          )}

          <section className={`${dashboardCardClass} mt-7 overflow-hidden`}>
            <div className="flex items-center justify-between border-b border-[#EAF0F1] px-5 py-5 sm:px-6">
              <div>
                <h2 className="text-lg font-semibold text-[#073B4C]">
                  Payment records
                </h2>
                <p className="mt-1 text-xs text-[#718790]">
                  {data.summary.recorded_payments} verified{" "}
                  {data.summary.recorded_payments === 1
                    ? "payment"
                    : "payments"}
                </p>
              </div>
            </div>

            {data.transactions.length === 0 ? (
              <p className="p-10 text-center text-sm text-[#718790]">
                No verified payment records yet.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1000px] text-left text-sm">
                  <thead className="bg-[#F7FAFA] text-xs font-semibold uppercase tracking-wide text-[#82969D]">
                    <tr>
                      <th scope="col" className="px-6 py-3">Order / event</th>
                      <th scope="col" className="px-4 py-3">Paid</th>
                      <th scope="col" className="px-4 py-3 text-right">Photos</th>
                      <th scope="col" className="px-4 py-3 text-right">Service fee</th>
                      <th scope="col" className="px-4 py-3 text-right">Commission</th>
                      <th scope="col" className="px-4 py-3 text-right">Your share</th>
                      <th scope="col" className="px-6 py-3 text-right">Collected</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-[#EEF2F3]">
                    {data.transactions.map((item) => (
                      <tr key={item.order_number} className="hover:bg-[#F9FCFC]">
                        <td className="px-6 py-4">
                          <Link
                            href={`/dashboard/orders/${encodeURIComponent(item.order_number)}`}
                            className="font-semibold text-[#087F8C] hover:underline"
                          >
                            {item.order_number}
                          </Link>
                          <p className="mt-1 text-xs text-[#758B92]">
                            {item.event_title}
                          </p>
                          {item.order_status !== "PAID" && (
                            <span className="mt-1 inline-block text-xs font-semibold text-[#A65B4F]">
                              {item.order_status}
                            </span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-[#526F77]">
                          {formatDate(item.paid_at)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-right text-[#526F77]">
                          {formatMoney(item.photo_subtotal_cents, currency)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-right text-[#526F77]">
                          {formatMoney(item.service_fee_cents, currency)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-right text-[#526F77]">
                          {shareMoney(item.commission_cents, currency)}
                          {item.commission_bps !== null && <span className="block text-xs">{item.commission_bps / 100}%</span>}
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-right font-semibold text-[#073B4C]">
                          {shareMoney(item.photographer_share_cents, currency)}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-right font-semibold text-[#073B4C]">
                          {formatMoney(item.total_cents, currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {data.pagination.total_pages > 1 && (
              <div className="flex items-center justify-between border-t border-[#EAF0F1] px-5 py-4 text-sm text-[#657F87] sm:px-6">
                <span>
                  Page {data.pagination.page} of {data.pagination.total_pages}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={loading || page <= 1}
                    onClick={() => setPage((value) => value - 1)}
                    className={dashboardButtonClass}
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={loading || page >= data.pagination.total_pages}
                    onClick={() => setPage((value) => value + 1)}
                    className={dashboardButtonClass}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </section>
        </>
      ) : null}
    </DashboardPage>
  )
}
