"use client"

import Link from "next/link"
import { ArrowLeft, BarChart3, Loader2, RefreshCw } from "lucide-react"
import { useEffect, useState } from "react"

import { apiFetch } from "@/lib/api"

type EventSales = {
  event_id: string
  event_title: string
  paid_orders: number
  photos_sold: number
  photo_sales_cents: number
  service_fees_cents: number
  total_collected_cents: number
  average_order_value_cents: number
}

type AnalyticsResponse = {
  currency: string
  summary: {
    paid_orders: number
    photos_sold: number
    photo_sales_cents: number
    service_fees_cents: number
    total_collected_cents: number
    average_order_value_cents: number
  }
  events: EventSales[]
}

function money(cents: number, currency: string) {
  if (currency === "MYR") return `RM${(cents / 100).toFixed(2)}`

  return new Intl.NumberFormat("en", {
    style: "currency",
    currency,
  }).format(cents / 100)
}

export default function SalesAnalytics() {
  const [data, setData] = useState<AnalyticsResponse | null>(null)
  const [selectedEvent, setSelectedEvent] = useState("")
  const [reloadNonce, setReloadNonce] = useState(0)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState("")

  useEffect(() => {
    let active = true

    async function load() {
      setLoading(true)
      setErrorMessage("")

      try {
        const result = await apiFetch<AnalyticsResponse>(
          "/api/event-sales/orders/analytics"
        )

        if (active) setData(result)
      } catch (error) {
        if (active) {
          setData(null)
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Unable to load sales analytics."
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
  }, [reloadNonce])

  const events = data?.events ?? []
  const current = selectedEvent
    ? events.find((event) => event.event_id === selectedEvent)
    : null
  const totals = current ?? data?.summary
  const currency = data?.currency ?? "MYR"

  return (
    <main className="min-h-screen bg-[#F5F8F9] text-[#173D47]">
      <header className="sticky top-0 z-30 border-b border-[#DFE8EA] bg-white/95 backdrop-blur">
        <div className="mx-auto flex min-h-[76px] max-w-[1440px] items-center justify-between gap-4 px-5 lg:px-8">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              aria-label="Back to dashboard"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#E1EAEC] text-[#58717A] hover:bg-[#F4F8F9]"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#0A8D99]">
                Event Sales
              </p>
              <h1 className="mt-1 text-lg font-semibold">Sales analytics</h1>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setReloadNonce((n) => n + 1)}
            disabled={loading}
            className="flex h-10 items-center gap-2 rounded-xl border border-[#D4E2E5] bg-white px-3 text-sm font-semibold text-[#45666F] hover:bg-[#F6FAFA] disabled:opacity-50"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-[1440px] px-5 py-8 lg:px-8 lg:py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#0A929F]">
              Photography commerce
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-[#112D38]">
              Sales overview
            </h2>
            <p className="mt-2 text-sm text-[#6D8289]">
              Based on paid orders in MYR. Figures are before payment
              processing costs or payouts.
            </p>
          </div>

          <label className="flex items-center gap-3 text-sm font-medium text-[#4D6972]">
            Event
            <select
              value={selectedEvent}
              onChange={(event) => setSelectedEvent(event.target.value)}
              disabled={!data || events.length === 0}
              className="h-10 max-w-[270px] rounded-xl border border-[#DCE7E9] bg-white px-3 text-sm text-[#173D47] outline-none focus:border-[#47C6CE] disabled:opacity-50"
            >
              <option value="">All events</option>
              {events.map((event) => (
                <option key={event.event_id} value={event.event_id}>
                  {event.event_title}
                </option>
              ))}
            </select>
          </label>
        </div>

        {errorMessage && (
          <div
            role="alert"
            className="mt-7 rounded-xl border border-[#F0DCDD] bg-[#FFF7F7] p-4 text-sm text-[#94545C]"
          >
            {errorMessage}
          </div>
        )}

        {loading && (
          <div className="mt-7 flex min-h-48 items-center justify-center gap-2 rounded-[24px] border border-[#DFE8EA] bg-white text-sm text-[#667A83]">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading sales...
          </div>
        )}

        {!loading && totals && (
          <>
            <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                {
                  label: "Photo sales",
                  value: money(totals.photo_sales_cents, currency),
                },
                { label: "Paid orders", value: String(totals.paid_orders) },
                { label: "Photos sold", value: String(totals.photos_sold) },
                {
                  label: "Average order",
                  value: money(totals.average_order_value_cents, currency),
                },
              ].map((card) => (
                <div
                  key={card.label}
                  className="rounded-[24px] border border-[#DFE8EA] bg-white p-6 shadow-[0_12px_40px_rgba(8,47,60,0.04)]"
                >
                  <p className="text-sm text-[#70868E]">{card.label}</p>
                  <p className="mt-3 text-3xl font-semibold tracking-tight text-[#123743]">
                    {card.value}
                  </p>
                </div>
              ))}
            </div>

            <section className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="rounded-[24px] border border-[#DFE8EA] bg-white p-6">
                <p className="text-sm text-[#70868E]">
                  Service fees collected
                </p>
                <p className="mt-2 text-xl font-semibold">
                  {money(totals.service_fees_cents, currency)}
                </p>
              </div>

              <div className="rounded-[24px] border border-[#DFE8EA] bg-white p-6">
                <p className="text-sm text-[#70868E]">Total collected</p>
                <p className="mt-2 text-xl font-semibold">
                  {money(totals.total_collected_cents, currency)}
                </p>
              </div>
            </section>

            <section className="mt-7 rounded-[24px] border border-[#DFE8EA] bg-white p-5 shadow-[0_12px_40px_rgba(8,47,60,0.04)] sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold">Sales by event</h3>
                  <p className="mt-1 text-sm text-[#70868E]">
                    Paid orders and photo sales for each event.
                  </p>
                </div>
                <Link
                  href="/dashboard/orders"
                  className="text-sm font-semibold text-[#0D7E8C] hover:underline"
                >
                  View orders
                </Link>
              </div>

              {events.length === 0 ? (
                <div className="flex min-h-40 flex-col items-center justify-center text-center text-[#82969D]">
                  <BarChart3 className="mb-3 h-8 w-8" />
                  <p>No paid orders yet.</p>
                </div>
              ) : (
                <div className="mt-5 overflow-x-auto rounded-2xl border border-[#E1EAEC]">
                  <table className="w-full min-w-[760px] text-left text-sm">
                    <thead className="bg-[#F7FAFA] text-xs uppercase tracking-wide text-[#82969D]">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Event</th>
                        <th className="px-4 py-3 font-semibold">
                          Paid orders
                        </th>
                        <th className="px-4 py-3 font-semibold">
                          Photos sold
                        </th>
                        <th className="px-4 py-3 font-semibold">
                          Photo sales
                        </th>
                        <th className="px-4 py-3 font-semibold">
                          Service fees
                        </th>
                        <th className="px-4 py-3 font-semibold">
                          Total collected
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-[#EDF2F3]">
                      {(selectedEvent
                        ? events.filter(
                            (event) => event.event_id === selectedEvent
                          )
                        : events
                      ).map((event) => (
                        <tr
                          key={event.event_id}
                          className="hover:bg-[#FBFDFD]"
                        >
                          <td className="px-4 py-4 font-semibold">
                            <Link
                              href={`/dashboard/events/${encodeURIComponent(
                                event.event_id
                              )}`}
                              className="text-[#0D7E8C] hover:underline"
                            >
                              {event.event_title}
                            </Link>
                          </td>
                          <td className="px-4 py-4">
                            {event.paid_orders}
                          </td>
                          <td className="px-4 py-4">
                            {event.photos_sold}
                          </td>
                          <td className="whitespace-nowrap px-4 py-4">
                            {money(event.photo_sales_cents, currency)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-4">
                            {money(event.service_fees_cents, currency)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-4 font-semibold">
                            {money(event.total_collected_cents, currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  )
}