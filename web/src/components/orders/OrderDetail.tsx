"use client"

/* Signed private R2 images must bypass Next.js image optimization. */
/* eslint-disable @next/next/no-img-element */

import Link from "next/link"
import { useParams } from "next/navigation"
import {
  ArrowLeft,
  FileImage,
  Loader2,
  RefreshCw,
  X,
} from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { apiFetch } from "@/lib/api"

type Order = {
  order_number: string
  customer_name: string
  customer_email: string
  event_id: string
  event_title: string
  status: string
  currency: string
  item_count: number
  regular_subtotal_cents: number
  discount_cents: number
  photo_subtotal_cents: number
  service_fee_cents: number
  total_cents: number
  payment_provider: string | null
  created_at: string
  paid_at: string | null
  expires_at: string | null
}

type Photo = {
  photo_id: string
  filename: string
  size_bytes: number
  unit_price_cents: number
  view_url: string | null
}

type DetailResponse = {
  order: Order
  photos: Photo[]
}

function money(cents: number, currency: string) {
  if (currency === "MYR") {
    return `RM${(cents / 100).toFixed(2)}`
  }

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

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function StatusBadge({ status }: { status: string }) {
  const colors =
    status === "PAID"
      ? "bg-[#E6F7F0] text-[#16856F]"
      : status === "PENDING_PAYMENT"
        ? "bg-[#FFF6E6] text-[#9B691A]"
        : "bg-[#F6ECEE] text-[#A44D57]"

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1.5 text-xs font-semibold ${colors}`}
    >
      {status.replaceAll("_", " ")}
    </span>
  )
}

export default function OrderDetail() {
  const params = useParams<{ orderNumber: string }>()
  const orderNumber = (params.orderNumber || "").trim().toUpperCase()
  const closeButtonRef = useRef<HTMLButtonElement | null>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  const [data, setData] = useState<DetailResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState("")
  const [reloadNonce, setReloadNonce] = useState(0)
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    async function load() {
      setLoading(true)
      setErrorMessage("")
      setData(null)

      try {
        const result = await apiFetch<DetailResponse>(
          `/api/event-sales/orders/${encodeURIComponent(orderNumber)}`
        )

        if (active) setData(result)
      } catch (error) {
        if (active) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Unable to load this order."
          )
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    if (orderNumber) {
      void load()
    } else {
      setLoading(false)
      setErrorMessage("Order number is missing.")
    }

    return () => {
      active = false
    }
  }, [orderNumber, reloadNonce])

  useEffect(() => {
    if (!selectedPhotoId) return

    previousFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    closeButtonRef.current?.focus()

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSelectedPhotoId(null)
      }
    }

    window.addEventListener("keydown", handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener("keydown", handleKeyDown)
      previousFocusRef.current?.focus()
    }
  }, [selectedPhotoId])

  const selectedPhoto = data?.photos.find(
    (photo) => photo.photo_id === selectedPhotoId
  )
  const order = data?.order

  return (
    <main className="min-h-screen bg-[#F5F8F9] text-[#173D47]">
      <header className="sticky top-0 z-30 border-b border-[#DFE8EA] bg-white/95 backdrop-blur">
        <div className="mx-auto flex min-h-[76px] max-w-[1200px] items-center justify-between gap-4 px-5 lg:px-8">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard/orders"
              aria-label="Back to orders"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#E1EAEC] text-[#58717A] hover:bg-[#F4F8F9]"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>

            <div>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#0A8D99]">
                Event Sales
              </p>
              <h1 className="mt-1 text-lg font-semibold">
                Order detail
              </h1>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setSelectedPhotoId(null)
              setReloadNonce((n) => n + 1)
            }}
            className="flex h-10 items-center gap-2 rounded-xl border border-[#D4E2E5] bg-white px-3 text-sm font-semibold text-[#45666F] hover:bg-[#F6FAFA]"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-[1200px] px-5 py-8 lg:px-8 lg:py-10">
        {loading ? (
          <div className="flex min-h-72 items-center justify-center gap-2 text-sm text-[#667A83]">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading order...
          </div>
        ) : errorMessage ? (
          <div
            role="alert"
            className="rounded-2xl border border-[#F0DCDD] bg-[#FFF7F7] p-5 text-sm text-[#94545C]"
          >
            {errorMessage}
          </div>
        ) : order && data ? (
          <>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#0A929F]">
                  Customer order
                </p>
                <h2 className="mt-2 break-all text-2xl font-semibold tracking-tight text-[#112D38] sm:text-3xl">
                  {order.order_number}
                </h2>
                <p className="mt-2 text-sm text-[#6D8289]">
                  Placed {dateTime(order.created_at)}
                </p>
              </div>

              <StatusBadge status={order.status} />
            </div>

            <div className="mt-7 grid gap-5 lg:grid-cols-[1.3fr_0.7fr]">
              <section
                className="rounded-[24px] border border-[#DFE8EA] bg-white p-5 sm:p-6"
                aria-label="Customer and payment"
              >
                <h3 className="font-semibold">Customer and payment</h3>

                <dl className="mt-5 grid gap-5 sm:grid-cols-2">
                  <div>
                    <dt className="text-xs text-[#82969D]">Customer</dt>
                    <dd className="mt-1 font-medium">
                      {order.customer_name}
                    </dd>
                  </div>

                  <div>
                    <dt className="text-xs text-[#82969D]">Email</dt>
                    <dd className="mt-1 break-all font-medium">
                      {order.customer_email}
                    </dd>
                  </div>

                  <div>
                    <dt className="text-xs text-[#82969D]">Event</dt>
                    <dd className="mt-1 font-medium">
                      <Link
                        href={`/dashboard/events/${encodeURIComponent(order.event_id)}`}
                        className="text-[#0D7E8C] hover:underline"
                      >
                        {order.event_title}
                      </Link>
                    </dd>
                  </div>

                  <div>
                    <dt className="text-xs text-[#82969D]">
                      Payment provider
                    </dt>
                    <dd className="mt-1 font-medium">
                      {order.payment_provider || "—"}
                    </dd>
                  </div>

                  <div>
                    <dt className="text-xs text-[#82969D]">
                      Paid at
                    </dt>
                    <dd className="mt-1 font-medium">
                      {dateTime(order.paid_at)}
                    </dd>
                  </div>

                  {order.status === "PENDING_PAYMENT" && (
                    <div>
                      <dt className="text-xs text-[#82969D]">
                        Payment expiry
                      </dt>
                      <dd className="mt-1 font-medium">
                        {dateTime(order.expires_at)}
                      </dd>
                    </div>
                  )}
                </dl>
              </section>

              <section
                className="rounded-[24px] border border-[#DFE8EA] bg-white p-5 sm:p-6"
                aria-label="Payment breakdown"
              >
                <h3 className="font-semibold">Payment breakdown</h3>

                <dl className="mt-5 space-y-3 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt>Photos</dt>
                    <dd>{order.item_count}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt>Regular subtotal</dt>
                    <dd>
                      {money(order.regular_subtotal_cents, order.currency)}
                    </dd>
                  </div>

                  {order.discount_cents > 0 && (
                    <div className="flex justify-between gap-4 text-[#16856F]">
                      <dt>Bundle discount</dt>
                      <dd>
                        −{money(order.discount_cents, order.currency)}
                      </dd>
                    </div>
                  )}

                  <div className="flex justify-between gap-4">
                    <dt>Photo subtotal</dt>
                    <dd>
                      {money(order.photo_subtotal_cents, order.currency)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt>Service fee</dt>
                    <dd>
                      {money(order.service_fee_cents, order.currency)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4 border-t border-[#E8EFF0] pt-4 text-base font-semibold">
                    <dt>Total</dt>
                    <dd>{money(order.total_cents, order.currency)}</dd>
                  </div>
                </dl>
              </section>
            </div>

            <section
              className="mt-5 rounded-[24px] border border-[#DFE8EA] bg-white p-5 sm:p-6"
              aria-label="Ordered photos"
            >
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h3 className="font-semibold">Ordered photos</h3>
                  <p className="mt-1 text-xs text-[#82969D]">
                    Photo previews use temporary private links.
                    Refresh to renew them.
                  </p>
                </div>
                <p className="text-xs text-[#82969D]">
                  {data.photos.length} photos
                </p>
              </div>

              {data.photos.length === 0 ? (
                <p className="mt-5 rounded-xl bg-[#F7FAFA] p-5 text-sm text-[#82969D]">
                  No photo records were found for this order.
                </p>
              ) : (
                <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {data.photos.map((photo, index) => (
                    <article
                      key={photo.photo_id}
                      className="overflow-hidden rounded-2xl border border-[#E1EAEC]"
                    >
                      <div className="flex aspect-[4/3] items-center justify-center bg-[#F3F8F8]">
                        {photo.view_url ? (
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedPhotoId(photo.photo_id)
                            }
                            aria-label={`View ${
                              photo.filename || `photo ${index + 1}`
                            }`}
                            className="flex h-full w-full items-center justify-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0D5C68]"
                          >
                            <img
                              src={photo.view_url}
                              alt={`Ordered photo ${index + 1}: ${photo.filename}`}
                              loading="lazy"
                              decoding="async"
                              referrerPolicy="no-referrer"
                              className="h-full w-full cursor-zoom-in object-contain"
                            />
                          </button>
                        ) : (
                          <FileImage
                            aria-hidden="true"
                            className="h-10 w-10 text-[#9ABBC0]"
                          />
                        )}
                      </div>

                      <div className="p-4">
                        <p
                          className="truncate text-sm font-semibold"
                          title={photo.filename}
                        >
                          {photo.filename || `Photo ${index + 1}`}
                        </p>
                        <p className="mt-1 text-xs text-[#82969D]">
                          {formatBytes(photo.size_bytes)} · Unit price{" "}
                          {money(photo.unit_price_cents, order.currency)}
                        </p>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </>
        ) : null}
      </div>

      {selectedPhoto?.view_url && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="photo-viewer-title"
          className="fixed inset-0 z-50 flex flex-col bg-[#061B22]/95 p-4 text-white sm:p-6"
        >
          <button
            type="button"
            aria-label="Close photo viewer"
            onClick={() => setSelectedPhotoId(null)}
            className="absolute inset-0 cursor-default"
          />

          <div className="relative mx-auto flex w-full max-w-7xl items-center justify-between gap-4">
            <p
              id="photo-viewer-title"
              className="min-w-0 truncate text-sm font-medium"
            >
              {selectedPhoto.filename || "Ordered photo"}
            </p>

            <button
              ref={closeButtonRef}
              type="button"
              onClick={() => setSelectedPhotoId(null)}
              aria-label="Close photo viewer"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="pointer-events-none relative flex min-h-0 flex-1 items-center justify-center py-5">
            <img
              src={selectedPhoto.view_url}
              alt={selectedPhoto.filename || "Ordered photo"}
              referrerPolicy="no-referrer"
              className="max-h-full max-w-full object-contain"
            />
          </div>
        </div>
      )}
    </main>
  )
}