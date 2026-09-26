"use client"

/* Signed private R2 images must bypass Next.js image optimization. */
/* eslint-disable @next/next/no-img-element */

import Link from "next/link"
import { useParams } from "next/navigation"
import {
  CheckCircle2,
  Download,
  FileImage,
  Loader2,
  RefreshCw,
  ShieldCheck,
  X,
} from "lucide-react"
import { useEffect, useRef, useState } from "react"

const API_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
).replace(/\/+$/, "")

const ORDER_ACCESS_STORAGE_PREFIX = "ezfotoo:event-order-access:"

type Order = {
  order_number: string
  status: string
  currency: string
  item_count: number
  photo_subtotal_cents: number
  service_fee_cents: number
  total_cents: number
  paid_at: string | null
}

type StatusResponse = { order: Order }

type DownloadItem = {
  photo_id: string
  filename: string
  size_bytes: number
  download_url: string
  view_url: string | null
}

type DownloadsResponse = {
  downloads: {
    expires_in_seconds: number
    items: DownloadItem[]
  }
}

type ViewState = "loading" | "missing" | "ready" | "error"

function money(cents: number, currency: string) {
  if (currency === "MYR") {
    return `RM${(cents / 100).toFixed(2)}`
  }

  return new Intl.NumberFormat("en", {
    style: "currency",
    currency,
  }).format(cents / 100)
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

async function postWithAccess<T>(
  path: string,
  accessToken: string
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ access_token: accessToken }),
    cache: "no-store",
  })

  const payload: unknown = await response.json()

  if (!response.ok) {
    const detail =
      typeof payload === "object" && payload !== null && "detail" in payload
        ? (payload as { detail?: unknown }).detail
        : null

    throw new Error(
      typeof detail === "string"
        ? detail
        : "Unable to load this order."
    )
  }

  return payload as T
}

