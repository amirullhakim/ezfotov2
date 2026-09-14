import Link from "next/link"
import {
  CheckCircle2,
  Images,
  Search,
  Sparkles,
} from "lucide-react"

import { EzfotooBrand } from "@/components/brand/EzfotooBrand"


type AuthShellProps = {
  children: React.ReactNode
}


const benefits = [
  {
    icon: Images,
    title: "Professional galleries",
    description:
      "Deliver beautiful client galleries under your own photography brand.",
  },
  {
    icon: Search,
    title: "AI-powered discovery",
    description:
      "Help event customers find photos using bib numbers and face search.",
  },
  {
    icon: Sparkles,
    title: "One photography workspace",
    description:
      "Manage your website, galleries and event sales from one place.",
  },
]


export function AuthShell({
  children,
}: AuthShellProps) {
  return (
    <main className="min-h-screen">
      <div className="grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">

        <section className="relative hidden overflow-hidden bg-[#073B4C] px-14 py-12 lg:flex lg:flex-col">
          <div
            className="absolute inset-0 opacity-40"
            style={{
              background:
                "radial-gradient(circle at 25% 15%, rgba(54,212,223,0.24), transparent 28rem), radial-gradient(circle at 90% 90%, rgba(255,255,255,0.10), transparent 26rem)",
            }}
          />

          <div className="relative z-10">
            <Link href="/">
              <div className="inline-flex rounded-2xl bg-white px-4 py-3 shadow-xl shadow-black/5">
                <EzfotooBrand />
              </div>
            </Link>
          </div>

          <div className="relative z-10 my-auto max-w-xl py-14">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/8 px-4 py-2 text-sm font-medium text-[#BDEFF2]">
              <CheckCircle2 className="h-4 w-4" />
              Built for modern photographers
            </div>

            <h1 className="max-w-lg text-[46px] font-semibold leading-[1.08] tracking-[-0.045em] text-white">
              Your photography business,
              <span className="text-[#55D9E2]">
                {" "}
                beautifully connected.
              </span>
            </h1>

            <p className="mt-6 max-w-lg text-[17px] leading-7 text-[#BCD0D5]">
              Build your brand, deliver client galleries and sell
              event photos with intelligent photo discovery — all
              from one professional platform.
            </p>

            <div className="mt-12 space-y-5">
              {benefits.map((benefit) => {
                const Icon = benefit.icon

                return (
                  <div
                    key={benefit.title}
                    className="flex max-w-lg gap-4"
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/8">
                      <Icon className="h-5 w-5 text-[#55D9E2]" />
                    </div>

                    <div>
                      <p className="font-semibold text-white">
                        {benefit.title}
                      </p>

                      <p className="mt-1 text-sm leading-6 text-[#9FB9C0]">
                        {benefit.description}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="relative z-10 text-xs font-medium uppercase tracking-[0.18em] text-[#6E969F]">
            Photography powers people
          </div>
        </section>

        <section className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-10">
          <div className="w-full max-w-[460px]">

            <div className="mb-10 lg:hidden">
              <EzfotooBrand />
            </div>

            {children}

          </div>
        </section>

      </div>
    </main>
  )
}