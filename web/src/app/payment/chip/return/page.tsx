"use client"

import Link from "next/link"

import {
  CheckCircle2,
  Clock3,
  Download,
  FileImage,
  Landmark,
  Loader2,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from "lucide-react"

import {
  useCallback,
  useEffect,
  useState,
} from "react"


const API_URL = (
  process.env.NEXT_PUBLIC_API_URL
  || "http://localhost:8000"
).replace(
  /\/+$/,
  ""
)


const ORDER_ACCESS_STORAGE_PREFIX =
  "ezfotoo:event-order-access:"


const ORDER_RETURN_PATH_STORAGE_PREFIX =
  "ezfotoo:event-order-return:"


const ORDER_PAYMENT_PATH_STORAGE_PREFIX =
  "ezfotoo:event-order-payment-path:"


const MAX_STATUS_ATTEMPTS = 12
const STATUS_RETRY_DELAY_MS = 1500


type OrderStatusResponse = {
  order: {
    order_number: string
    status: string
    currency: string
    item_count: number
    total_cents: number
    total_rm: number
    paid_at: string | null
    expires_at: string | null
  }
}


type StartPaymentResponse = {
  order: {
    order_number: string
    status: string
    currency: string
    total_cents: number
    total_rm: number
  }

  payment: {
    provider: string
    purchase_id: string
    checkout_url: string
    reused: boolean
    mode: string
  }
}


type OrderDownloadsResponse = {
  order: {
    order_number: string
    status: string
    currency: string
    item_count: number
    total_cents: number
    total_rm: number
  }

  downloads: {
    expires_in_seconds: number
    expires_at: string
    items: Array<{
      photo_id: string
      filename: string
      content_type: string
      size_bytes: number
      download_url: string
    }>
  }
}


type VerificationState =
  | "loading"
  | "paid"
  | "pending"
  | "failed"
  | "cancelled"
  | "expired"
  | "refunded"
  | "unavailable"
  | "error"


function orderAccessStorageKey(
  orderNumber: string
) {
  return (
    `${ORDER_ACCESS_STORAGE_PREFIX}${orderNumber}`
  )
}


function orderReturnPathStorageKey(
  orderNumber: string
) {
  return (
    `${ORDER_RETURN_PATH_STORAGE_PREFIX}${orderNumber}`
  )
}


function orderPaymentPathStorageKey(
  orderNumber: string
) {
  return (
    `${ORDER_PAYMENT_PATH_STORAGE_PREFIX}${orderNumber}`
  )
}


function stateFromOrderStatus(
  status: string
): VerificationState {
  switch (
    status
      .trim()
      .toUpperCase()
  ) {
    case "PAID":
      return "paid"

    case "PAYMENT_FAILED":
      return "failed"

    case "CANCELLED":
      return "cancelled"

    case "EXPIRED":
      return "expired"

    case "REFUNDED":
      return "refunded"

    default:
      return "pending"
  }
}


function formatBytes(
  value: number
) {
  if (value < 1024) {
    return `${value} B`
  }

  const kilobytes =
    value / 1024

  if (kilobytes < 1024) {
    return `${kilobytes.toFixed(1)} KB`
  }

  const megabytes =
    kilobytes / 1024

  return `${megabytes.toFixed(1)} MB`
}


export default function ChipReturnPage() {
  const [
    orderNumber,
    setOrderNumber,
  ] = useState(
    ""
  )

  const [
    returnPath,
    setReturnPath,
  ] = useState(
    "/"
  )

  const [
    returnResult,
    setReturnResult,
  ] = useState(
    ""
  )

  const [
    paymentPath,
    setPaymentPath,
  ] = useState(
    ""
  )

  const [
    paymentStarting,
    setPaymentStarting,
  ] = useState(
    false
  )

  const [
    paymentStartError,
    setPaymentStartError,
  ] = useState(
    ""
  )


  const [
    verificationState,
    setVerificationState,
  ] = useState<VerificationState>(
    "loading"
  )

  const [
    order,
    setOrder,
  ] = useState<OrderStatusResponse["order"] | null>(
    null
  )

  const [
    errorMessage,
    setErrorMessage,
  ] = useState(
    ""
  )

  const [
    retryNonce,
    setRetryNonce,
  ] = useState(
    0
  )


  const [
    accessToken,
    setAccessToken,
  ] = useState(
    ""
  )

  const [
    downloads,
    setDownloads,
  ] = useState<OrderDownloadsResponse["downloads"] | null>(
    null
  )

  const [
    downloadsLoading,
    setDownloadsLoading,
  ] = useState(
    false
  )

  const [
    downloadsError,
    setDownloadsError,
  ] = useState(
    ""
  )

  const [
    downloadRefreshNonce,
    setDownloadRefreshNonce,
  ] = useState(
    0
  )


  const fetchOrderStatus =
    useCallback(
      async (
        currentOrderNumber: string,
        accessToken: string
      ) => {
        const response =
          await fetch(
            `${API_URL}/api/public/events/orders/${encodeURIComponent(
              currentOrderNumber
            )}/status`,
            {
              method:
                "POST",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body:
                JSON.stringify({
                  access_token:
                    accessToken,
                }),

              cache:
                "no-store",
            }
          )


        const payload =
          (
            await response.json()
          ) as (
            OrderStatusResponse
            | {
                detail?: string
              }
          )


        if (!response.ok) {
          throw new Error(
            "detail" in payload
              && payload.detail
              ? payload.detail
              : "Unable to verify this order."
          )
        }


        return (
          payload as OrderStatusResponse
        )
      },
      []
    )


  useEffect(
    () => {
      const params =
        new URLSearchParams(
          window.location.search
        )


      const currentResult =
        (
          params.get(
            "result"
          )
          || ""
        )
          .trim()
          .toLowerCase()


      setReturnResult(
        currentResult
      )


      const currentOrderNumber =
        (
          params.get(
            "order"
          )
          || ""
        )
          .trim()
          .toUpperCase()


      setOrderNumber(
        currentOrderNumber
      )


      if (!currentOrderNumber) {
        setVerificationState(
          "error"
        )

        setErrorMessage(
          "The payment return did not include an order number."
        )

        return
      }


      let accessToken = ""


      try {
        accessToken =
          window.sessionStorage.getItem(
            orderAccessStorageKey(
              currentOrderNumber
            )
          )
          || ""


        const storedReturnPath =
          window.sessionStorage.getItem(
            orderReturnPathStorageKey(
              currentOrderNumber
            )
          )


        if (
          storedReturnPath
          && storedReturnPath.startsWith(
            "/"
          )
          && !storedReturnPath.startsWith(
            "//"
          )
        ) {
          setReturnPath(
            storedReturnPath
          )
        }


        const storedPaymentPath =
          window.sessionStorage.getItem(
            orderPaymentPathStorageKey(
              currentOrderNumber
            )
          )


        if (
          storedPaymentPath
          && storedPaymentPath.startsWith(
            "/api/public/events/"
          )
          && !storedPaymentPath.startsWith(
            "//"
          )
        ) {
          setPaymentPath(
            storedPaymentPath
          )
        }

      } catch {
        accessToken = ""
      }


      if (!accessToken) {
        setVerificationState(
          "unavailable"
        )

        return
      }


      setAccessToken(
        accessToken
      )


      let active = true


      async function verify() {
        setErrorMessage(
          ""
        )

        setVerificationState(
          "loading"
        )


        for (
          let attempt = 0;
          attempt < MAX_STATUS_ATTEMPTS;
          attempt += 1
        ) {
          try {
            const result =
              await fetchOrderStatus(
                currentOrderNumber,
                accessToken
              )


            if (!active) {
              return
            }


            setOrder(
              result.order
            )


            const nextState =
              stateFromOrderStatus(
                result.order.status
              )


            setVerificationState(
              nextState
            )


            if (
              nextState !== "pending"
            ) {
              return
            }


          } catch (
            error
          ) {
            if (!active) {
              return
            }


            setVerificationState(
              "error"
            )

            setErrorMessage(
              error instanceof Error
                ? error.message
                : "Unable to verify this payment."
            )

            return
          }


          if (
            attempt
            < MAX_STATUS_ATTEMPTS - 1
          ) {
            await new Promise(
              (
                resolve
              ) => {
                window.setTimeout(
                  resolve,
                  STATUS_RETRY_DELAY_MS
                )
              }
            )
          }
        }


        if (active) {
          setVerificationState(
            "pending"
          )
        }
      }


      void verify()


      return () => {
        active = false
      }
    },
    [
      fetchOrderStatus,
      retryNonce,
    ]
  )


  async function startPaymentAgain() {
    if (
      !orderNumber
      || !accessToken
      || !paymentPath
    ) {
      setPaymentStartError(
        "This browser session does not have the payment details needed to continue this order."
      )

      return
    }


    setPaymentStarting(
      true
    )

    setPaymentStartError(
      ""
    )


    try {
      const response =
        await fetch(
          `${API_URL}${paymentPath}`,
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                access_token:
                  accessToken,
              }),

            cache:
              "no-store",
          }
        )


      const payload =
        (
          await response.json()
        ) as (
          StartPaymentResponse
          | {
              detail?: string
            }
        )


      if (!response.ok) {
        throw new Error(
          "detail" in payload
            && payload.detail
            ? payload.detail
            : "Unable to continue FPX payment."
        )
      }


      const result =
        payload as StartPaymentResponse


      if (
        !result
          .payment
          .checkout_url
      ) {
        throw new Error(
          "Payment checkout is unavailable."
        )
      }


      window.location.assign(
        result
          .payment
          .checkout_url
      )

    } catch (
      error
    ) {
      setPaymentStartError(
        error instanceof Error
          ? error.message
          : "Unable to continue FPX payment."
      )

      setPaymentStarting(
        false
      )

      setRetryNonce(
        (
          current
        ) =>
          current + 1
      )
    }
  }


  const paid =
    verificationState === "paid"

  const pending =
    verificationState === "pending"

  const loading =
    verificationState === "loading"

  const unavailable =
    verificationState === "unavailable"

  const failed =
    verificationState === "failed"

  const cancelled =
    verificationState === "cancelled"

  const expired =
    verificationState === "expired"

  const refunded =
    verificationState === "refunded"

  const error =
    verificationState === "error"


  const returnedWithoutPayment =
    pending
    && returnResult === "cancelled"


  const negative =
    failed
    || cancelled
    || expired


  useEffect(
    () => {
      if (
        !paid
        || !orderNumber
        || !accessToken
      ) {
        return
      }


      let active = true


      async function loadDownloads() {
        setDownloadsLoading(
          true
        )

        setDownloadsError(
          ""
        )


        try {
          const response =
            await fetch(
              `${API_URL}/api/public/events/orders/${encodeURIComponent(
                orderNumber
              )}/downloads`,
              {
                method:
                  "POST",

                headers: {
                  "Content-Type":
                    "application/json",
                },

                body:
                  JSON.stringify({
                    access_token:
                      accessToken,
                  }),

                cache:
                  "no-store",
              }
            )


          const payload =
            (
              await response.json()
            ) as (
              OrderDownloadsResponse
              | {
                  detail?: string
                }
            )


          if (!response.ok) {
            throw new Error(
              "detail" in payload
                && payload.detail
                ? payload.detail
                : "Unable to prepare your photo downloads."
            )
          }


          if (!active) {
            return
          }


          setDownloads(
            (
              payload as OrderDownloadsResponse
            ).downloads
          )

        } catch (
          error
        ) {
          if (!active) {
            return
          }


          setDownloads(
            null
          )

          setDownloadsError(
            error instanceof Error
              ? error.message
              : "Unable to prepare your photo downloads."
          )

        } finally {
          if (active) {
            setDownloadsLoading(
              false
            )
          }
        }
      }


      void loadDownloads()


      return () => {
        active = false
      }
    },
    [
      paid,
      orderNumber,
      accessToken,
      downloadRefreshNonce,
    ]
  )


  let title =
    "Confirming payment"

  let description =
    "We are securely checking the payment status for your order."


  if (paid) {
    title =
      "Payment successful"

    description =
      "Your payment has been securely confirmed. Your original photos are ready to download."

  } else if (pending) {
    if (returnedWithoutPayment) {
      title =
        "Payment not completed"

      description =
        "You returned before completing FPX. Your order is still reserved for a limited time, so you can continue the same payment."
    } else {
      title =
        "Payment is being confirmed"

      description =
        "The payment provider has returned you to EZFOTOO, but confirmation is still processing. You can check again in a moment."
    }

  } else if (failed) {
    title =
      "Payment was not completed"

    description =
      "The payment provider reported that this transaction was unsuccessful."

  } else if (cancelled) {
    title =
      "Payment cancelled"

    description =
      "No completed payment was confirmed for this order."

  } else if (expired) {
    title =
      "Order expired"

    description =
      "The payment reservation for this order has expired."

  } else if (refunded) {
    title =
      "Payment refunded"

    description =
      "This order has been marked as refunded."

  } else if (unavailable) {
    title =
      "Order verification unavailable"

    description =
      "This browser session does not have the secure order access needed to verify the payment. Return to the gallery where you started the checkout."

  } else if (error) {
    title =
      "Unable to verify payment"

    description =
      errorMessage
      || "We could not verify the payment status right now."
  }


  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F7FAFB] px-5 py-10">

      <div className="w-full max-w-[540px] rounded-[28px] border border-[#DCE8EA] bg-white p-8 text-center shadow-[0_18px_55px_rgba(8,47,60,0.08)] sm:p-9">

        {paid ? (

          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#E7F8F3]">

            <CheckCircle2 className="h-8 w-8 text-[#16856F]" />

          </div>

        ) : loading || pending ? (

          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#EEF7F8]">

            {loading ? (
              <Loader2 className="h-8 w-8 animate-spin text-[#168792]" />
            ) : (
              <Clock3 className="h-8 w-8 text-[#168792]" />
            )}

          </div>

        ) : negative ? (

          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#FFF1F2]">

            <XCircle className="h-8 w-8 text-[#AD5660]" />

          </div>

        ) : refunded ? (

          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#EEF7F8]">

            <RefreshCw className="h-7 w-7 text-[#168792]" />

          </div>

        ) : (

          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#EEF7F8]">

            <ShieldCheck className="h-8 w-8 text-[#168792]" />

          </div>

        )}


        <p className="mt-6 text-[11px] font-bold uppercase tracking-[0.16em] text-[#0A929E]">
          EZFOTOO Payment
        </p>


        <h1 className="mt-2 text-2xl font-semibold tracking-[-0.035em] text-[#173D47]">
          {title}
        </h1>


        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[#74878E]">
          {description}
        </p>


        {orderNumber && (

          <div className="mt-6 rounded-[18px] border border-[#DDE8EA] bg-[#F8FBFB] p-5 text-left">

            <div>

              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#8A9A9F]">
                Order number
              </p>


              <p className="mt-1 break-all font-mono text-sm font-semibold text-[#294E57]">
                {orderNumber}
              </p>

            </div>


            {order && (

              <div className="mt-5 grid grid-cols-2 gap-4 border-t border-[#DFE9EB] pt-5">

                <div>

                  <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#8A9A9F]">
                    Photos
                  </p>


                  <p className="mt-1 text-sm font-semibold text-[#355B65]">
                    {order.item_count}
                  </p>

                </div>


                <div>

                  <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#8A9A9F]">
                    Status
                  </p>


                  <p
                    className={
                      paid
                        ? "mt-1 text-sm font-semibold text-[#16856F]"
                        : negative
                          ? "mt-1 text-sm font-semibold text-[#AD5660]"
                          : "mt-1 text-sm font-semibold text-[#B17A21]"
                    }
                  >
                    {order.status.replaceAll(
                      "_",
                      " "
                    )}
                  </p>

                </div>


                <div className="col-span-2 border-t border-[#DFE9EB] pt-4">

                  <div className="flex items-end justify-between gap-4">

                    <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#8A9A9F]">
                      Total
                    </p>


                    <p className="text-2xl font-semibold tracking-[-0.035em] text-[#123D48]">

                      RM
                      {order
                        .total_rm
                        .toFixed(
                          2
                        )}

                    </p>

                  </div>

                </div>

              </div>

            )}

          </div>

        )}


        {paid && (

          <div className="mt-4 flex items-start gap-3 rounded-[16px] border border-[#D7E8E9] bg-[#F5FAFA] px-4 py-3 text-left">

            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#16856F]" />


            <p className="text-xs leading-5 text-[#56757D]">
              Payment verified securely by EZFOTOO.
            </p>

          </div>

        )}


        {paid && (

          <div className="mt-5 rounded-[18px] border border-[#DDE8EA] bg-white p-5 text-left">

            <div className="flex items-start justify-between gap-4">

              <div>

                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#0A929E]">
                  Your photos
                </p>


                <h2 className="mt-1 text-base font-semibold text-[#244B55]">
                  Original files
                </h2>


                <p className="mt-1 text-xs leading-5 text-[#7B8F95]">
                  Download links are private and short-lived. Refresh them anytime while this order remains eligible for delivery.
                </p>

              </div>


              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#EEF8F8]">
                <FileImage className="h-5 w-5 text-[#168792]" />
              </div>

            </div>


            {downloadsLoading ? (

              <div className="mt-5 flex items-center justify-center gap-2 rounded-[14px] bg-[#F7FAFB] px-4 py-5 text-sm text-[#667A83]">
                <Loader2 className="h-4 w-4 animate-spin" />
                Preparing secure downloads...
              </div>

            ) : downloadsError ? (

              <div className="mt-5">

                <div className="rounded-[14px] border border-[#F0DCDD] bg-[#FFF7F7] px-4 py-3 text-xs leading-5 text-[#94545C]">
                  {downloadsError}
                </div>


                <button
                  type="button"
                  onClick={() => {
                    setDownloadRefreshNonce(
                      (
                        current
                      ) =>
                        current + 1
                    )
                  }}
                  className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-[#D4E2E5] bg-white text-xs font-semibold text-[#45666F] transition hover:bg-[#F6FAFA]"
                >
                  <RefreshCw className="h-4 w-4" />
                  Try downloads again
                </button>

              </div>

            ) : downloads ? (

              <div className="mt-5">

                <p className="mb-3 text-[10px] font-medium text-[#87989D]">
                  These links expire in about {Math.max(
                    1,
                    Math.ceil(
                      downloads.expires_in_seconds / 60
                    )
                  )} minutes.
                </p>

                <div className="space-y-2">

                  {downloads.items.map(
                    (
                      item,
                      index
                    ) => (

                      <div
                        key={item.photo_id}
                        className="flex items-center gap-3 rounded-[14px] border border-[#E1EAEC] bg-[#F9FBFB] p-3"
                      >

                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm">
                          <FileImage className="h-4 w-4 text-[#168792]" />
                        </div>


                        <div className="min-w-0 flex-1">

                          <p className="truncate text-xs font-semibold text-[#355B65]">
                            {item.filename || `Photo ${index + 1}`}
                          </p>


                          <p className="mt-0.5 text-[10px] text-[#87989D]">
                            {formatBytes(
                              item.size_bytes
                            )}
                          </p>

                        </div>


                        <a
                          href={item.download_url}
                          className="flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-[#073B4C] px-3 text-[11px] font-semibold text-white transition hover:bg-[#0B5363]"
                        >
                          <Download className="h-3.5 w-3.5" />
                          Download
                        </a>

                      </div>

                    )
                  )}

                </div>


                <button
                  type="button"
                  onClick={() => {
                    setDownloadRefreshNonce(
                      (
                        current
                      ) =>
                        current + 1
                    )
                  }}
                  className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-[#D4E2E5] bg-white text-xs font-semibold text-[#45666F] transition hover:bg-[#F6FAFA]"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Refresh download links
                </button>

              </div>

            ) : null}

          </div>

        )}


        {paymentStartError && (

          <div className="mt-5 rounded-[14px] border border-[#F0DCDD] bg-[#FFF7F7] px-4 py-3 text-left text-xs leading-5 text-[#94545C]">
            {paymentStartError}
          </div>

        )}


        {returnedWithoutPayment && paymentPath && accessToken && (

          <button
            type="button"
            disabled={
              paymentStarting
            }
            onClick={
              startPaymentAgain
            }
            className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#073B4C] text-sm font-semibold text-white transition hover:bg-[#0B5363] disabled:cursor-not-allowed disabled:opacity-55"
          >

            {paymentStarting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Opening FPX...
              </>
            ) : (
              <>
                <Landmark className="h-4 w-4" />
                Try payment again
              </>
            )}

          </button>

        )}


        {(pending || error) && (

          <button
            type="button"
            onClick={() => {
              setRetryNonce(
                (
                  current
                ) =>
                  current + 1
              )
            }}
            className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#D4E2E5] bg-white text-sm font-semibold text-[#45666F] transition hover:bg-[#F6FAFA]"
          >
            <RefreshCw className="h-4 w-4" />

            Check payment again
          </button>

        )}


        <Link
          href={
            returnPath
          }
          className={
            returnedWithoutPayment
              ? "mt-4 flex h-12 w-full items-center justify-center rounded-xl border border-[#D4E2E5] bg-white text-sm font-semibold text-[#45666F] transition hover:bg-[#F6FAFA]"
              : "mt-4 flex h-12 w-full items-center justify-center rounded-xl bg-[#073B4C] text-sm font-semibold text-white transition hover:bg-[#0B5363]"
          }
        >
          {paid || returnedWithoutPayment
            ? "Return to event gallery"
            : "Return to EZFOTOO"}
        </Link>


        <p className="mt-4 text-[10px] leading-4 text-[#98A6AA]">
          The browser return result is not used as payment proof. EZFOTOO displays the status stored by the verified server-side payment flow.
        </p>

      </div>

    </main>
  )
}