export default function CustomerOrderPage() {
  const params = useParams<{ orderNumber: string }>()
  const orderNumber = (params.orderNumber || "").trim().toUpperCase()
  const tokenRef = useRef<{ orderNumber: string; value: string } | null>(null)
  const closeViewerButtonRef = useRef<HTMLButtonElement | null>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  const [view, setView] = useState<ViewState>("loading")
  const [order, setOrder] = useState<Order | null>(null)
  const [downloads, setDownloads] = useState<
    DownloadsResponse["downloads"] | null
  >(null)
  const [errorMessage, setErrorMessage] = useState("")
  const [refreshNonce, setRefreshNonce] = useState(0)
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    async function load() {
      setView("loading")
      setOrder(null)
      setDownloads(null)
      setErrorMessage("")

      if (!orderNumber) {
        setView("error")
        setErrorMessage("The order number is missing.")
        return
      }

      const hash = window.location.hash
      const fragmentToken = hash
        ? new URLSearchParams(hash.slice(1)).get("access")?.trim()
        : null

      if (fragmentToken) {
        tokenRef.current = {
          orderNumber,
          value: fragmentToken,
        }

        // A fragment is not included in HTTP requests. Remove it promptly
        // so it is no longer visible in the browser's address bar.
        window.history.replaceState(
          window.history.state,
          "",
          `${window.location.pathname}${window.location.search}`
        )

        try {
          window.sessionStorage.setItem(
            `${ORDER_ACCESS_STORAGE_PREFIX}${orderNumber}`,
            fragmentToken
          )
        } catch {
          // In-memory access still works if the browser blocks storage.
        }
      }

      let accessToken =
        tokenRef.current?.orderNumber === orderNumber
          ? tokenRef.current.value
          : ""

      if (!accessToken) {
        try {
          accessToken =
            window.sessionStorage.getItem(
              `${ORDER_ACCESS_STORAGE_PREFIX}${orderNumber}`
            ) || ""
        } catch {
          accessToken = ""
        }
      }

      if (!accessToken) {
        if (active) setView("missing")
        return
      }

      const path =
        `/api/public/events/orders/${encodeURIComponent(orderNumber)}`

      try {
        const result = await postWithAccess<StatusResponse>(
          `${path}/status`,
          accessToken
        )

        if (!active) return
        setOrder(result.order)

        if (result.order.status !== "PAID") {
          setView("ready")
          return
        }

        const files = await postWithAccess<DownloadsResponse>(
          `${path}/downloads`,
          accessToken
        )

        if (!active) return
        setDownloads(files.downloads)
        setView("ready")
      } catch (error) {
        if (!active) return

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to load this order."
        )
        setView("error")
      }
    }

    void load()

    return () => {
      active = false
    }
  }, [orderNumber, refreshNonce])

  useEffect(() => {
    if (!selectedPhotoId) return

    previousFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    closeViewerButtonRef.current?.focus()

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

  const paid = order?.status === "PAID"
  const pending = order?.status === "PENDING_PAYMENT"
  const selectedPhoto = downloads?.items.find(
    (photo) => photo.photo_id === selectedPhotoId
  )

  return (
    <main className="min-h-screen bg-[#F3FCFC] px-4 py-10 text-[#062F38] sm:py-16">
      <div className="mx-auto w-full max-w-xl">
        <p className="text-center text-xl font-bold tracking-[0.16em] text-[#0D5C68]">
          EZFOTOO
        </p>

        <section className="mt-7 rounded-[28px] border border-[#DCE8EA] bg-white p-6 shadow-[0_18px_55px_rgba(8,47,60,0.08)] sm:p-9">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#E7F8F3]">
            {view === "loading" ? (
              <Loader2 className="h-7 w-7 animate-spin text-[#0D5C68]" />
            ) : paid ? (
              <CheckCircle2 className="h-7 w-7 text-[#16856F]" />
            ) : (
              <ShieldCheck className="h-7 w-7 text-[#0D5C68]" />
            )}
          </div>

          <h1 className="mt-5 text-center text-2xl font-semibold tracking-tight">
            {view === "loading"
              ? "Loading your order"
              : paid
                ? "Your photos are ready"
                : pending
                  ? "Payment is being confirmed"
                  : "Your order"}
          </h1>

          <p className="mt-2 text-center text-sm leading-6 text-[#657E84]">
            {view === "missing"
              ? "Open the secure link in your confirmation email to access this order."
              : view === "loading"
                ? "We are checking the latest order status securely."
                : paid
                  ? "Your payment has been verified. View and download your original photos below."
                  : pending
                    ? "Please check again in a moment. Downloads appear after payment is verified."
                    : "Order access and download availability depend on its verified status."}
          </p>

          {order && (
            <div className="mt-7 rounded-2xl border border-[#DDE8EA] bg-[#F8FBFB] p-5">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-[#74878E]">
                Order number
              </p>

              <p className="mt-1 break-all font-mono text-sm font-semibold">
                {order.order_number}
              </p>

              <div className="mt-5 space-y-3 border-t border-[#DFE9EB] pt-4 text-sm">
                <div className="flex justify-between gap-4">
                  <span>Photos</span>
                  <span className="font-medium">{order.item_count}</span>
                </div>

                <div className="flex justify-between gap-4">
                  <span>Photo subtotal</span>
                  <span>{money(order.photo_subtotal_cents, order.currency)}</span>
                </div>

                <div className="flex justify-between gap-4">
                  <span>Service fee</span>
                  <span>{money(order.service_fee_cents, order.currency)}</span>
                </div>

                <div className="flex justify-between gap-4 border-t border-[#DFE9EB] pt-3 text-base font-semibold">
                  <span>{paid ? "Total paid" : "Order total"}</span>
                  <span>{money(order.total_cents, order.currency)}</span>
                </div>
              </div>

              <p className="mt-4 text-xs text-[#657E84]">
                Status: {order.status.replaceAll("_", " ")}
              </p>
            </div>
          )}

          {paid && downloads && (
            <section className="mt-6" aria-label="Purchased photos">
              <h2 className="font-semibold">Original photos</h2>

              <p className="mt-1 text-xs leading-5 text-[#657E84]">
                Download links expire in about{" "}
                {Math.max(
                  1,
                  Math.ceil(downloads.expires_in_seconds / 60)
                )}{" "}
                minutes. Use Refresh download links whenever you need new ones.
              </p>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {downloads.items.map((photo, index) => (
                  <article
                    key={photo.photo_id}
                    className="overflow-hidden rounded-2xl border border-[#DCE8EA] bg-white"
                  >
                    <div className="flex aspect-[4/3] items-center justify-center bg-[#F3F8F8]">
                      {photo.view_url ? (
                        <button
                          type="button"
                          onClick={() => setSelectedPhotoId(photo.photo_id)}
                          aria-label={`View ${
                            photo.filename || `photo ${index + 1}`
                          } full size`}
                          className="flex h-full w-full items-center justify-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0D5C68]"
                        >
                          <img
                            src={photo.view_url}
                            alt={`Purchased photo ${index + 1}: ${photo.filename}`}
                            loading="lazy"
                            decoding="async"
                            referrerPolicy="no-referrer"
                            className="h-full w-full cursor-zoom-in object-contain"
                          />
                        </button>
                      ) : (
                        <FileImage
                          aria-hidden="true"
                          className="h-12 w-12 text-[#9ABBC0]"
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

                      <p className="mt-1 text-xs text-[#74878E]">
                        {formatBytes(photo.size_bytes)}
                      </p>

                      <div className="mt-4">
                        <a
                          href={photo.download_url}
                          className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-[#073B4C] px-3 text-xs font-semibold text-white hover:bg-[#0B5363]"
                          aria-label={`Download ${
                            photo.filename || `photo ${index + 1}`
                          }`}
                        >
                          <Download className="h-4 w-4" />
                          Download
                        </a>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}

          {view === "error" && (
            <p
              role="alert"
              className="mt-6 rounded-xl border border-[#F0DCDD] bg-[#FFF7F7] p-4 text-sm text-[#94545C]"
            >
              {errorMessage}
            </p>
          )}

          {(view === "error" || pending || paid) && (
            <button
              type="button"
              onClick={() => {
                setSelectedPhotoId(null)
                setRefreshNonce((value) => value + 1)
              }}
              className="mt-6 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#D4E2E5] bg-white text-sm font-semibold text-[#45666F] hover:bg-[#F6FAFA]"
            >
              <RefreshCw className="h-4 w-4" />
              {paid ? "Refresh download links" : "Check order again"}
            </button>
          )}

          <Link
            href="/"
            className="mt-4 flex h-11 w-full items-center justify-center rounded-xl bg-[#073B4C] text-sm font-semibold text-white hover:bg-[#0B5363]"
          >
            Return to EZFOTOO
          </Link>
        </section>

        <p className="mt-6 text-center text-xs text-[#74878E]">
          Keep your confirmation email private. Its link grants access to your purchased photos.
        </p>
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
              {selectedPhoto.filename || "Purchased photo"}
            </p>

            <button
              ref={closeViewerButtonRef}
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
              alt={selectedPhoto.filename || "Purchased photo"}
              referrerPolicy="no-referrer"
              className="max-h-full max-w-full object-contain"
            />
          </div>

          <div className="relative mx-auto flex w-full max-w-7xl justify-center">
            <a
              href={selectedPhoto.download_url}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-semibold text-[#073B4C] hover:bg-[#E7F8F3]"
            >
              <Download className="h-4 w-4" />
              Download photo
            </a>
          </div>
        </div>
      )}
    </main>
  )
}