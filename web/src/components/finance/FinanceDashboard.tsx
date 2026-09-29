"use client"

import { ArrowLeft, Camera, Loader2 } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"

import { apiFetch } from "@/lib/api"

type FinanceResponse = {
  currency: string
  summary: {
    recorded_payments: number
    photo_sales_cents: number
    service_fees_cents: number
    total_collected_cents: number
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

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency,
  }).format(cents / 100)
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-MY", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kuala_Lumpur",
  }).format(new Date(value))
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
    <div className="min-h-screen bg-[#F5F9FA] text-[#143943]">
      <header className="border-b border-[#E0E9EB] bg-white">
        <div className="flex h-20 items-center gap-4 px-4 sm:px-6 lg:px-10">
          <Link
            href="/dashboard"
            aria-label="Back to dashboard"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#DCE7EA] text-[#557781] transition hover:bg-[#F4FAFA] hover:text-[#087F8C]"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>

          <div>
            <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.17em] text-[#0798A6]">
              <Camera className="h-4 w-4" />
              Event Sales
            </p>
            <p className="mt-1 text-base font-semibold text-[#173943]">
              Finance
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#168C99]">
              Event Sales
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#073B4C]">
              Payment overview
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#617982]">
              Verified payment records for your workspace.
            </p>
          </div>

          <div className="rounded-full border border-[#CEE7EA] bg-white px-4 py-2 text-xs font-semibold text-[#45707A]">
            Currency: {currency}
          </div>
        </div>

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
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {[
                ["Photo sales", data.summary.photo_sales_cents],
                ["Service fees (platform)", data.summary.service_fees_cents],
                ["Total collected", data.summary.total_collected_cents],
              ].map(([label, cents]) => (
                <div
                  key={String(label)}
                  className="rounded-2xl border border-[#E0E9EB] bg-white p-6 shadow-sm"
                >
                  <p className="text-sm font-medium text-[#69818A]">
                    {label}
                  </p>
                  <p className="mt-3 text-3xl font-bold tracking-tight text-[#073B4C]">
                    {formatMoney(Number(cents), currency)}
                  </p>
                </div>
              ))}
            </div>

            <p className="mt-4 text-xs leading-5 text-[#6C838B]">
              These are gross recorded payments. Service fees are shown
              separately and are not photographer earnings. Refunds,
              commission and payouts are not yet deducted.
            </p>

            {data.coverage.paid_orders_missing > 0 && (
              <div className="mt-6 rounded-2xl border border-[#F2DEB8] bg-[#FFF9ED] p-4 text-sm text-[#795D2E]">
                {data.coverage.paid_orders_missing} older paid{" "}
                {data.coverage.paid_orders_missing === 1
                  ? "order is"
                  : "orders are"}{" "}
                not included in these ledger totals.
              </div>
            )}

            <section className="mt-8 overflow-hidden rounded-2xl border border-[#E0E9EB] bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-[#EAF0F1] px-5 py-5 sm:px-6">
                <div>
                  <h2 className="text-lg font-bold text-[#073B4C]">
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
                  <table className="w-full min-w-[760px] text-left text-sm">
                    <thead className="bg-[#F8FBFB] text-xs font-bold uppercase tracking-wider text-[#728990]">
                      <tr>
                        <th scope="col" className="px-6 py-3">
                          Order / event
                        </th>
                        <th scope="col" className="px-4 py-3">
                          Paid
                        </th>
                        <th scope="col" className="px-4 py-3 text-right">
                          Photos
                        </th>
                        <th scope="col" className="px-4 py-3 text-right">
                          Service fee
                        </th>
                        <th scope="col" className="px-6 py-3 text-right">
                          Collected
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-[#EEF2F3]">
                      {data.transactions.map((item) => (
                        <tr
                          key={item.order_number}
                          className="hover:bg-[#F9FCFC]"
                        >
                          <td className="px-6 py-4">
                            <Link
                              href={`/dashboard/orders/${encodeURIComponent(
                                item.order_number
                              )}`}
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
                            {formatMoney(
                              item.photo_subtotal_cents,
                              currency
                            )}
                          </td>
                          <td className="whitespace-nowrap px-4 py-4 text-right text-[#526F77]">
                            {formatMoney(item.service_fee_cents, currency)}
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-right font-bold text-[#073B4C]">
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
                    Page {data.pagination.page} of{" "}
                    {data.pagination.total_pages}
                  </span>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={loading || page <= 1}
                      onClick={() => setPage((value) => value - 1)}
                      className="rounded-lg border border-[#D7E5E7] px-3 py-2 disabled:opacity-40"
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      disabled={
                        loading ||
                        page >= data.pagination.total_pages
                      }
                      onClick={() => setPage((value) => value + 1)}
                      className="rounded-lg border border-[#D7E5E7] px-3 py-2 disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </section>
          </>
        ) : null}
      </main>
    </div>
  )
}