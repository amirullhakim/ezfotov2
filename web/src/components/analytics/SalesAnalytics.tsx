"use client"

import Link from "next/link"
import { BarChart3, Loader2, RefreshCw } from "lucide-react"
import { useEffect, useState } from "react"

import { apiFetch } from "@/lib/api"
import DashboardPage, {
  dashboardButtonClass,
  dashboardCardClass,
  DashboardMetric,
  formatDashboardMoney as money,
} from "@/components/dashboard/DashboardPage"

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
    <DashboardPage
      title="Sales analytics"
      heading="Sales overview"
      description="Based on paid orders in MYR. Figures are before payment processing costs or payouts."
      actions={
        <button
          type="button"
          onClick={() => setReloadNonce((n) => n + 1)}
          disabled={loading}
          className={dashboardButtonClass}
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      }
      summary={
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
      }
    >
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
              <DashboardMetric
                key={card.label}
                label={card.label}
                value={card.value}
              />
            ))}
          </div>

          <section className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className={`${dashboardCardClass} p-6`}>
              <p className="text-sm text-[#70868E]">
                Service fees collected
              </p>
              <p className="mt-2 text-xl font-semibold">
                {money(totals.service_fees_cents, currency)}
              </p>
            </div>
            <div className={`${dashboardCardClass} p-6`}>
              <p className="text-sm text-[#70868E]">Total collected</p>
              <p className="mt-2 text-xl font-semibold">
                {money(totals.total_collected_cents, currency)}
              </p>
            </div>
          </section>

          <section className={`${dashboardCardClass} mt-7 p-5 sm:p-6`}>
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
                      <th className="px-4 py-3 font-semibold">Paid orders</th>
                      <th className="px-4 py-3 font-semibold">Photos sold</th>
                      <th className="px-4 py-3 font-semibold">Photo sales</th>
                      <th className="px-4 py-3 font-semibold">Service fees</th>
                      <th className="px-4 py-3 font-semibold">Total collected</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EDF2F3]">
                    {(selectedEvent
                      ? events.filter(
                          (event) => event.event_id === selectedEvent
                        )
                      : events
                    ).map((event) => (
                      <tr key={event.event_id} className="hover:bg-[#FBFDFD]">
                        <td className="px-4 py-4 font-semibold">
                          <Link
                            href={`/dashboard/events/${encodeURIComponent(event.event_id)}`}
                            className="text-[#0D7E8C] hover:underline"
                          >
                            {event.event_title}
                          </Link>
                        </td>
                        <td className="px-4 py-4">{event.paid_orders}</td>
                        <td className="px-4 py-4">{event.photos_sold}</td>
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
    </DashboardPage>
  )
}