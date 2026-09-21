import Link from "next/link"

import {
  CheckCircle2,
  Clock3,
  XCircle,
} from "lucide-react"


type SearchParams = Promise<{
  result?: string
  order?: string
}>


export default async function ChipReturnPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const params =
    await searchParams


  const result =
    params.result
    || "pending"


  const orderNumber =
    params.order
    || ""


  const success =
    result === "success"


  const failure =
    result === "failure"


  const cancelled =
    result === "cancelled"


  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F7FAFB] px-5">

      <div className="w-full max-w-[520px] rounded-[28px] border border-[#DCE8EA] bg-white p-8 text-center shadow-[0_18px_55px_rgba(8,47,60,0.08)]">

        {success ? (

          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#E7F8F3]">

            <CheckCircle2 className="h-8 w-8 text-[#16856F]" />

          </div>

        ) : failure || cancelled ? (

          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#FFF1F2]">

            <XCircle className="h-8 w-8 text-[#AD5660]" />

          </div>

        ) : (

          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#EEF7F8]">

            <Clock3 className="h-8 w-8 text-[#168792]" />

          </div>

        )}


        <p className="mt-6 text-[11px] font-bold uppercase tracking-[0.16em] text-[#0A929E]">
          EZFOTOO Payment
        </p>


        <h1 className="mt-2 text-2xl font-semibold tracking-[-0.035em] text-[#173D47]">

          {success
            ? "Payment submitted"
            : cancelled
              ? "Payment cancelled"
              : failure
                ? "Payment was not completed"
                : "Payment processing"}

        </h1>


        <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-[#74878E]">

          {success
            ? "We received your return from the payment page. Your order will be released once the payment is confirmed securely."
            : cancelled
              ? "No payment was completed. You can return to the gallery and try again."
              : failure
                ? "The FPX transaction was not completed. You can try again from your order."
                : "We are waiting for the payment status to be confirmed."}

        </p>


        {orderNumber && (

          <div className="mt-6 rounded-[16px] border border-[#DDE8EA] bg-[#F8FBFB] px-4 py-4">

            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#8A9A9F]">
              Order number
            </p>


            <p className="mt-1 font-mono text-sm font-semibold text-[#294E57]">
              {orderNumber}
            </p>

          </div>

        )}


        <Link
          href="/"
          className="mt-6 flex h-12 w-full items-center justify-center rounded-xl bg-[#073B4C] text-sm font-semibold text-white transition hover:bg-[#0B5363]"
        >
          Return to EZFOTOO
        </Link>

      </div>

    </main>
  )
}