"use client"

import {
  Loader2,
  ShoppingCart,
  Sparkles,
  Trash2,
  X,
} from "lucide-react"


export type CartPhoto = {
  id: string

  width: number | null
  height: number | null

  preview_url: string
  preview_url_expires_in: number
}


export type EventQuoteResponse = {
  event_id: string
  currency: string

  selected_count: number

  selected_photo_ids: string[]

  pricing: {
    unit_price_cents: number
    unit_price_rm: number

    regular_subtotal_cents: number
    regular_subtotal_rm: number

    total_cents: number
    total_rm: number

    savings_cents: number
    savings_rm: number
  }

  bundle: {
    configured: boolean
    applied: boolean

    quantity: number

    price_cents: number
    price_rm: number

    bundle_count: number

    bundled_photo_count: number
    remainder_photo_count: number
  }

  sales: {
    open: boolean
  }
}


export default function EventCartDrawer({
  open,
  selectedPhotos,
  quote,
  quoteLoading,
  quoteError,
  onClose,
  onRemove,
  onClear,
  onCheckout,
}: {
  open: boolean

  selectedPhotos: CartPhoto[]

  quote: EventQuoteResponse | null

  quoteLoading: boolean
  quoteError: string

  onClose: () => void

  onRemove: (
    photoId: string
  ) => void

  onClear: () => void

  onCheckout: () => void
}) {
  if (!open) {
    return null
  }


  return (
    <div className="fixed inset-0 z-[120]">

      <button
        type="button"
        aria-label="Close cart"
        onClick={
          onClose
        }
        className="absolute inset-0 bg-[#071D24]/55 backdrop-blur-[2px]"
      />


      <aside className="absolute bottom-0 right-0 top-0 flex w-full max-w-[460px] flex-col border-l border-[#DCE7E9] bg-[#F8FBFB] shadow-[-18px_0_55px_rgba(7,45,58,0.16)]">

        <div className="border-b border-[#DFE8EA] bg-white px-5 py-5">

          <div className="flex items-start justify-between gap-4">

            <div className="flex items-start gap-3">

              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#E5F7F8]">

                <ShoppingCart className="h-5 w-5 text-[#0A929E]" />

              </div>


              <div>

                <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#0A929E]">
                  Your selection
                </p>


                <h2 className="mt-1 text-xl font-semibold tracking-[-0.025em] text-[#173D47]">

                  {selectedPhotos.length === 1
                    ? "1 photo"
                    : `${selectedPhotos.length} photos`}

                </h2>

              </div>

            </div>


            <button
              type="button"
              onClick={
                onClose
              }
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#D9E4E7] bg-white text-[#6E858C] transition hover:bg-[#F3F7F8]"
            >

              <X className="h-4 w-4" />

            </button>

          </div>

        </div>


        <div className="flex-1 overflow-y-auto px-5 py-5">

          {selectedPhotos.length === 0 ? (

            <div className="rounded-[20px] border border-dashed border-[#D2E1E4] bg-white px-5 py-12 text-center">

              <ShoppingCart className="mx-auto h-6 w-6 text-[#90A7AD]" />


              <p className="mt-3 font-semibold text-[#45666E]">
                Your cart is empty
              </p>

            </div>

          ) : (

            <div className="space-y-3">

              {selectedPhotos.map(
                (
                  photo,
                  index
                ) => (

                  <div
                    key={
                      photo.id
                    }
                    className="flex gap-3 rounded-[16px] border border-[#DDE8EA] bg-white p-3"
                  >

                    <div className="h-[76px] w-[105px] shrink-0 overflow-hidden rounded-xl bg-[#E8F0F2]">

                      <img
                        src={
                          photo.preview_url
                        }
                        alt={
                          `Selected event photo ${index + 1}`
                        }
                        className="h-full w-full object-cover"
                      />

                    </div>


                    <div className="flex min-w-0 flex-1 items-center justify-between gap-3">

                      <p className="text-sm font-semibold text-[#355963]">
                        Photo {index + 1}
                      </p>


                      <button
                        type="button"
                        onClick={() =>
                          onRemove(
                            photo.id
                          )
                        }
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#E5E9EA] text-[#8A7A7D] transition hover:bg-[#FFF5F5] hover:text-[#AD505A]"
                      >

                        <Trash2 className="h-4 w-4" />

                      </button>

                    </div>

                  </div>

                )
              )}

            </div>

          )}

        </div>


        {selectedPhotos.length > 0 && (

          <div className="border-t border-[#DDE8EA] bg-white p-5">

            {quoteLoading ? (

              <div className="flex items-center justify-center gap-2 rounded-xl bg-[#F5F9FA] px-4 py-4 text-sm font-semibold text-[#627A82]">

                <Loader2 className="h-4 w-4 animate-spin text-[#0A929E]" />

                Calculating best price...

              </div>

            ) : quoteError ? (

              <div className="rounded-xl border border-[#F1CED2] bg-[#FFF7F7] px-4 py-3 text-sm font-medium text-[#A64F58]">
                {quoteError}
              </div>

            ) : quote ? (

              <>
                {quote.bundle.applied && (

                  <div className="mb-4 flex items-start gap-3 rounded-xl border border-[#CDEAE5] bg-[#EFFAF7] px-4 py-3">

                    <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[#168A73]" />


                    <div>

                      <p className="text-xs font-semibold text-[#347268]">
                        Bundle price applied
                      </p>


                      <p className="mt-0.5 text-[11px] text-[#698B84]">

                        {quote.bundle.bundle_count}
                        {" × "}
                        {quote.bundle.quantity}
                        {"-photo bundle"}

                      </p>

                    </div>

                  </div>

                )}


                <div className="space-y-2.5 text-sm">

                  <div className="flex justify-between text-[#72858B]">

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


                  <div className="my-3 border-t border-[#E2EAEC]" />


                  <div className="flex items-end justify-between">

                    <span className="font-semibold text-[#49656D]">
                      Total
                    </span>


                    <p className="text-2xl font-semibold tracking-[-0.035em] text-[#123D48]">

                      RM
                      {quote
                        .pricing
                        .total_rm
                        .toFixed(
                          2
                        )}

                    </p>

                  </div>

                </div>

              </>

            ) : null}


            <button
              type="button"
              disabled={
                quoteLoading
                || !quote
                || Boolean(
                  quoteError
                )
              }
              onClick={
                onCheckout
              }
              className="mt-5 h-12 w-full rounded-xl bg-[#073B4C] text-sm font-semibold text-white transition hover:bg-[#0B5363] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Continue to checkout
            </button>


            <button
              type="button"
              onClick={
                onClear
              }
              className="mt-4 w-full text-xs font-semibold text-[#7B8F95] transition hover:text-[#B0525C]"
            >
              Clear selection
            </button>

          </div>

        )}

      </aside>

    </div>
  )
}