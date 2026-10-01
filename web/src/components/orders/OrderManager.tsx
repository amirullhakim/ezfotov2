"use client"

import Link from "next/link"
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  RefreshCw,
  Search,
  ShoppingBag,
} from "lucide-react"
import { useEffect, useState } from "react"

import { apiFetch } from "@/lib/api"
import DashboardPage, {
  dashboardButtonClass,
  dashboardCardClass,
  formatDashboardMoney as money,
} from "@/components/dashboard/DashboardPage"

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
    <DashboardPage
      title="Orders"
      heading="Customer orders"
      description="Review payments and photo sales across your events."
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
        pagination && (
          <p className="text-sm font-medium text-[#6D8289]">
            {pagination.total}{" "}
            {pagination.total === 1 ? "order" : "orders"}
          </p>
        )
      }
    >
      <section
        className={`${dashboardCardClass} mt-7 p-4 sm:p-6`}
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
            <table className="w-full min-w-[1120px] text-left text-sm">
              <thead className="bg-[#F7FAFA] text-xs uppercase tracking-wide text-[#82969D]">
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
                  <tr key={order.order_number} className="hover:bg-[#FBFDFD]">
                    <td className="whitespace-nowrap px-4 py-4 align-top">
                      <Link
                        href={`/dashboard/orders/${encodeURIComponent(order.order_number)}`}
                        className="font-mono font-semibold text-[#0D7E8C] hover:underline"
                      >
                        {order.order_number}
                      </Link>
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
                    <td className="whitespace-nowrap px-4 py-4 align-top font-semibold">
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
    </DashboardPage>
  )
}