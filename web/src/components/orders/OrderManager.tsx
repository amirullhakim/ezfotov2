"use client"

import Link from "next/link"
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Loader2,
  RefreshCw,
  Search,
  ShoppingBag,
} from "lucide-react"
import { useEffect, useState } from "react"

import { apiFetch } from "@/lib/api"


type Order = {
  order_number: string
  customer_name: string
  customer_email: string
  event_id: string
  event_title: string
  item_count: number
  currency: string
  photo_subtotal_cents: number
  service_fee_cents: number
  total_cents: number
  status: string
  payment_provider: string | null
  created_at: string
  paid_at: string | null
}

type OrdersResponse = {
  orders: Order[]
  pagination: {
    page: number
    page_size: number
    total: number
    total_pages: number
  }
}

const filters = [
  { label: "All", value: "" },
  { label: "Paid", value: "PAID" },
  { label: "Pending", value: "PENDING_PAYMENT" },
  { label: "Failed", value: "PAYMENT_FAILED" },
  { label: "Cancelled", value: "CANCELLED" },
  { label: "Expired", value: "EXPIRED" },
  { label: "Refunded", value: "REFUNDED" },
]

function money(cents: number, currency: string) {
  if (currency === "MYR") return `RM${(cents / 100).toFixed(2)}`

  return new Intl.NumberFormat("en", {
    style: "currency",
    currency,
  }).format(cents / 100)
}

function dateTime(value: string | null) {
  if (!value) return "—"

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"

  return new Intl.DateTimeFormat("en-MY", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kuala_Lumpur",
  }).format(date)
}

