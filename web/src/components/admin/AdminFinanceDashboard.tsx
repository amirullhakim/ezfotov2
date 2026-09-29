"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Loader2,
  ShieldCheck,
} from "lucide-react"

import { apiFetch } from "@/lib/api"

type Finance = {
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
  workspaces: {
    id: string
    name: string
    slug: string
    recorded_payments: number
    photo_sales_cents: number
    service_fees_cents: number
    total_collected_cents: number
  }[]
  transactions: {
    order_number: string
    workspace_name: string
    paid_at: string
    source: string
    photo_sales_cents: number
    service_fee_cents: number
    total_cents: number
  }[]
  pagination: {
    page: number
    page_size: number
    total: number
    total_pages: number
  }
}

const money = (cents: number) =>
  `RM ${(cents / 100).toFixed(2)}`

export default function AdminFinanceDashboard() {
  const [page, setPage] = useState(1)
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
  }, [page])

  return (
    <div className="min-h-screen bg-[#F5F8F9] text-[#173943]">
      <header className="border-b border-[#E0E9EB] bg-white">
        <div className="flex h-20 items-center gap-4 px-4 sm:px-6 lg:px-10">
          <Link
            href="/admin"
            aria-label="Back to platform dashboard"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#DCE7EA] text-[#557781] transition hover:bg-[#F4FAFA] hover:text-[#087F8C]"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>

          <div>
            <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.17em] text-[#0798A6]">
              <ShieldCheck className="h-4 w-4" />
              Platform Admin
            </p>
            <p className="mt-1 text-base font-semibold text-[#173943]">
              Finance
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#0798A6]">
              EZFOTOO · Platform Admin
            </p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight">
              Event Sales finance
            </h1>
            <p className="mt-2 text-sm text-[#6A7E86]">
              Verified payment records across all workspaces.
            </p>
          </div>
          <span className="rounded-full border border-[#D5E9EC] bg-white px-4 py-2 text-xs font-semibold text-[#55747E]">
            Currency: MYR
          </span>
        </div>

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
            <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                [
                  "Recorded payments",
                  String(data.summary.recorded_payments),
                ],
                ["Photo sales", money(data.summary.photo_sales_cents)],
                ["Service fees", money(data.summary.service_fees_cents)],
                [
                  "Total collected",
                  money(data.summary.total_collected_cents),
                ],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-2xl border border-[#DFE9EC] bg-white p-5 shadow-sm"
                >
                  <CircleDollarSign className="mb-5 h-5 w-5 text-[#0BA5B4]" />
                  <p className="text-sm text-[#607B84]">{label}</p>
                  <p className="mt-2 text-2xl font-semibold text-[#073B4C]">
                    {value}
                  </p>
                </div>
              ))}
            </div>

            <p className="mt-4 text-xs leading-5 text-[#667F87]">
              Gross recorded payments. Service fees are shown separately.
              Refunds, commission, payment costs and payouts are not
              deducted.
            </p>

            {data.coverage.paid_orders_missing > 0 && (
              <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
                {data.coverage.paid_orders_missing} older paid orders are
                not included in these ledger totals.
              </div>
            )}

            <section className="mt-8 overflow-hidden rounded-2xl border border-[#DFE9EC] bg-white shadow-sm">
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
                  <table className="w-full min-w-[700px] text-left text-sm">
                    <thead className="bg-[#F6F9FA] text-xs uppercase tracking-wide text-[#718991]">
                      <tr>
                        <th className="px-6 py-3">Workspace</th>
                        <th className="px-6 py-3">Payments</th>
                        <th className="px-6 py-3">Photo sales</th>
                        <th className="px-6 py-3">Service fees</th>
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

            <section className="mt-7 overflow-hidden rounded-2xl border border-[#DFE9EC] bg-white shadow-sm">
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
                  <table className="w-full min-w-[780px] text-left text-sm">
                    <thead className="bg-[#F6F9FA] text-xs uppercase tracking-wide text-[#718991]">
                      <tr>
                        <th className="px-6 py-3">Order / workspace</th>
                        <th className="px-6 py-3">Paid</th>
                        <th className="px-6 py-3">Photo sales</th>
                        <th className="px-6 py-3">Service fee</th>
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
                              }
                            )}
                          </td>
                          <td className="px-6 py-4">
                            {money(item.photo_sales_cents)}
                          </td>
                          <td className="px-6 py-4">
                            {money(item.service_fee_cents)}
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
                <div className="flex items-center justify-between border-t border-[#E7EEF0] px-6 py-4 text-sm">
                  <button
                    type="button"
                    disabled={page <= 1 || loading}
                    onClick={() => setPage(page - 1)}
                    className="inline-flex items-center gap-1 font-semibold text-[#087F8C] disabled:opacity-40"
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
                    className="inline-flex items-center gap-1 font-semibold text-[#087F8C] disabled:opacity-40"
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  )
}