"use client"

import {
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  Landmark,
  Loader2,
  Mail,
  ReceiptText,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react"

import {
  useState,
} from "react"

import type {
  CartPhoto,
  EventQuoteResponse,
} from "@/components/public-events/EventCartDrawer"


const API_URL = (
  process.env.NEXT_PUBLIC_API_URL
  || "http://localhost:8000"
).replace(
  /\/+$/,
  ""
)


type CreateOrderResponse = {
  order: {
    id: string

    order_number: string
    status: string

    customer_name: string
    customer_email: string

    currency: string
    item_count: number

    created_at: string
    expires_at: string | null
  }

  access: {
    token: string
  }

  pricing: {
    regular_subtotal_cents: number
    regular_subtotal_rm: number

    discount_cents: number
    discount_rm: number

    total_cents: number
    total_rm: number
  }

  payment: {
    required: boolean
    ready: boolean
    provider: string
    message: string
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


export default function EventCheckoutModal({
  open,
  workspaceSlug,
  eventSlug,
  selectedPhotos,
  quote,
  onClose,
  onOrderCreated,
}: {
  open: boolean

  workspaceSlug: string
  eventSlug: string

  selectedPhotos: CartPhoto[]

  quote: EventQuoteResponse | null

  onClose: () => void

  onOrderCreated: () => void
}) {
  const [
    customerName,
    setCustomerName,
  ] = useState(
    ""
  )

  const [
    customerEmail,
    setCustomerEmail,
  ] = useState(
    ""
  )

  const [
    submitting,
    setSubmitting,
  ] = useState(
    false
  )

  const [
    paymentStarting,
    setPaymentStarting,
  ] = useState(
    false
  )

  const [
    errorMessage,
    setErrorMessage,
  ] = useState(
    ""
  )

  const [
    createdOrder,
    setCreatedOrder,
  ] = useState<CreateOrderResponse | null>(
    null
  )


  if (!open) {
    return null
  }


  async function createOrder() {
    const cleanName =
      customerName
        .trim()


    const cleanEmail =
      customerEmail
        .trim()
        .toLowerCase()


    if (
      cleanName.length < 2
    ) {
      setErrorMessage(
        "Enter your name."
      )

      return
    }


    if (
      !cleanEmail
      || !cleanEmail.includes(
        "@"
      )
    ) {
      setErrorMessage(
        "Enter a valid email address."
      )

      return
    }


    if (
      selectedPhotos.length === 0
    ) {
      setErrorMessage(
        "Your cart is empty."
      )

      return
    }


    setSubmitting(
      true
    )

    setErrorMessage(
      ""
    )


    try {
      const response =
        await fetch(
          `${API_URL}/api/public/events/${encodeURIComponent(
            workspaceSlug
          )}/${encodeURIComponent(
            eventSlug
          )}/orders`,
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                customer_name:
                  cleanName,

                customer_email:
                  cleanEmail,

                photo_ids:
                  selectedPhotos.map(
                    (
                      photo
                    ) =>
                      photo.id
                  ),
              }),
          }
        )


      const payload =
        (
          await response.json()
        ) as (
          CreateOrderResponse
          | {
              detail?: string
            }
        )


      if (!response.ok) {
        throw new Error(
          "detail" in payload
            && payload.detail
            ? payload.detail
            : "Unable to create the order."
        )
      }


      const result =
        payload as CreateOrderResponse


      setCreatedOrder(
        result
      )

      onOrderCreated()

    } catch (
      error
    ) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to create the order."
      )

    } finally {
      setSubmitting(
        false
      )
    }
  }


  async function startFpxPayment() {
    if (!createdOrder) {
      return
    }


    setPaymentStarting(
      true
    )

    setErrorMessage(
      ""
    )


    try {
      const response =
        await fetch(
          `${API_URL}/api/public/events/${encodeURIComponent(
            workspaceSlug
          )}/${encodeURIComponent(
            eventSlug
          )}/orders/${encodeURIComponent(
            createdOrder
              .order
              .order_number
          )}/payment`,
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
                  createdOrder
                    .access
                    .token,
              }),
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
            : "Unable to start FPX payment."
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
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to start FPX payment."
      )

      setPaymentStarting(
        false
      )
    }
  }


  if (createdOrder) {
    return (
      <div className="fixed inset-0 z-[140] flex items-center justify-center bg-[#071D24]/65 p-4 backdrop-blur-sm">

        <div className="w-full max-w-[540px] overflow-hidden rounded-[28px] border border-[#DCE8EA] bg-white shadow-[0_24px_80px_rgba(6,36,46,0.25)]">

          <div className="px-6 py-8 text-center sm:px-8">

            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#E7F8F3]">

              <CheckCircle2 className="h-8 w-8 text-[#16856F]" />

            </div>


            <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.15em] text-[#0A929E]">
              Order created
            </p>


            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.035em] text-[#173D47]">
              Complete your payment
            </h2>


            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#74878E]">
              Your selected photos are reserved. Continue with FPX to complete your purchase.
            </p>


            <div className="mt-6 rounded-[20px] border border-[#DDE8EA] bg-[#F8FBFB] p-5 text-left">

              <div className="flex items-start gap-3">

                <ReceiptText className="mt-0.5 h-5 w-5 text-[#0A929E]" />


                <div>

                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#8A9A9F]">
                    Order number
                  </p>


                  <p className="mt-1 font-mono text-sm font-semibold text-[#244B55]">
                    {createdOrder.order.order_number}
                  </p>

                </div>

              </div>


              <div className="mt-5 grid grid-cols-2 gap-4">

                <div>

                  <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#8A9A9F]">
                    Photos
                  </p>


                  <p className="mt-1 text-sm font-semibold text-[#355B65]">
                    {createdOrder.order.item_count}
                  </p>

                </div>


                <div>

                  <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#8A9A9F]">
                    Status
                  </p>


                  <p className="mt-1 text-sm font-semibold text-[#B17A21]">
                    Pending payment
                  </p>

                </div>

              </div>


              <div className="mt-5 border-t border-[#DDE8EA] pt-5">

                <div className="flex items-end justify-between gap-4">

                  <div>

                    <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#8A9A9F]">
                      Total
                    </p>


                    {createdOrder.pricing.discount_rm > 0 && (

                      <p className="mt-1 text-xs font-medium text-[#16856F]">

                        RM
                        {createdOrder
                          .pricing
                          .discount_rm
                          .toFixed(
                            2
                          )}
                        {" "}
                        saved

                      </p>

                    )}

                  </div>


                  <p className="text-2xl font-semibold tracking-[-0.035em] text-[#123D48]">

                    RM
                    {createdOrder
                      .pricing
                      .total_rm
                      .toFixed(
                        2
                      )}

                  </p>

                </div>

              </div>

            </div>


            <div className="mt-4 flex items-start gap-3 rounded-[16px] border border-[#D7E8E9] bg-[#F5FAFA] px-4 py-3 text-left">

              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#16856F]" />


              <div>

                <p className="text-xs font-semibold text-[#45676F]">
                  Secure FPX Online Banking
                </p>


                <p className="mt-0.5 text-[11px] leading-5 text-[#7C9096]">
                  You&apos;ll continue to the secure payment page to choose your bank and authorize the transaction.
                </p>

              </div>

            </div>


            {createdOrder.order.expires_at && (

              <div className="mt-4 flex items-center justify-center gap-2 text-xs text-[#7D9096]">

                <Clock3 className="h-4 w-4" />

                Payment reservation expires in approximately 30 minutes.

              </div>

            )}


            {errorMessage && (

              <div className="mt-4 rounded-xl border border-[#F0CDD1] bg-[#FFF7F7] px-4 py-3 text-sm font-medium text-[#A44C56]">
                {errorMessage}
              </div>

            )}


            <button
              type="button"
              disabled={
                paymentStarting
              }
              onClick={
                startFpxPayment
              }
              className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#073B4C] text-sm font-semibold text-white transition hover:bg-[#0B5363] disabled:cursor-not-allowed disabled:opacity-55"
            >

              {paymentStarting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />

                  Opening FPX...
                </>
              ) : (
                <>
                  <Landmark className="h-4 w-4" />

                  Pay RM
                  {createdOrder
                    .pricing
                    .total_rm
                    .toFixed(
                      2
                    )}
                  {" "}
                  with FPX

                  <ArrowUpRight className="h-4 w-4" />
                </>
              )}

            </button>


            <button
              type="button"
              disabled={
                paymentStarting
              }
              onClick={
                onClose
              }
              className="mt-3 h-11 w-full rounded-xl text-sm font-semibold text-[#71868C] transition hover:bg-[#F6F9FA] disabled:opacity-50"
            >
              Close
            </button>

          </div>

        </div>

      </div>
    )
  }


  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center bg-[#071D24]/65 p-4 backdrop-blur-sm">

      <div className="w-full max-w-[560px] overflow-hidden rounded-[28px] border border-[#DCE8EA] bg-white shadow-[0_24px_80px_rgba(6,36,46,0.25)]">

        <div className="flex items-start justify-between gap-4 border-b border-[#E0E9EB] px-6 py-5">

          <div>

            <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#0A929E]">
              Checkout
            </p>


            <h2 className="mt-1 text-xl font-semibold tracking-[-0.025em] text-[#173D47]">
              Your details
            </h2>

          </div>


          <button
            type="button"
            disabled={
              submitting
            }
            onClick={
              onClose
            }
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#D9E4E7] text-[#6E858C] transition hover:bg-[#F3F7F8]"
          >

            <X className="h-4 w-4" />

          </button>

        </div>


        <div className="max-h-[78vh] overflow-y-auto p-6">

          <label className="block">

            <span className="text-xs font-semibold text-[#46636B]">
              Name
            </span>


            <div className="relative mt-2">

              <UserRound className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8A9FA5]" />


              <input
                value={
                  customerName
                }
                onChange={(
                  event
                ) => {
                  setCustomerName(
                    event.target.value
                  )

                  setErrorMessage(
                    ""
                  )
                }}
                placeholder="Your name"
                autoComplete="name"
                className="h-12 w-full rounded-xl border border-[#D6E3E6] bg-white pl-11 pr-4 text-sm text-[#294D56] outline-none transition focus:border-[#62C5CC] focus:ring-4 focus:ring-[#E3F7F8]"
              />

            </div>

          </label>


          <label className="mt-4 block">

            <span className="text-xs font-semibold text-[#46636B]">
              Email
            </span>


            <div className="relative mt-2">

              <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8A9FA5]" />


              <input
                type="email"
                value={
                  customerEmail
                }
                onChange={(
                  event
                ) => {
                  setCustomerEmail(
                    event.target.value
                  )

                  setErrorMessage(
                    ""
                  )
                }}
                placeholder="you@example.com"
                autoComplete="email"
                className="h-12 w-full rounded-xl border border-[#D6E3E6] bg-white pl-11 pr-4 text-sm text-[#294D56] outline-none transition focus:border-[#62C5CC] focus:ring-4 focus:ring-[#E3F7F8]"
              />

            </div>

          </label>


          <p className="mt-2 text-[11px] leading-5 text-[#8B9BA0]">
            We&apos;ll use this email for your payment confirmation and photo delivery.
          </p>


          {quote && (

            <div className="mt-6 rounded-[20px] border border-[#DDE8EA] bg-[#F8FBFB] p-5">

              <div className="flex items-center justify-between">

                <p className="text-sm font-semibold text-[#315862]">
                  Order summary
                </p>


                <p className="text-xs text-[#819399]">
                  {quote.selected_count}
                  {" "}
                  photos
                </p>

              </div>


              <div className="mt-4 space-y-2.5 text-sm">

                <div className="flex justify-between text-[#74878E]">

                  <span>
                    Regular price
                  </span>


                  <span>

                    RM
                    {quote
                      .pricing
                      .regular_subtotal_rm
                      .toFixed(
                        2
                      )}

                  </span>

                </div>


                {quote.pricing.savings_rm > 0 && (

                  <div className="flex justify-between font-semibold text-[#16856F]">

                    <span>
                      Bundle savings
                    </span>


                    <span>

                      − RM
                      {quote
                        .pricing
                        .savings_rm
                        .toFixed(
                          2
                        )}

                    </span>

                  </div>

                )}


                <div className="border-t border-[#DCE7E9] pt-3">

                  <div className="flex items-end justify-between">

                    <span className="font-semibold text-[#49656D]">
                      Total
                    </span>


                    <span className="text-2xl font-semibold tracking-[-0.035em] text-[#123D48]">

                      RM
                      {quote
                        .pricing
                        .total_rm
                        .toFixed(
                          2
                        )}

                    </span>

                  </div>

                </div>

              </div>

            </div>

          )}


          {errorMessage && (

            <div className="mt-4 rounded-xl border border-[#F0CDD1] bg-[#FFF7F7] px-4 py-3 text-sm font-medium text-[#A44C56]">
              {errorMessage}
            </div>

          )}


          <button
            type="button"
            disabled={
              submitting
              || !quote
            }
            onClick={
              createOrder
            }
            className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#073B4C] text-sm font-semibold text-white transition hover:bg-[#0B5363] disabled:cursor-not-allowed disabled:opacity-55"
          >

            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />

                Creating order...
              </>
            ) : (
              <>
                <ReceiptText className="h-4 w-4" />

                Continue to payment
              </>
            )}

          </button>


          <p className="mt-3 text-center text-[10px] leading-4 text-[#98A6AA]">
            Your payable amount is calculated and verified securely by EZFOTOO.
          </p>

        </div>

      </div>

    </div>
  )
}