function StatusBadge({ status }: { status: string }) {
  const paid = status === "PAID"
  const pending = status === "PENDING_PAYMENT"

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${
        paid
          ? "bg-[#E6F7F0] text-[#16856F]"
          : pending
            ? "bg-[#FFF6E6] text-[#9B691A]"
            : "bg-[#F6ECEE] text-[#A44D57]"
      }`}
    >
      {status.replaceAll("_", " ")}
    </span>
  )
}

export default function OrderManager() {
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [status, setStatus] = useState("")
  const [page, setPage] = useState(1)
  const [reloadNonce, setReloadNonce] = useState(0)
  const [result, setResult] = useState<OrdersResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState("")

  useEffect(() => {
    const timer = window.setTimeout(
      () => setDebouncedSearch(search.trim()),
      350
    )

    return () => window.clearTimeout(timer)
  }, [search])

  useEffect(() => {
    let active = true

    async function load() {
      setLoading(true)
      setErrorMessage("")

      const query = new URLSearchParams({
        page: String(page),
        page_size: "20",
      })

      if (status) query.set("status", status)
      if (debouncedSearch) query.set("search", debouncedSearch)

      try {
        const response = await apiFetch<OrdersResponse>(
          `/api/event-sales/orders?${query.toString()}`
        )

        if (active) setResult(response)
      } catch (error) {
        if (active) {
          setResult(null)
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Unable to load orders."
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
  }, [page, status, debouncedSearch, reloadNonce])

  const orders = result?.orders ?? []
  const pagination = result?.pagination

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
              <h1 className="mt-1 text-lg font-semibold">Orders</h1>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setReloadNonce((n) => n + 1)}
            className="flex h-10 items-center gap-2 rounded-xl border border-[#D4E2E5] bg-white px-3 text-sm font-semibold text-[#45666F] hover:bg-[#F6FAFA]"
          >
            <RefreshCw className="h-4 w-4" />
            <span className="hidden sm:inline">Refresh</span>
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
              Customer orders
            </h2>
            <p className="mt-2 text-sm text-[#6D8289]">
              Review payments and photo sales across your events.
            </p>
          </div>

          {pagination && (
            <p className="text-sm font-medium text-[#6D8289]">
              {pagination.total} {pagination.total === 1 ? "order" : "orders"}
            </p>
          )}
        </div>

        <section
          className="mt-7 rounded-[24px] border border-[#DFE8EA] bg-white p-4 shadow-[0_12px_40px_rgba(8,47,60,0.04)] sm:p-6"
          aria-label="Orders"
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-[#869BA1]" />
              <input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value)
                  setPage(1)
                }}
                maxLength={120}
                aria-label="Search orders"
                placeholder="Search order, customer or event"
                className="h-10 w-full rounded-xl border border-[#DCE7E9] bg-[#FBFDFD] pl-10 pr-3 text-sm outline-none placeholder:text-[#9AABB1] focus:border-[#47C6CE] focus:ring-2 focus:ring-[#47C6CE]/20"
              />
            </div>

            <div
              className="flex gap-2 overflow-x-auto pb-1"
              aria-label="Filter orders by status"
            >
              {filters.map((filter) => (
                <button
                  key={filter.label}
                  type="button"
                  onClick={() => {
                    setStatus(filter.value)
                    setPage(1)
                  }}
                  aria-pressed={status === filter.value}
                  className={`shrink-0 rounded-full px-3 py-2 text-xs font-semibold transition ${
                    status === filter.value
                      ? "bg-[#073B4C] text-white"
                      : "bg-[#F2F7F8] text-[#607982] hover:bg-[#E6F1F3]"
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>

          {errorMessage && (
            <div
              role="alert"
              className="mt-5 rounded-xl border border-[#F0DCDD] bg-[#FFF7F7] p-4 text-sm text-[#94545C]"
            >
              {errorMessage}
            </div>
          )}

          {loading ? (
            <div className="flex min-h-52 items-center justify-center gap-2 text-sm text-[#667A83]">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading orders...
            </div>
          ) : !errorMessage && orders.length === 0 ? (
            <div className="flex min-h-52 flex-col items-center justify-center text-center">
              <ShoppingBag className="h-9 w-9 text-[#A8C7CC]" />
              <p className="mt-3 font-semibold">No orders found</p>
              <p className="mt-1 text-sm text-[#82969D]">
                Try another search or status filter.
              </p>
            </div>
          ) : !errorMessage ? (
            <div className="mt-5 overflow-x-auto rounded-2xl border border-[#E1EAEC]">
              <table className="w-full min-w-[1120px] text-left text-xs">
                <thead className="bg-[#F7FAFA] text-[11px] uppercase tracking-wide text-[#82969D]">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Order / Date</th>
                    <th className="px-4 py-3 font-semibold">Customer</th>
                    <th className="px-4 py-3 font-semibold">Event</th>
                    <th className="px-4 py-3 font-semibold">Photos</th>
                    <th className="px-4 py-3 font-semibold">Photo subtotal</th>
                    <th className="px-4 py-3 font-semibold">Service fee</th>
                    <th className="px-4 py-3 font-semibold">Total</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Provider</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-[#EDF2F3]">
                  {orders.map((order) => (
                    <tr
                      key={order.order_number}
                      className="hover:bg-[#FBFDFD]"
                    >
                      <td className="whitespace-nowrap px-4 py-4 align-top">
                        <p className="font-mono font-semibold text-[#244B55]">
                          {order.order_number}
                        </p>
                        <p className="mt-1 text-[#82969D]">
                          {dateTime(order.created_at)}
                        </p>
                      </td>

                      <td className="px-4 py-4 align-top">
                        <p className="font-semibold text-[#244B55]">
                          {order.customer_name}
                        </p>
                        <p className="mt-1 text-[#82969D]">
                          {order.customer_email}
                        </p>
                      </td>

                      <td className="px-4 py-4 align-top">
                        <Link
                          href={`/dashboard/events/${encodeURIComponent(order.event_id)}`}
                          className="font-semibold text-[#0D7E8C] hover:underline"
                        >
                          {order.event_title}
                        </Link>
                      </td>

                      <td className="px-4 py-4 align-top">
                        {order.item_count}
                      </td>

                      <td className="whitespace-nowrap px-4 py-4 align-top">
                        {money(order.photo_subtotal_cents, order.currency)}
                      </td>

                      <td className="whitespace-nowrap px-4 py-4 align-top">
                        {money(order.service_fee_cents, order.currency)}
                      </td>

                      <td className="whitespace-nowrap px-4 py-4 font-semibold align-top">
                        {money(order.total_cents, order.currency)}
                      </td>

                      <td className="px-4 py-4 align-top">
                        <StatusBadge status={order.status} />
                      </td>

                      <td className="px-4 py-4 align-top">
                        {order.payment_provider || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {pagination && pagination.total_pages > 1 && !errorMessage && (
            <div className="mt-5 flex items-center justify-between gap-3 border-t border-[#EDF2F3] pt-5">
              <p className="text-xs text-[#82969D]">
                Page {pagination.page} of {pagination.total_pages}
              </p>

              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={loading || page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  aria-label="Previous page"
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#DCE7E9] disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>

                <button
                  type="button"
                  disabled={loading || page >= pagination.total_pages}
                  onClick={() => setPage((p) => p + 1)}
                  aria-label="Next page"
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#DCE7E9] disabled:opacity-40"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}